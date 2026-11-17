"""Bake a fade-to-black toward the neck into a head's base-colour texture.

On an additive display (Specs) black is see-through, so the bottom of the head
dissolves into the real background. The fade lives in the texture, so it works with
the stock imported material (which ignores vertex colours).

Usage: blender -b -P bake_neck_fade.py -- in.glb out.glb [fade_fraction=0.28] [floor=0.0]
  fade_fraction: lowest part of the head (by height) that fades out
  floor: brightness at the very bottom (0 = fully black / invisible)
"""
import sys

import bpy

args = sys.argv[sys.argv.index("--") + 1:]
src, dst = args[0], args[1]
fade = float(args[2]) if len(args) > 2 else 0.28
floor = float(args[3]) if len(args) > 3 else 0.0

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
obj = next(o for o in bpy.context.scene.objects if o.type == "MESH")
zs = [v.co.z for v in obj.data.vertices]
zmin, zmax = min(zs), max(zs)
z_fade_top = zmin + fade * (zmax - zmin)

sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.samples = 1
sc.cycles.device = "CPU"

for mat in obj.data.materials:
    if not mat or not mat.use_nodes:
        continue
    nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not bsdf or not bsdf.inputs["Base Color"].links:
        continue  # e.g. the flat mouth-interior material
    # The importer may route the texture through a vertex-colour multiply: walk upstream.
    tex, stack = None, [bsdf.inputs["Base Color"].links[0].from_node]
    while stack:
        n = stack.pop()
        if n.type == "TEX_IMAGE" and n.image:
            tex = n
            break
        for inp in n.inputs:
            stack += [l.from_node for l in inp.links]
    if tex is None:
        continue
    w, h = tex.image.size
    baked = bpy.data.images.new(tex.image.name + "_fade", w, h, alpha=False)

    # Emission = base texture * smooth gradient on object-space height.
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    rng = nt.nodes.new("ShaderNodeMapRange")
    rng.interpolation_type = "SMOOTHSTEP"
    rng.inputs["From Min"].default_value = zmin
    rng.inputs["From Max"].default_value = z_fade_top
    rng.inputs["To Min"].default_value = floor
    rng.inputs["To Max"].default_value = 1.0
    mul = nt.nodes.new("ShaderNodeMixRGB")
    mul.blend_type = "MULTIPLY"
    mul.inputs["Fac"].default_value = 1.0
    emit = nt.nodes.new("ShaderNodeEmission")
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    old_surface = out.inputs["Surface"].links[0].from_socket if out.inputs["Surface"].links else None
    nt.links.new(geo.outputs["Position"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], rng.inputs["Value"])
    nt.links.new(tex.outputs["Color"], mul.inputs["Color1"])
    nt.links.new(rng.outputs["Result"], mul.inputs["Color2"])
    nt.links.new(mul.outputs["Color"], emit.inputs["Color"])
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])

    target = nt.nodes.new("ShaderNodeTexImage")
    target.image = baked
    nt.nodes.active = target
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type="EMIT", margin=4)

    # Restore the PBR graph with the faded texture as base colour.
    if old_surface:
        nt.links.new(old_surface, out.inputs["Surface"])
    nt.links.new(target.outputs["Color"], bsdf.inputs["Base Color"])
    for n in (geo, sep, rng, mul, emit):
        nt.nodes.remove(n)
    baked.pack()
    print(f"[fade] baked {baked.name} ({w}x{h}), fading the lowest {int(fade * 100)}%")

bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_morph=True, export_morph_normal=False,
                          export_try_sparse_sk=True, export_image_format="JPEG", export_jpeg_quality=90,
                          use_selection=False)
print("[fade] wrote", dst)
