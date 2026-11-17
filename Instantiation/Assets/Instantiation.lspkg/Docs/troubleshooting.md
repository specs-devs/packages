# Instantiation troubleshooting

[← Agent usage index](../README.md)

## Use when

A layout spawns nothing, too much, in the wrong place or at the wrong size.
Generic prefab, scene and rendering issues belong to the relevant CLAD skill
(`lens-debug`, `lens-api`).

## Known issues

| Symptom | Package cause | Package fix |
|---|---|---|
| `Cannot find module 'Instantiation.lspkg/TS/…'` | The TS scripts live under `Scripts/TS/` | Import `Instantiation.lspkg/Scripts/TS/<Name>TS` |
| Every copy appears twice (40 instead of 20) | Older revision bound `onStart` twice. Or the TS **and** the JS twin are both enabled. Or your code also called the spawn method | Update the package; enable one twin; don't call `instantiate…()` in addition to the automatic start spawn |
| Nothing spawns, no error | `center` / `gridCenter` / `sphere` / `boxObject` / `prefab` / endpoints unassigned. The skip is silent unless `enableLogging` (TS) is on; JS `print`s an error | Wire the references, or the group is disabled in the prefab (only the 3D grid is enabled) |
| The layout is far too big or cut off on Specs | Sizes are world cm, and old prefab defaults were 2 m / 4.5 m | Use about 40–60 cm layouts; this revision's prefab already uses smaller values |
| The 2D grid stands upright instead of lying flat | It's laid out in the center's X–Y plane | Rotate `gridCenter` −90° about X to lay it flat |
| The layout ignores the center's scale | By design: offsets are absolute cm | Change `radius` / spacing / size instead |
| A rotated center gave a world-aligned layout | Older revision ignored rotation | Fixed: the 12 center-based layouts follow the center's rotation |
| `arcLength` has no effect | It's not used (kept for serialized scenes) | Use `numberOfPrefabs` + `arcAngleSpan` |
| SimpleCollider fills a 1 cm box | The volume is the target's local unit cube, so an unscaled target is 1 cm; the collider size isn't read | Scale the target (for example a unit cube scaled to 40) |
| SimpleCollider ignores a sphere/capsule collider | Shape detection reads component type names; capsule (and undetected shapes) fall back to box sampling | Use a box target, or a scaled sphere-like target, and check the result |
| SimpleCollider copies lose their prefab scale | With `prefabScale ≠ 1` or a variation, local scale is overwritten | Bake the size into the prefab mesh, or set `prefabScale` to the wanted absolute scale |
| Huge SimpleCollider copies | `randomScaleVariation` above 1 (the old prefab used 8) | Keep it within 0–1 |
| Line copies don't follow moved endpoints | Endpoints are read once at start | Respawn ([examples](examples.md)) |

## Verification

After a fix, preview and count the instantiator's children: the count must
match the configured number. Look at the layout from the user's start position
to confirm that it is fully visible.
