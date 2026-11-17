# Instantiation API status

[← Agent usage index](../README.md)

## Use when

Check this file before reusing an older Instantiation example. It describes
the package revision that contains it.

## Status meanings

- **Current** — recommended public surface for new work.
- **Deprecated** — still present; migrate to the named replacement.
- **Experimental** — public, but compatibility is not guaranteed.
- **Removed** — unavailable in this revision.
- **Internal** — resolvable but not supported API.

## Current API

| Capability | Current surface |
|---|---|
| 15 layouts (TS) | `Instantiation.lspkg/Scripts/TS/<Layout>TS` classes. Inputs as in [components](components.md) |
| 15 layouts (JS) | `Instantiation.lspkg/Scripts/JS/<Layout>JS.js` script assets, with the same inputs (no logging inputs) |
| Rotation-aware placement | The 12 center-based layouts follow the center's world rotation (new in this revision) |
| Ready-made examples | `Instantiation__PLACE_IN_SCENE.prefab`; spawn prefabs `ExamplePrefabInstantiateSphere`, `…Sphere2`, `…Box1`, `…Box2` |

## Deprecated

| Deprecated surface | Current replacement |
|---|---|
| `CirclePerimeterInstantiatorWithFixedArcLength.arcLength` | Still serialized, but unused. Set `numberOfPrefabs` + `arcAngleSpan` |

## Experimental

No surface is designated Experimental in this revision.

## Removed

| Removed / never-shipped surface (older README) | Replacement |
|---|---|
| Import `Instantiation.lspkg/TS/<Name>` | `Instantiation.lspkg/Scripts/TS/<Name>` |
| `createComponent("InstantiateOn3DGridsTS")` (string name) | `createComponent(InstantiateOn3DGridsTS.getTypeName())` |
| 3D grid `rows` / `columns` / `layers` / `spacing` / `center` | `gridWidth` / `gridHeight` / `gridDepth`, `spacingX/Y/Z`, `gridCenter` |
| `RandomPointsInsideSphereTS.center` / `numberOfPrefabs` | `sphere` / `numberOfPoints` |
| `InstantiateAlongLineTS.numberOfPrefabs` / `instantiatePrefabs()` | `numberOfObjects` / `instantiateObjectsAlongLine()` |
| `onInstantiated` event | None. Read the instantiator's children after its OnStart ([examples](examples.md)) |
| "Orient objects along the line" | Not implemented. Rotate the copies yourself |
| `Scripts/GuideDismissPanel/GuideDismissPanel.ts` (old guide copy) | none; it was unused sample scaffolding |

## Internal

- `RuntimeGizmos/Line.ts` (class `Line`) is a demo helper that draws the line in
  `[InstantiateAlongLine]`. For line gizmos, use the RuntimeGizmos package.
- `onStart()` and the per-layout spawn methods are public in TS, but they are
  lifecycle hooks: calling them spawns another layout.
- Private helpers (`createPrefabInstance`, `lerp`, `randomPointInside*`, sphere/capsule
  probes) are implementation details.

## Notes for this revision

- Fixed: every TS layout used to spawn twice (`onStart` was bound twice).
- Fixed: a line with `numberOfObjects = 1` or coincident endpoints, and slicing
  with `yElementsPerSlice = 1`, gave NaN positions.
- Fixed: a 360° `CirclePerimeterInstantiatorWithFixedArcLength` placed its last
  copy on the first, and slicing doubled a copy at every corner.
- Fixed: `SimpleColliderInstantiator` sized its volume from the target's world
  scale (wrong under rotated, non-uniformly scaled parents); it now samples the
  target's local unit shape through its world transform.
- The 2D grid's Inspector hints now say X–Y (the layout was always X–Y).
- Prefab defaults now fit Specs: CircleArea radius 40, 2D grid 5 × 5 @ 10 cm,
  and SimpleCollider `randomScaleVariation` 0.8. The group
  `[SimpleColliderInstantiatoreditor]` was renamed `[SimpleColliderInstantiator]`.
