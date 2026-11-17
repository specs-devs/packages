# How the heads were made

[← Agent usage index](../README.md)

The four heads come from the Lens Studio **Head Generator** (Lens Studio AI → GenAI Home Page → Head Generator), then a few Blender passes. The Blender scripts live next to the project in `Tools/` (not shipped in the package); run them with `blender -b -P <script> -- …`.

## Prompts

| Head | Head Generator prompt |
| --- | --- |
| Capybara | 1 capybara head, brown fur, realistic portrait, highres, hipoly model |
| Egg Guy | 1 egg head, big googly eyes, white eggshell, smooth glossy, highres, hipoly model |
| Frog | 1 frog head, green glossy skin, big round eyes, wide mouth, pixar style, highres, hipoly model |
| Pirate Shark | 1 shark head, grey-blue skin, pirate tricorn hat, sharp teeth, highres, hipoly model |

## Pipeline

1. **`render_front.py`**: orthographic front render with a 10% grid, to read eye / mouth positions in the rig's normalized space.
2. **`rig_head_blendshapes.py`** with `Tools/heads/<Head>.json` (eye / mouth / jaw positions, target height, mouth mode): adds expression shape keys named after the Lens `Expressions` enum.
3. **`review_sheet.py`**: contact sheet of poses (front / 45° / side) to check the rig.
4. Optional, learned expressions: record Face Mesh data in Lens Studio with `FaceMeshExamplesDebugFaceMesh.recordSeconds`, solve per-expression motion fields with **`solve_expression_fields.py`**, and transfer them onto the head with **`transfer_expression_fields.py`**.
5. **`bake_neck_fade.py`**: bakes a fade to black toward the neck into the base-colour texture (black is see-through on SPECS).
6. Optional, Face Morph instead of shape keys: **`facemorph_map.py`** maps each head vertex to the nearest Face Mesh UV so Lens Studio deforms the whole head with the tracked face.
