# Raymarching performance

[← Agent usage index](../README.md)

A field is one draw call of a sphere. Its cost is **per pixel the sphere covers × steps × balls**.

- **Steps**: at most 32 per pixel, with early exit on hit and when the ray leaves the volume. Most pixels finish in a handful of steps.
- **Balls**: every step evaluates all 8 slots (off slots are one compare). Fewer active balls is cheaper, but the bigger win is pixel count.
- **Pixels**: the volume is fitted to the balls every frame. Balls spread far apart make a big sphere of mostly empty pixels — put separate groups in separate fields.
- **Normals and shading** run once per hit pixel (4 extra field evaluations).
- **Several fields**: each is its own volume and draw; overlapping volumes cost twice where they overlap.

Guidelines for SPECS: one or two fields on screen, balls within ~30 cm of each other, `fitMargin` small (1–2 cm). If the frame time rises, reduce the field's on-screen size first (fewer/closer balls), then `wobble` (it adds three `sin` per step).

Measure in the Lens Studio Preview's performance view or on device with Spectacles Monitor; compare with the example off.
