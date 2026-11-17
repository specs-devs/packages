"""Review contact sheet for a rigged head: rows = poses, columns = front / 45° / side.
Usage: blender -b -P review_sheet.py -- in.glb out.png [Pose=Key:w,Key:w ...]
Default rows: Rest, JawOpen=1. Each extra arg adds a row, e.g. Smile=MouthSmileLeft:1,MouthSmileRight:1
"""
import math
import sys

import bpy
import numpy as np
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
src, dst = args[0], args[1]
rows = [("Rest", {}), ("JawOpen", {"JawOpen": 1.0})]
for spec in args[2:]:
    name, keys = spec.split("=")
    rows.append((name, {k: float(w) for k, w in (kv.split(":") for kv in keys.split(","))}))
YAWS = (0, 45, 90)
CELL = 360

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
center, size = (mn + mx) / 2, max(mx - mn)

sc = bpy.context.scene
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.color_type = "TEXTURE"
sc.display.shading.light = "STUDIO"
sc.display.shading.show_backface_culling = True
sc.render.resolution_x = sc.render.resolution_y = CELL
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cam.data.type = "ORTHO"
cam.data.ortho_scale = size * 1.1
sc.collection.objects.link(cam)
sc.camera = cam

sheet = np.ones((CELL * len(rows), CELL * len(YAWS), 4), dtype=np.float32)
tmp = dst + ".cell.png"
for r, (_, pose) in enumerate(rows):
    for o in objs:
        if o.data.shape_keys:
            for kb in o.data.shape_keys.key_blocks[1:]:
                kb.value = pose.get(kb.name, 0.0)
    for c, yaw in enumerate(YAWS):
        # glTF +Z (face front) is Blender -Y; yaw swings the camera toward the character's left.
        a = math.radians(yaw)
        cam.location = center + Vector((math.sin(a), -math.cos(a), 0)) * size * 3
        cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = tmp
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(tmp)
        px = np.array(img.pixels[:], dtype=np.float32).reshape(CELL, CELL, 4)
        bpy.data.images.remove(img)
        row0 = (len(rows) - 1 - r) * CELL  # image rows start at the bottom
        sheet[row0:row0 + CELL, c * CELL:(c + 1) * CELL] = px
out = bpy.data.images.new("sheet", CELL * len(YAWS), CELL * len(rows), alpha=True)
out.pixels[:] = sheet.ravel()
out.filepath_raw = dst
out.file_format = "PNG"
out.save()
print("[review] wrote", dst)
