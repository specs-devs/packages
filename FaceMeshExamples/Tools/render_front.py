"""Orthographic front render of a GLB, framed exactly to its bounding box, with a
10% grid so feature positions can be read in the rig script's normalized space:
  u = -1 (image left = character's right) .. +1 (image right = character's left)
  v =  0 (bottom) .. 1 (top)
Usage: blender -b -P render_front.py -- in.glb out.png
"""
import sys

import bpy
import numpy as np
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
src, dst = args[:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
# Optional "Name=weight" args pose shape keys, e.g. JawOpen=1 EyeBlinkLeft=1
for kv in args[2:]:
    name, val = kv.split("=")
    for o in objs:
        keys = o.data.shape_keys
        if keys and name in keys.key_blocks:
            keys.key_blocks[name].value = float(val)
pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
c = (mn + mx) / 2
W, H = mx.x - mn.x, mx.z - mn.z

# glTF +Z (face front) is Blender -Y: camera on -Y looking toward +Y.
cam_data = bpy.data.cameras.new("cam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = max(W, H)
cam = bpy.data.objects.new("cam", cam_data)
bpy.context.scene.collection.objects.link(cam)
cam.location = Vector((c.x, mn.y - 1.0, c.z))
cam.rotation_euler = (1.5708, 0, 0)
cam_data.clip_end = 10
sc = bpy.context.scene
sc.camera = cam
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.color_type = "TEXTURE"
sc.display.shading.light = "FLAT"
sc.display.shading.show_backface_culling = True
base = 512
sc.render.resolution_x = int(base * W / max(W, H))
sc.render.resolution_y = int(base * H / max(W, H))
sc.render.filepath = dst
bpy.ops.render.render(write_still=True)

img = bpy.data.images.load(dst)
w, h = img.size
px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
for i in range(1, 10):
    col = (1, 0, 0, 1) if i == 5 else (0, 0.8, 1, 1)
    px[int(h * i / 10), :, :] = col          # v = i/10 (row 0 is the bottom)
    px[:, int(w * i / 10), :] = col          # u = -1 + 2*i/10
img.pixels[:] = px.ravel()
img.save()
