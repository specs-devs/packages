"""Transfer learned Face Mesh expression fields onto a generated head as shape keys.

Usage:
  blender -b -P transfer_expression_fields.py -- head_rigged.glb facemesh.obj fields.npz head_params.json out.glb
- head_rigged.glb: output of rig_head_blendshapes.py (closed-mouth basis + JawOpen etc.).
  Its JawOpen key is kept (it blends to the modelled open mouth); every other shape key is
  replaced by learned fields named after the Lens Expressions.
- facemesh.obj: Face Mesh topology (triangles); fields.npz: solve_expression_fields.py output.
- head_params.json: the head's landmark file (eye_u, eye_v, mouth_u, mouth_v ...).
Head space (after rig): glTF +Z front, Y up. Face Mesh space: Lens cm, Y up, +Z toward viewer.
"""
import json
import sys

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

KEEP = {"JawOpen"}
SHAPES = [
    "EyeBlinkLeft", "EyeBlinkRight", "EyeSquintLeft", "EyeSquintRight", "EyeOpenLeft", "EyeOpenRight",
    "BrowsDownLeft", "BrowsDownRight", "BrowsUpCenter", "BrowsUpLeft", "BrowsUpRight",
    "JawLeft", "JawRight", "JawForward",
    "MouthSmileLeft", "MouthSmileRight", "MouthFrownLeft", "MouthLeft", "MouthRight",
    "MouthDimpleLeft", "MouthDimpleRight", "MouthStretchLeft", "MouthStretchRight",
    "UpperLipUpLeft", "UpperLipUpRight", "LowerLipDownLeft", "LowerLipDownRight",
    "LipsPucker", "LipsFunnel", "Puff", "SneerLeft", "SneerRight", "CheekSquintLeft",
]
DEFAULTS = {"gain": 1.6, "fade_near_cm": 1.5, "fade_far_cm": 5.0}


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def main():
    a = sys.argv[sys.argv.index("--") + 1:]
    head_path, obj_path, npz_path, params_path, out_path = a[:5]
    hp = json.load(open(params_path))
    p = dict(DEFAULTS)
    p.update(hp.get("transfer", {}))

    data = np.load(npz_path, allow_pickle=True)
    names = [str(n) for n in data["names"]]
    neutral = data["neutral"]            # V x 3, Lens face space (cm)
    fields = data["fields"]              # K x V x 3
    tris = [[int(t.split("/")[0]) - 1 for t in line.split()[1:4]] for line in open(obj_path) if line.startswith("f ")]

    # Face landmarks from where the fields move most (left = +X in Lens face space).
    def centroid(field_names, top=40):
        m = sum(np.linalg.norm(fields[names.index(n)], axis=1) for n in field_names)
        idx = np.argsort(m)[-top:]
        return neutral[idx].mean(axis=0)
    eyeL, eyeR = centroid(["EyeBlinkLeft"]), centroid(["EyeBlinkRight"])
    mouth = centroid(["UpperLipUpLeft", "UpperLipUpRight", "LowerLipDownLeft", "LowerLipDownRight"])
    f_eye_y, f_mouth_y = (eyeL[1] + eyeR[1]) / 2, mouth[1]
    f_eye_dx = abs(eyeL[0] - eyeR[0]) / 2
    f_front_z = neutral[:, 2].max()
    print(f"[transfer] face landmarks: eye y {f_eye_y:.1f} dx {f_eye_dx:.1f}, mouth y {f_mouth_y:.1f}, front z {f_front_z:.1f}")

    # Head (Blender coords after glTF import: x, -z_gl, y_gl). Work in glTF axes for clarity.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=head_path)
    obj = next(o for o in bpy.context.scene.objects if o.type == "MESH")
    me = obj.data
    keys = me.shape_keys.key_blocks
    basis = np.array([[v.co.x, v.co.z, -v.co.y] for v in keys[0].data])  # glTF axes, metres
    mn, mx = basis.min(0), basis.max(0)
    hw, H = (mx[0] - mn[0]) / 2, mx[1] - mn[1]
    cx = (mn[0] + mx[0]) / 2
    h_eye_y = mn[1] + hp["eye_v"] * H
    h_mouth_y = mn[1] + hp["mouth_v"] * H
    h_eye_dx = hp["eye_u"] * hw

    # Per-axis affine head -> face space (cm), landmark-matched.
    sy = (f_eye_y - f_mouth_y) / max(1e-6, h_eye_y - h_mouth_y)
    by = f_eye_y - sy * h_eye_y
    sx = f_eye_dx / max(1e-6, h_eye_dx)
    sz = sx
    bz = f_front_z - sz * mx[2]
    face_pts = np.stack([(basis[:, 0] - cx) * sx, basis[:, 1] * sy + by, basis[:, 2] * sz + bz], axis=1)

    bvh = BVHTree.FromPolygons([Vector(v) for v in neutral], tris)
    V = len(basis)
    tri_idx = np.zeros((V, 3), dtype=int)
    bary = np.zeros((V, 3))
    dist = np.zeros(V)
    for i in range(V):
        loc, _, fi, d = bvh.find_nearest(Vector(face_pts[i]))
        t = tris[fi]
        A, B, C = (neutral[j] for j in t)
        v0, v1, v2 = B - A, C - A, np.array(loc) - A
        d00, d01, d11 = v0 @ v0, v0 @ v1, v1 @ v1
        d20, d21 = v2 @ v0, v2 @ v1
        den = d00 * d11 - d01 * d01 or 1e-9
        bv = (d11 * d20 - d01 * d21) / den
        bw = (d00 * d21 - d01 * d20) / den
        tri_idx[i], bary[i], dist[i] = t, (1 - bv - bw, bv, bw), d
    fade = smoothstep(p["fade_far_cm"], p["fade_near_cm"], dist)
    print(f"[transfer] {int((fade > 0.5).sum())}/{V} head verts follow the face (fade at {p['fade_near_cm']}-{p['fade_far_cm']} cm)")

    # Replace learned-able keys; keep Basis + JawOpen.
    for kb in list(keys)[1:]:
        if kb.name not in KEEP:
            obj.shape_key_remove(kb)
    inv = np.array([1 / sx, 1 / sy, 1 / sz])  # face cm -> head metres per axis (s* are cm per metre)
    for name in SHAPES:
        if name not in names:
            continue
        f = fields[names.index(name)]
        if not np.any(f):
            continue
        dgl = (f[tri_idx] * bary[:, :, None]).sum(axis=1) * inv * p["gain"] * fade[:, None]
        dgl[np.linalg.norm(dgl, axis=1) < 2e-4] = 0.0  # under 0.2 mm: drop (keeps sparse targets small)
        kb = obj.shape_key_add(name=name, from_mix=False)
        co = basis + dgl
        flat = np.stack([co[:, 0], -co[:, 2], co[:, 1]], axis=1).ravel()  # back to Blender axes
        kb.data.foreach_set("co", flat)
        kb.value = 0.0
    print(f"[transfer] shape keys: {[k.name for k in me.shape_keys.key_blocks[1:]]}")
    # Sparse morph targets (only moved vertices) and no morph normals keep the GLB small.
    bpy.ops.export_scene.gltf(filepath=out_path, export_format="GLB", export_morph=True, export_morph_normal=False,
                              export_try_sparse_sk=True,
                              export_image_format="JPEG", export_jpeg_quality=90, use_selection=False,
                              export_vertex_color="ACTIVE")
    print("[transfer] wrote", out_path)


main()
