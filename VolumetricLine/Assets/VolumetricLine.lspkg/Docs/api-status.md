# VolumetricLine API status

[← Agent usage index](../README.md)

## Use when

Check the contract and gaps of the current package source.

| Status | Surface | Evidence / limits |
|---|---|---|
| Current | VolumetricLine, RandomPositionAnimator and their declared members | Source-derived reference in [components](components.md). No formal deprecation annotation found. |
| Current | Example prefab and PBR/Rainbow material assets (`Materials/Rainbow.mat` on `Shaders/Rainbow.graphShader`, `Materials/PBR.mat` on `Shaders/pbr.graphShader`) | Preview-verified 2026-10-01: the tube renders through the four moving points with round, capped ends. Rainbow.mat cycles hue over time (params size/speed/rotationAngle/opacityTex) and PBR.mat is texture-driven (baseTex/normalTex/materialParamsTex); neither has `baseColor`, so `color` has no visible effect with the shipped materials. The point cubes use SIK's BoxMesh. |
| Changed | World+relative positioning | Points are mapped through the line root's inverse world transform, so position, rotation **and scale** are respected (unchanged at unit scale). |
| Current, initialization-sensitive | Runtime creation mentioned by the historical tutorial | Rendering setup occurs only onStart with valid points. No public initializer/retry; createComponent timing not verified. |
| Diagnostic | forceRefresh, setTestPositions, testPositionModes, resetOffsetDetection, setManualOffset | Can rebuild or mutate scene state; forceRefresh assumes a mesh visual already exists. |
| Moved | `Scripts/GuideDismissPanel` → `Example/GuideDismissPanel/` | The guide helper now lives in `Example/GuideDismissPanel/GuideDismissPanel.ts` and the prefab ships its own `Guide` object again (see [components](components.md#demo-scaffolding-example)). The old `Guide_ReadAndDisable` object is gone. |
| Performance gap | Memory estimates and smooth-mode optimization claims in historical tutorial | Not benchmarked. Source allocates a new MeshBuilder on every smooth update. |
| Deprecated / removed | None explicitly declared | Do not infer removed methods or renamed imports. |

There is no package-defined event API, tracking input, device-only capability or native module. No runtime/device readiness is established by the docs compiler. Radius/circleSegments setters do not enforce positive/integer values; Inspector annotations are not runtime validation. Adjacent duplicate points can produce invalid normalized tangents.
