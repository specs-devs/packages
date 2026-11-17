# VolumetricLine troubleshooting

[← Agent usage index](../README.md)

## Use when

Diagnose a missing, displaced, frozen or clipped tube.

| Symptom | Source-supported cause | Action |
|---|---|---|
| No line after assigning points at runtime | onStart skipped setup; updateMesh has no initialization retry | Wire points/material before start and restart preview; runtime creation timing remains a gap. |
| Null reference in forceRefresh or point handling | Missing initialized mesh visual, null points or invalid path | Verify setup and every point; do not use forceRefresh as an initializer. |
| Lines change color together | Input material is mutated, not cloned | Assign independent material instances for independent appearance. |
| Tube off the points / wrong size under a scaled parent (before 2026-10-01) | Old relative transform ignored scale | Fixed: points use the root's inverse world transform. Update the package if you still see it. |
| updateRate seems ignored | smoothUpdate uses every-frame rebuild | Disable smoothUpdate for interval throttling. |
| Motion frozen at smoothing endpoint | Line uses 1-value; animator uses value | Use line positionSmoothing<1 and animator smoothing>0. |
| Animator-added objects never move | Cache created only in onAwake | Author and wire the full object array before awake; no public cache-reset method. |
| Invalid geometry or unexpectedly high cost | Adjacent duplicate points, excessive rings/segments, UInt16 indices | Keep distinct points and positive integer segments; calculate budget and measure on device. |
| `color` has no effect | Neither Rainbow.mat (hue cycles over time) nor PBR.mat (texture-driven) has a `baseColor`; the write is caught silently | Assign your own material with a `baseColor` parameter. |
| The four cubes are invisible | Box scale 10 × SIK BoxMesh = 10 cm = the tube's diameter (radius 5), so the cubes sit inside the tube | Expected. Lower `radius` or scale the cubes up to see the control points. |
| Only part of the tube shows, or an end looks cut flat | The ~1 m example leaves the Specs field of view (about ±18° vertically) | Scale the root down and/or move it farther away; reset a pitched Preview camera before judging. |
| Scene instance still shows `Guide_ReadAndDisable` | Stale instance from before the guide was removed | Delete the instance and drop the prefab in again. |

## Preview QA (2026-10-01, Lens Studio Interactive Preview)

Compile and runtime log are clean. The tube renders and follows the drifting points in the demo project. With the root scaled to 0.35 it stays on the points (verifies the scale fix). Viewed from 70° to the side, the cross-section is round and the ends are capped. Still untested: device frame cost of the 400-step / 20-segment example (24,022 vertices rebuilt every frame) and the historical tutorial's memory estimates.
