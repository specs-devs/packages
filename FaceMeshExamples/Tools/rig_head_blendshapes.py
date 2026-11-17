"""Add expression shape keys to a generated head GLB so Lens Studio can drive it
from Face Mesh expression weights (names match the Lens `Expressions` enum).

Usage:
  blender -b --python-exit-code 1 -P rig_head_blendshapes.py -- in.glb out.glb [params.json]

Regions are found from the head's bounding box, in normalized head space:
  u = lateral (-1 right .. +1 left, the character's own sides)
  v = height  (0 bottom .. 1 top)
  f = depth   (-1 back .. +1 front; the face points toward glTF +Z)
Override any key of DEFAULTS with a JSON file to tune one head.
"""
import json
import math
import sys

import bpy
from mathutils import Vector

DEFAULTS = {
    "mouth_u": 0.25,        # half-width of the mouth (corner position)
    "corner_r": 0.16,
    "jaw_shift": 0.04,
    "pucker_fwd": 0.03,
    "puff_out": 0.04,
    "eye_wide": 0.30,
    "brow_gap": 0.02, "brow_rv": 0.07, "brow_cap_v": 1.05,
    "mouth_v": 0.40,        # mouth line height
    "jaw_angle_deg": 18.0,  # JawOpen = 1 rotates the lower face this far
    "jaw_hinge_v": 0.52,    # hinge height (roughly ear level)
    "jaw_hinge_f": -0.10,   # hinge depth
    "eye_u": 0.34, "eye_v": 0.63, "eye_r": 0.20,
    "blink_squash": 0.85,   # 1 = lids fully closed onto the eye's center line
    "smile_u": 0.30, "smile_r": 0.20, "smile_lift": 0.07, "smile_out": 0.02,
    "brow_v": 0.80, "brow_r": 0.22, "brow_lift": 0.05,
    "front_min_f": 0.15,    # only vertices this far toward the front get eye/mouth/brow motion
    "slit_width": 1.15,      # mouth slit length, as a multiple of mouth_u
    "corner_soft": 0.45,
    "close_band": 0.07,
    "lower_lid": 0.35,      # share of the blink done by the lower lid
    "fade_v": 0.25,         # bottom fade height (fraction of head height); 0 = off     # open-mouth models: vertical blend band when closing the jaw (v units)
    "lip_straighten": 0.85,  # pull the cut lip edges toward a straight mouth line (0..1)
    "sock_depth": 0.22,     # mouth cavity depth, as a fraction of head depth    # how far past the corners (in u) the jaw weight fades out
    "jaw_depth_v": 0.30,    # how far below the mouth (in v) the jaw influence reaches
    "mouth_color": [0.45, 0.06, 0.08],
    "bag_ry": 0.20, "bag_rz": 0.15, "bag_drop": 0.35,  # mouth interior radii (depth, height) and drop below the mouth line
    "yaw_deg": 0.0,        # rotate about up first if the source faces elsewhere than glTF +Z
    "target_height_cm": 0,  # 0 = keep source scale
}


def smoothstep(e0, e1, x):
    if e0 == e1:
        return 1.0 if x >= e1 else 0.0
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:]
    src, dst = argv[0], argv[1]
    p = dict(DEFAULTS)
    if len(argv) > 2:
        with open(argv[2]) as fh:
            p.update(json.load(fh))

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        raise SystemExit("no mesh in " + src)
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    # Cleanup: weld split triangles (generators often ship triangle soup), smooth shading,
    # optional yaw so the face points to glTF +Z, then uniform scale to target height, centered.
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    dims = [max(v.co[i] for v in bm.verts) - min(v.co[i] for v in bm.verts) for i in range(3)]
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=max(dims) * 1e-4)
    bm.to_mesh(obj.data)
    bm.free()
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if p.get("yaw_deg"):
        obj.rotation_mode = "XYZ"  # glTF import leaves objects in QUATERNION mode
        obj.rotation_euler = (0, 0, math.radians(p["yaw_deg"]))
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    if p.get("target_height_cm"):
        zs = [v.co.z for v in obj.data.vertices]
        s = (p["target_height_cm"] / 100.0) / (max(zs) - min(zs))
        obj.scale = (s, s, s)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    xs = [v.co.x for v in obj.data.vertices]
    ys = [v.co.y for v in obj.data.vertices]
    zs = [v.co.z for v in obj.data.vertices]
    off = Vector(((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, (max(zs) + min(zs)) / 2))
    for v in obj.data.vertices:
        v.co -= off
    print(f"[rig] cleaned: {len(obj.data.vertices)} verts after weld")

    # Blender after glTF import: up = +Z, glTF +Z (face front) = Blender -Y,
    # character left = +X (facing -Y with +Z up, its right is -X).
    vs = [obj.matrix_world @ v.co for v in obj.data.vertices]
    mn = Vector((min(c.x for c in vs), min(c.y for c in vs), min(c.z for c in vs)))
    mx = Vector((max(c.x for c in vs), max(c.y for c in vs), max(c.z for c in vs)))
    cx, cy = (mn.x + mx.x) / 2, (mn.y + mx.y) / 2
    hw, hd, H = (mx.x - mn.x) / 2, (mx.y - mn.y) / 2, (mx.z - mn.z)

    def norm(c):
        return ((c.x - cx) / hw, (c.z - mn.z) / H, (cy - c.y) / hd)

    mu, mv = p["mouth_u"], p["mouth_v"]
    open_model = p.get("mouth_mode") == "open_model"
    if open_model:
        p["slit_width"] = 0.0  # the model already has a real mouth cavity: no cutting

    # --- Mouth slit: generated heads are closed shells, so split the surface along the
    # mouth line between the corners. The lower lip can then drop away instead of
    # stretching the skin, and a mouth interior shows through the gap.
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    face_v = {f.index: norm(f.calc_center_median())[1] for f in bm.faces}
    cut = []
    for e in bm.edges:
        if len(e.link_faces) != 2:
            continue
        a, b = (face_v[f.index] for f in e.link_faces)
        if (a - mv) * (b - mv) >= 0:
            continue
        u, _, f = norm((e.verts[0].co + e.verts[1].co) / 2)
        if abs(u) < mu * p["slit_width"] and f > p["front_min_f"]:
            cut.append(e)
    if cut:
        bmesh.ops.split_edges(bm, edges=cut)
    bm.verts.index_update()
    bm.faces.index_update()
    bm.faces.ensure_lookup_table()
    face_v = {f.index: norm(f.calc_center_median())[1] for f in bm.faces}
    # Mouth material (dark red: pure black reads as see-through on an additive display).
    mat = bpy.data.materials.new("MouthInside")
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = p["mouth_color"] + [1.0]
    bsdf.inputs["Roughness"].default_value = 0.55
    mat.use_backface_culling = False  # double-sided: the cavity is hidden inside the head anyway
    obj.data.materials.append(mat)
    mouth_mat = len(obj.data.materials) - 1

    # Straighten the cut lip edges toward the mouth line (the cut follows zig-zagging
    # triangle edges), then build a mouth "sock": extrude the lip opening inward in two
    # rings and close it. Being attached to both lips, it stretches with the jaw and
    # never leaves a hole or pokes out of the head.
    mz = mn.z + mv * H
    sw = mu * p["slit_width"]

    def in_slit(co):
        u, v, f = norm(co)
        return abs(u) <= sw * 1.08 and abs(v - mv) < 0.08 and f > p["front_min_f"] - 0.1

    bnd = [e for e in bm.edges if e.is_boundary and in_slit(e.verts[0].co) and in_slit(e.verts[1].co)]
    for vert in {v for e in bnd for v in e.verts}:
        vert.co.z += (mz - vert.co.z) * p["lip_straighten"]
    sock_verts, sock_faces = set(), []
    depth = p["sock_depth"] * 2 * hd
    edges = bnd
    rx0 = sw * hw
    # Each ring is snapped onto a clean half-ellipse (upper/lower by side of the mouth
    # line), so the cavity is smooth instead of inheriting the cut's zig-zag.
    for dy, sx, rz_frac in ((0.5, 0.92, 0.035), (0.5, 0.8, 0.055)):
        if not edges:
            break
        ret = bmesh.ops.extrude_edge_only(bm, edges=edges)
        nv = [g for g in ret["geom"] if isinstance(g, bmesh.types.BMVert)]
        sock_faces += [g for g in ret["geom"] if isinstance(g, bmesh.types.BMFace)]
        rx0 *= sx
        for vert in nv:
            t = max(-1.0, min(1.0, (vert.co.x - cx) / rx0 / sx))
            side = 1.0 if vert.co.z >= mz else -1.0
            vert.co = Vector((cx + t * rx0, vert.co.y + depth * dy,
                              mz + side * rz_frac * H * math.sqrt(max(0.0, 1 - t * t))))
        sock_verts |= set(nv)
        nvs = set(nv)
        edges = [e for e in bm.edges if e.is_boundary and e.verts[0] in nvs and e.verts[1] in nvs]
    if edges:
        sock_faces += bmesh.ops.holes_fill(bm, edges=edges, sides=0)["faces"]
    bm.normal_update()
    cap_faces = set(sock_faces[-1:]) if edges else set()
    for face in sock_faces:
        face.material_index = mouth_mat
        face.smooth = True
        # Consistent orientation: tube walls face the mouth's center line, the back cap
        # faces the opening (upper/lower chains run opposite ways, so extrusion alternates).
        c = face.calc_center_median()
        want = Vector((0, -1, 0)) if face in cap_faces else Vector((cx - c.x, 0, mz - c.z))
        if want.length > 1e-9 and face.normal.dot(want) < 0:
            face.normal_flip()
    bm.verts.index_update()
    bm.faces.index_update()
    face_v = {f.index: norm(f.calc_center_median())[1] for f in bm.faces}
    below, sock_idx = {}, set()
    for vert in bm.verts:
        if vert in sock_verts:
            sock_idx.add(vert.index)
            below[vert.index] = vert.co.z < mz  # sock floor follows the jaw, roof stays
            continue
        fs = [face_v[f.index] for f in vert.link_faces if f.material_index != mouth_mat]
        below[vert.index] = bool(fs) and sum(fs) / len(fs) < mv
    bm.to_mesh(obj.data)
    bm.free()
    n_head = len(obj.data.vertices)
    print(f"[rig] mouth: {len(cut)} edges split, sock {len(sock_verts)} verts / {len(sock_faces)} faces")

    # Open-mouth models: the generated geometry is the OPEN pose. Rotate the lower jaw
    # up (smooth falloff, no cut) to build the closed rest pose; JawOpen blends back to
    # the original geometry, so the real cavity, teeth and lips never tear.
    hinge = Vector((0, cy - p["jaw_hinge_f"] * hd, mn.z + p["jaw_hinge_v"] * H))
    ang = math.radians(p["jaw_angle_deg"])

    def close_w(u, v, f):
        horiz = smoothstep(mu * 1.6 + p["corner_soft"], mu * 1.1, abs(u))
        return smoothstep(mv + 0.01, mv - p["close_band"], v) * horiz * smoothstep(-0.45, 0.1, f)

    def rotate_jaw(c, a):
        d = c - hinge
        return Vector((c.x, hinge.y + d.y * math.cos(a) - d.z * math.sin(a),
                       hinge.z + d.y * math.sin(a) + d.z * math.cos(a)))

    open_pose, closing = {}, {}
    if open_model:
        for vtx in obj.data.vertices:
            w = close_w(*norm(vtx.co))
            if w > 0:
                open_pose[vtx.index] = vtx.co.copy()
                closing[vtx.index] = w
                vtx.co = rotate_jaw(vtx.co, -ang * w)
        print(f"[rig] open-mouth model: closed rest pose built ({len(open_pose)} verts)")

    if not obj.data.shape_keys:
        obj.shape_key_add(name="Basis", from_mix=False)
    basis = [v.co.copy() for v in obj.data.vertices]
    inv = obj.matrix_world.inverted()

    cur = [0]  # index of the vertex being displaced (read by index-aware shapes)

    def add_key(name, displace):
        key = obj.shape_key_add(name=name, from_mix=False)
        moved = 0
        for i, co in enumerate(basis):
            cur[0] = i
            if i >= n_head and name not in ("JawOpen", "JawLeft", "JawRight"):
                continue  # the mouth interior only follows the jaw
            w_co = obj.matrix_world @ co
            new = displace(w_co, *norm(w_co))
            if new is not None:
                key.data[i].co = inv @ new
                moved += 1
        print(f"[rig] {name}: {moved} verts")

    def region(u, v, cu, cv, ru, rv):
        d = math.hypot((u - cu) / ru, (v - cv) / rv)
        return smoothstep(1.0, 0.35, d)

    W2, HH = 2 * hw, H
    eu, ev, er = p["eye_u"], p["eye_v"], p["eye_r"]
    erv = er * hw / H  # eye radius in v units (keeps eyes round)

    # --- jaw: everything below the mouth line, front half ---
    hinge = Vector((0, cy - p["jaw_hinge_f"] * hd, mn.z + p["jaw_hinge_v"] * H))
    ang = math.radians(p["jaw_angle_deg"])

    def jaw_w(u, v, f):
        i = cur[0]
        # Only the side of the slit below the mouth moves; which side a vertex is on
        # comes from its faces, so the two copies of a split edge separate cleanly.
        if not below.get(i, False) or v > mv + 0.03:
            return 0.0
        sw = mu * p["slit_width"]
        # Horizontal: full weight across the slit, easing to 0 over a wide band past
        # the corners, so the corners stretch gently instead of tearing.
        horiz = smoothstep(sw + p["corner_soft"], sw * 0.85, abs(u))
        # Vertical: lips and chin move fully, fading out toward the neck.
        vert = smoothstep(mv - p["jaw_depth_v"], mv - p["jaw_depth_v"] * 0.35, v)
        if i in sock_idx:
            return horiz  # inside the mouth: no depth/neck fade
        depth = smoothstep(-0.35, 0.15, f)
        return horiz * vert * depth

    def jaw_open(c, u, v, f):
        if open_model:
            o = open_pose.get(cur[0])
            return None if o is None else obj.matrix_world @ o
        w = jaw_w(u, v, f)
        if w <= 0:
            return None
        a = ang * w  # front (-Y) swings down (-Z)
        d = c - hinge
        return Vector((c.x, hinge.y + d.y * math.cos(a) - d.z * math.sin(a),
                       hinge.z + d.y * math.sin(a) + d.z * math.cos(a)))
    add_key("JawOpen", jaw_open)

    def jaw_side(sign):
        def fn(c, u, v, f):
            w = closing.get(cur[0], 0.0) if open_model else jaw_w(u, v, f)
            return None if w <= 0 else Vector((c.x + sign * p["jaw_shift"] * W2 * w, c.y, c.z))
        return fn
    add_key("JawLeft", jaw_side(+1))
    add_key("JawRight", jaw_side(-1))

    def front(f):
        return smoothstep(p["front_min_f"] - 0.15, p["front_min_f"] + 0.1, f)

    # --- mouth corners ---
    def corner(side, dz, dx, cheek=0.0):
        def fn(c, u, v, f):
            w = region(u, v, side * mu, mv, p["corner_r"], p["corner_r"] * 0.8) * front(f)
            # Smiles also lift and push the cheek above the corner a little.
            wc = cheek * region(u, v, side * (mu + 0.06), mv + 0.12, p["corner_r"] * 1.8, 0.12) * front(f)
            if w <= 0 and wc <= 0:
                return None
            return Vector((c.x + side * dx * W2 * w, c.y - wc * 0.02 * 2 * hd, c.z + dz * HH * w + wc * dz * 0.5 * HH))
        return fn
    add_key("MouthSmileLeft", corner(+1, p["smile_lift"], p["smile_out"], cheek=1.0))
    add_key("MouthSmileRight", corner(-1, p["smile_lift"], p["smile_out"], cheek=1.0))
    add_key("MouthFrownLeft", corner(+1, -p["smile_lift"], -p["smile_out"] * 0.5))
    add_key("MouthFrownRight", corner(-1, -p["smile_lift"], -p["smile_out"] * 0.5))

    def pucker(c, u, v, f):
        w = region(u, v, 0, mv, mu * 1.6, p["corner_r"]) * front(f)
        if w <= 0:
            return None
        return Vector((c.x * (1 - 0.35 * w) + cx * 0.35 * w, c.y - p["pucker_fwd"] * 2 * hd * w, c.z))
    add_key("LipsPucker", pucker)

    def puff(c, u, v, f):
        w = max(region(u, v, s * (mu + 0.18), mv + 0.06, 0.28, 0.16) for s in (-1, 1)) * front(f)
        if w <= 0:
            return None
        return Vector((c.x + math.copysign(p["puff_out"] * W2 * w, u), c.y - p["puff_out"] * 2 * hd * w, c.z))
    add_key("Puff", puff)

    # --- eyes ---
    def eye(side, scale):
        ez = mn.z + ev * H

        def fn(c, u, v, f):
            w = region(u, v, side * eu, ev, er * 1.15, erv * 1.6) * front(f)
            if w <= 0:
                return None
            # Real lids: the upper lid travels most of the way, the lower one about a third.
            k = 1.0 if c.z >= ez else p["lower_lid"]
            return Vector((c.x, c.y, ez + (c.z - ez) * (1 + (scale - 1) * w * k)))
        return fn
    add_key("EyeBlinkLeft", eye(+1, 1 - p["blink_squash"]))
    add_key("EyeBlinkRight", eye(-1, 1 - p["blink_squash"]))
    add_key("EyeOpenLeft", eye(+1, 1 + p["eye_wide"]))
    add_key("EyeOpenRight", eye(-1, 1 + p["eye_wide"]))

    # --- brows: band just above each eye ---
    bv = ev + erv * 1.3 + p["brow_gap"]

    def brow(side, dz, inward):
        def fn(c, u, v, f):
            w = region(u, v, side * eu, bv, er * 1.4, p["brow_rv"]) * front(f) * smoothstep(p["brow_cap_v"], p["brow_cap_v"] - 0.05, v)
            return None if w <= 0 else Vector((c.x - side * inward * W2 * w, c.y, c.z + dz * HH * w))
        return fn
    add_key("BrowsUpLeft", brow(+1, p["brow_lift"], 0))
    add_key("BrowsUpRight", brow(-1, p["brow_lift"], 0))
    add_key("BrowsDownLeft", brow(+1, -p["brow_lift"] * 0.8, 0.02))
    add_key("BrowsDownRight", brow(-1, -p["brow_lift"] * 0.8, 0.02))

    # Rest pose: every shape key at 0. Non-metal look: generators often ship metallicFactor 1,
    # which renders as chrome under an envmap.
    for kb in obj.data.shape_keys.key_blocks[1:]:
        kb.value = 0.0
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type == "BSDF_PRINCIPLED":
                metal = node.inputs["Metallic"]
                for link in list(metal.links):
                    mat.node_tree.links.remove(link)
                metal.default_value = 0.0

    # Additive displays (Specs) render dark albedo as see-through: optionally lift it.
    lift = p.get("albedo_lift", 0)
    if lift:
        import numpy as np
        done = set()
        for mat in bpy.data.materials:
            if not mat.use_nodes:
                continue
            for node in mat.node_tree.nodes:
                if node.type != "BSDF_PRINCIPLED" or not node.inputs["Base Color"].links:
                    continue
                src_node = node.inputs["Base Color"].links[0].from_node
                img = getattr(src_node, "image", None)
                if img is None or img.name in done:
                    continue
                px = np.empty(len(img.pixels), dtype=np.float32)
                img.pixels.foreach_get(px)
                rgba = px.reshape(-1, 4)
                rgba[:, :3] = np.clip(np.power(rgba[:, :3], 1.0 / (1.0 + lift)) * (1.0 + 0.5 * lift), 0, 1)
                img.pixels.foreach_set(rgba.ravel())
                img.update()
                cap = int(p.get("max_texture_px", 2048))
                if max(img.size) > cap:
                    img.scale(cap, cap)
                img.pack()
                done.add(img.name)
                print(f"[rig] albedo lifted x{lift}: {img.name}")

    # Ambient occlusion: Tripo packs AO in the R channel of its ORM map. Blender only
    # exports glTF occlusion through a "glTF Material Output" group, so wire it up.
    if "glTF Material Output" in bpy.data.node_groups:
        ao_group = bpy.data.node_groups["glTF Material Output"]
    else:
        ao_group = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
        ao_group.interface.new_socket(name="Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        nt = mat.node_tree
        bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if not bsdf or not bsdf.inputs["Roughness"].links:
            continue
        sep = bsdf.inputs["Roughness"].links[0].from_node
        tex = sep.inputs[0].links[0].from_node if sep.inputs and sep.inputs[0].links else None
        if tex is None or tex.type != "TEX_IMAGE":
            continue
        ao_sep = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(tex.outputs["Color"], ao_sep.inputs[0])
        out = nt.nodes.new("ShaderNodeGroup")
        out.node_tree = ao_group
        nt.links.new(ao_sep.outputs[0], out.inputs["Occlusion"])
        print(f"[rig] occlusion wired from {tex.image.name if tex.image else '?'}")

    # Bottom fade: COLOR_0 multiplies base colour (glTF spec). Going to black at the base
    # makes the neck dissolve on an additive display; alpha fades too for alpha-blended use.
    fade_v = p.get("fade_v", 0.25)
    if fade_v > 0:
        me = obj.data
        attr = me.color_attributes.new(name="Col", type="BYTE_COLOR", domain="POINT")
        for vtx in me.vertices:
            k = smoothstep(0.0, fade_v, (vtx.co.z - mn.z) / H)
            attr.data[vtx.index].color = (k, k, k, k)
        me.color_attributes.active_color = attr
        print(f"[rig] bottom fade baked (fade over the lowest {int(fade_v * 100)}%)")

    # Keep Lens size sane: every texture capped and re-encoded as JPEG.
    cap = int(p.get("max_texture_px", 2048))
    for img in bpy.data.images:
        if img.size[0] and max(img.size) > cap:
            img.scale(cap, cap)
    bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_morph=True,
                              export_image_format="JPEG", export_jpeg_quality=90,
                              export_morph_normal=True, use_selection=False,
                              export_vertex_color="ACTIVE", export_all_vertex_colors=False)
    print("[rig] wrote", dst, "bbox_cm", round(2 * hw * 100, 1), round(H * 100, 1), round(2 * hd * 100, 1))


main()
