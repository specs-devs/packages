# HandAttacher cheat sheet (load-bearing rules)

[← Agent usage index](../README.md)

## Use when

Read this **first**, and again right before you wire a Hand Attacher. Each rule
points to the detail.

## The rules

1. **Import from `Scripts/`.** `import {HandAttacher, HandSide, HandJoint} from
   "HandAttacher.lspkg/Scripts/HandAttacher"`. The older
   `HandAttacher.lspkg/HandAttacher` path does not resolve. → [components](components.md)
2. **Create it by type name.** `obj.createComponent(HandAttacher.getTypeName())`,
   not `createComponent("Component.ScriptComponent")`, which creates an empty
   script component. → [examples](examples.md)
3. **The hand and the target are first resolved in `onAwake`.** `onAwake` runs
   inside `createComponent`, with the defaults `handSide = "right"` and target =
   the host object. Assigning `handSide` or `targetObject` afterwards is picked
   up on the next update; call `setHand(side)` / `setTarget(obj)` (or
   `refresh()` after plain assignments) to apply it immediately. `handJoint`, the offsets, the smoothing values and the
   `enable*` flags are read every frame, so plain assignment works for them. → [components](components.md)
4. **The SIK prefab must be in the scene.** Hand data comes from
   `SIK.HandInputData`. Without SIK nothing is ever tracked, so the target stays
   hidden. → [troubleshooting](troubleshooting.md)
5. **Offsets are joint-local, in cm and degrees.** `positionOffset` is rotated by
   the joint rotation. `rotationOffset` is Euler degrees, multiplied after the
   joint rotation. Size the object for a fingertip: the prefab uses a 3 cm box
   with a 2 cm offset. → [components](components.md)
6. **Prefer a parent host with a child target.** The prefab puts the component on
   `HandAttacher__PLACE_IN_SCENE` and targets `HandAttacherDemo/Box`. If the target is
   the host itself, hiding it also stops the component's update loop (Lens
   Studio runs no events on a disabled object). It comes back through SIK's
   `onHandFound`, or through `setHand()` when the new hand is already tracked,
   and snaps to the joint on re-show. → [troubleshooting](troubleshooting.md)
7. **`handSide`/`handJoint` are strings.** The `HandSide` / `HandJoint` enums hold
   the same string values (`HandJoint.IndexTip === "indexTip"`). An unknown joint
   name silently does nothing unless `enableLogging` is on. → [api-status](api-status.md)
8. **Expect a hand-tracking permission prompt.** Hand Attacher reads raw
   hand-joint data, which an upcoming Specs OS release gates behind a one-time
   user permission. Keep `hideWhenNotTracked` on so a pending or declined
   permission leaves the target hidden, not at the origin. →
   [README](../README.md#hand-tracking-permission-upcoming)

## Verify

In Preview, with no hand raised, the target must be hidden, not floating at the
origin. With the hand raised, it must sit on the joint. →
[troubleshooting](troubleshooting.md)
