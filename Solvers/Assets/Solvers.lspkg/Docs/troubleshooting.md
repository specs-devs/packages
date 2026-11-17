# Solvers troubleshooting

[← Agent usage index](../README.md)

## Use when

Use this table for Solvers-specific failures. Generic Lens scripting, scene
placement, rendering and TypeScript issues belong to the relevant CLAD skill.

## Known limitations

| Symptom | Package cause | Package fix |
|---|---|---|
| `Cannot find module 'Solvers.lspkg/TS/…'` | Old path from earlier docs | Use `Solvers.lspkg/Scripts/TS/<File>`; the scale solver's file is `ScaleOverDistanceLinear` |
| Properties set from code have no effect, and nothing moves | Created with `createComponent("Component.ScriptComponent")` (an empty script) | `createComponent(TetherTS.getTypeName()) as TetherTS` |
| Solver does nothing; log says `No target set for …` | No `target` assigned. No solver falls back to the main camera, despite the "Override default target mainCamera" hint | Assign `target` (and `target1`/`target2` for InBetweenRotation). It can be assigned from code after start; the solver picks it up on the next update |
| Tethered content sits on the camera, or is tiny and far | Offset or thresholds entered in meters. All values are cm | Use cm, for example `offset (0, 0, -60)`. The prefab tethers use `(0, 0, -100)` |
| Tethered content ends up behind the user | Positive `offset.z` with `reorientDuringTargetRotation = true`. A camera's +Z points backward | Use a negative `offset.z` |
| `TetherTS` never "waits": it follows every frame | Its thresholds compare the content's distance to the **target**, and any offset larger than `0.1` exceeds that every frame | That is its behavior: a smoothed follow. For "only move when I look away", use `TetherBetweenAngleRangeTS` |
| Showcase/QA: the tether cube covered the head sphere or was out of view | Authored offsets are for the real camera at 1 m. A nearer stand-in target needs a smaller offset | Scale the offset to the target's distance. `SolversShowcase` overrides tether offsets at runtime for this reason |
| Inspector distance events never fire; log shows `arrays must have the same length` | `distances`, `events` and `eventFunctions` differ in length | Give all three the same number of entries |
| Inspector distance callback fires only once | One-shot by design: it re-arms when the range is exited | Leave the range and come back, or call `resetTriggeredDistances()` |
| Percent listener fires every frame | By design. It runs every update while inside the range | Do the cheap work there, or only act on changes |
| Scale solver overrides the authored scale | `ScaleOverDistanceLinearTS` sets the local scale every frame | Put it on a wrapper parent, not on the object whose own scale matters |
| Scale snaps between `minScale` and `maxScale` | `maxDistance == minDistance`: the remap becomes a step at that distance | Give the range some width, `maxDistance > minDistance` |
| MatchTransform copies scale when you only wanted position | Scale is matched by default (target world scale → own world scale) | Set `scaleLerpSpeed = 0`, or constrain all scale axes |
| MatchTransform rotation still drifts with all three rotation axes constrained | Rotation goes through Euler conversion (`MathUtils.quaternionToEuler` → `quat.fromEulerAngles`), which may not round-trip exactly | Unverified in this revision. If it drifts, do not use MatchTransform for position-only follow: copy the position yourself |
| SharpTurn misses a turn right after `frameCount` changed in code | Changing `frameCount` at runtime rebuilds the buffer and drops the recorded path | Expected. Detection resumes after `step` new samples |
| SharpTurn never fires | It watches its **own** object's motion, and needs at least `step` samples that each moved more than `minVertexDistance` | Put it on the moving object and move it in a clear zigzag |
| Log flood every frame | `showDebug` (TetherBetweenAngleRange) or `debug` (SharpTurn) is on | Turn them off. The prefab ships with both off |
| `enableLogging` set from code does nothing | Logger is created in `onAwake`, inside `createComponent` | Set it in the Inspector |
| Two solvers fight (jitter) | Both write the same channel (for example Tether + MatchTransform for position) | One solver per channel. Tether + Billboard is fine |
| `SolversShowcase` added in the editor switches example every frame | When the component was added in the QA pass, `interval` came out as `0` instead of the script default `8` | Set `interval` explicitly (for example `8`) |
| No "Grab and move" label on the prefab's draggable cubes | The labels are disabled in `Solvers__PLACE_IN_SCENE` (each `[Manipulate Example] … / Text`): instructions belong in the Lens's own UI, not in floating text | Re-enable the `Text` child under the cube, or show the hint in your own panel |
| `SolversShowcase` shows no solver name or "Head pose" label | `showLabels` is off by default (the demo's carousel names each solver) | Turn `showLabels` on |
| Guide panel is empty or hides nothing | Another package's `GuideDismissPanel` with the same class name was picked by name | Pick the script asset by path. The prefab's guide uses `Example/GuideDismissPanel/GuideDismissPanel`; `Scripts/GuideDismissPanel/GuideDismissPanel` is Internal and unreferenced |

## Verification

After applying a fix, move the target in Preview and confirm the reaction
visually. For distance events, log every enter and exit in both directions. If
behavior differs from this guide, record the package version and update the
package docs.
