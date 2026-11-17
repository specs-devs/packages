"""Turn a generated head into a Lens Studio Face Morph (External Face Mesh) head.

For every head vertex, find the nearest point on Lens's Face Mesh and store that
point's Face Mesh UV as a second UV set (TEXCOORD_1). Lens Studio then deforms the
whole head with the tracked face: set the Face Mesh asset's External Mesh to this
mesh and External Mesh Map UV to Texcoord1.

Usage:
  blender -b -P facemorph_map.py -- head_rigged.glb facemesh.obj out.glb [params.json]
The head should be the closed-mouth rest pose (rig_head_blendshapes.py output); its
shape keys are dropped, since the Face Mesh now drives the motion.
facemesh.obj is the Face Mesh dump (Head Binding space, cm, Y up, Z toward viewer).
"""
import json
import sys

import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

DEFAULTS = {
    "fit_height": 1.15,     # head height relative to the Face Mesh height (chin to skull top)
    "offset_cm": [0, 0, 0], # extra nudge in Face Mesh space (x right, y up, z toward viewer)
    "export_scale": 100.0,  # bake cm into the raw mesh data (External Face Mesh reads raw units)
}


def gl_to_blender(x, y, z):
    """glTF/Lens (Y up, +Z toward viewer) -> Blender (Z up, -Y toward viewer)."""
    return Vector((x, -z, y))


def main():
    argv = sys.argv[sys.argv.index("--") + 1:]
    head_path, face_path, out_path = argv[:3]
    p = dict(DEFAULTS)
    if len(argv) > 3:
        with open(argv[3]) as fh:
            p.update(json.load(fh))

    # --- Face Mesh (cm -> m, Lens axes -> Blender axes) ---
    verts, uvs, tris = [], [], []
    for line in open(face_path):
        t = line.split()
        if not t:
            continue
        if t[0] == "v":
            verts.append(gl_to_blender(*[float(a) / 100.0 for a in t[1:4]]))
        elif t[0] == "vt":
            uvs.append((float(t[1]), float(t[2])))
        elif t[0] == "f":
            tris.append([int(a.split("/")[0]) - 1 for a in t[1:4]])
    bvh = BVHTree.FromPolygons(verts, tris)
    fmn = Vector((min(v.x for v in verts), min(v.y for v in verts), min(v.z for v in verts)))
    fmx = Vector((max(v.x for v in verts), max(v.y for v in verts), max(v.z for v in verts)))
    fcenter, fheight = (fmn + fmx) / 2, fmx.z - fmn.z

    # --- Head ---
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=head_path)
    obj = next(o for o in bpy.context.scene.objects if o.type == "MESH")
    bpy.context.view_layer.objects.active = obj
    if obj.data.shape_keys:
        obj.shape_key_clear()  # keeps the basis (closed-mouth rest pose)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    me = obj.data
    hmn = Vector((min(v.co.x for v in me.vertices), min(v.co.y for v in me.vertices), min(v.co.z for v in me.vertices)))
    hmx = Vector((max(v.co.x for v in me.vertices), max(v.co.y for v in me.vertices), max(v.co.z for v in me.vertices)))
    hcenter, hheight = (hmn + hmx) / 2, hmx.z - hmn.z

    # Align the head onto the Face Mesh: same center, height scaled by fit_height.
    s = fheight * p["fit_height"] / hheight
    off = gl_to_blender(*[c / 100.0 for c in p["offset_cm"]])
    for v in me.vertices:
        v.co = (v.co - hcenter) * s + fcenter + off

    # --- Second UV set = Face Mesh UV at the nearest Face Mesh point ---
    map_uv = me.uv_layers.new(name="FaceMeshMap")
    bm = bmesh.new()
    bm.from_mesh(me)
    layer = bm.loops.layers.uv[map_uv.name]
    cache, far = {}, 0
    for vert in bm.verts:
        hit = bvh.find_nearest(vert.co)
        if hit[0] is None:
            continue
        loc, _, fi, dist = hit
        a, b, c = tris[fi]
        uvw = barycentric_transform(loc, verts[a], verts[b], verts[c],
                                    Vector((*uvs[a], 0)), Vector((*uvs[b], 0)), Vector((*uvs[c], 0)))
        cache[vert.index] = (uvw.x, uvw.y)
        if dist > 0.03:
            far += 1
    for face in bm.faces:
        for loop in face.loops:
            uv = cache.get(loop.vert.index)
            if uv:
                loop[layer].uv = uv
    bm.to_mesh(me)
    bm.free()
    print(f"[facemorph] mapped {len(cache)} verts (scale {s:.3f}); {far} are >3 cm from the Face Mesh")

    for v in me.vertices:
        v.co *= p["export_scale"]

    bpy.ops.export_scene.gltf(filepath=out_path, export_format="GLB", use_selection=False,
                              export_image_format="JPEG", export_jpeg_quality=90,
                              export_texcoords=True, export_morph=False)
    print("[facemorph] wrote", out_path)


main()
