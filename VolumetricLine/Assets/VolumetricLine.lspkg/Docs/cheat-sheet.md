# VolumetricLine cheat sheet

[← Agent usage index](../README.md)

## Use when

Read this first before wiring a line.

1. Wire at least two distinct, non-null path points and a material before OnStartEvent. Late assignment has no public setup retry. → [Lifecycle](lifecycle.md)
2. Prefer the authored example prefab or an authored component; createComponent followed by assigning inputs depends on lifecycle timing and is unverified. → [Examples](examples.md)
3. Default world+relative positioning maps points through the line root's inverse world transform, so the root may be moved, rotated and scaled. Radius is in the root's local units and scales with it. → [Lifecycle](lifecycle.md)
4. Color writes target the assigned material directly; separate material instances if lines need independent colors. Neither shipped material (Rainbow.mat, PBR.mat) has a `baseColor`, so `color` only works with your own material that exposes one. → [Troubleshooting](troubleshooting.md)
5. smoothUpdate=true ignores updateRate and rebuilds MeshBuilder geometry every frame. Throttling requires smoothUpdate=false. → [Lifecycle](lifecycle.md)
6. VolumetricLine.positionSmoothing uses 1-value as lerp weight; RandomPositionAnimator.smoothing uses value directly. Their endpoints differ. → [Components](components.md)
7. Do not grow geometry without accounting for UInt16 indices; the example already uses 400 interpolation steps. → [Lifecycle](lifecycle.md)
8. Public diagnostic methods mutate actual point positions/modes; do not treat them as read-only tests. → [Components](components.md)
9. The example prefab is about 1 m tall (points y −45…57 cm, ±10 cm drift) at z −90. On Specs, scale the root (the QA demo uses 0.35 at z −110) so the whole tube fits the field of view. → [Examples](examples.md)
