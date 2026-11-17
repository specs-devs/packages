# Solvers cheat sheet (load-bearing rules)

[← Agent usage index](../README.md)

## Use when

Read this **first**, and again right before you wire a solver. Each rule points
to the detail.

## The rules

1. **Import from `Scripts/TS/`.** For example
   `import {TetherTS} from "Solvers.lspkg/Scripts/TS/TetherTS"`. The older
   `Solvers.lspkg/TS/...` path does not resolve. The scale solver's file is
   `ScaleOverDistanceLinear` but its class is `ScaleOverDistanceLinearTS`.
   → [components](components.md)
2. **Create solvers by type name.** `obj.createComponent(TetherTS.getTypeName()) as TetherTS`.
   `createComponent("Component.ScriptComponent")` makes an empty script, so
   every property you set on it is ignored. → [examples](examples.md)
3. **Units are cm.** Offsets, thresholds and distances are Lens Studio world
   units (centimeters). The prefab
   tethers sit at `offset (0, 0, -100)`, which is 1 m in front of the camera, and
   its Distance Events thresholds are `100, 200, 300`. → [components](components.md)
4. **"In front of the camera" is −Z.** Tether offsets are applied along the
   target's own axes (+Z is the target's back). Use a negative `offset.z` to
   put content in front of the camera. → [components](components.md#tetherts)
5. **Set `target` explicitly.** No solver finds the main camera on its own,
   whatever the "Override default target mainCamera" hint suggests. With no
   target, the solver does nothing. → [troubleshooting](troubleshooting.md)
6. **Distance Events: code ranges and Inspector ranges coexist.** Ranges added
   with `addRange()` are kept when the Inspector ranges are set up (at start,
   or on the first update after `target` is assigned). Only `clearRanges()`
   removes everything. Inspector arrays `distances`, `events` and
   `eventFunctions` must have the same length. → [examples](examples.md#distance-ranges-from-code)
7. **Some inputs are read only in `onAwake`.** `enableLogging*` is read only
   at awake, which runs inside `createComponent`. `SharpTurnTS.frameCount` can
   change later, but that rebuilds its buffer and drops the recorded path.
   → [troubleshooting](troubleshooting.md)
8. **One solver per transform channel.** Each solver writes its transform every
   frame. Two solvers that both write position (Tether + MatchTransform) or both
   write rotation (Billboard + MatchTransform) fight each other. Tether +
   Billboard is fine. → [guide](guide.md#combining-solvers)

## Verify

In Preview, move or rotate the target and watch the solved object react. A
solver that does nothing usually has no target, the wrong component type, or
an offset or threshold that is 100× off. → [troubleshooting](troubleshooting.md)
