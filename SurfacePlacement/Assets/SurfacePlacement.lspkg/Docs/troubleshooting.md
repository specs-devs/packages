# SurfacePlacement troubleshooting

[← Agent usage index](../README.md)

## Use when

Use this table for package-specific failures. Generic Lens scripting, scene
placement, World Query and TypeScript issues belong to the relevant CLAD skill.

## Known limitations

| Symptom | Package cause | Package fix |
|---|---|---|
| Import under `SurfacePlacement.lspkg/` is unresolved | `Scripts/` dropped from the path (only `Example` sits at the package root) | `SurfacePlacement.lspkg/Scripts/SurfacePlacementController`, `SurfacePlacement.lspkg/Scripts/PlacementSettings` |
| Ring/reticle keeps floating after the object that started placement was disabled or hidden by a carousel | The placement UI lives under the scene-root `SurfacePlacementController` object, not under your object | Call `stopSurfacePlacement()` from `OnDisableEvent` / `OnDestroyEvent` (`Example` does it on `OnDisableEvent`) |
| Placement starts twice / two sessions flash on first show | Starting from both `OnStart` and `OnEnableEvent` on the first enable | Only restart on re-enable after `OnStart` has run (`Example` uses a `started` flag) |
| Wrong surface type, e.g. a wall mode when you meant floor | `Example.placementSettingMode` integers (0 Near, 1 Horizontal, 2 Vertical) used as `PlacementMode` (0 Horizontal, 1 Vertical, 2 Near Surface) | Use the `PlacementMode` enum members in code; map the combo values explicitly |
| Head pose never completes; ring keeps restarting | No accepted surface hit within the last 0.5 s (the fallback reticle cannot place), view not still enough (4 cm / 0.5 s at 100 cm), or frame times outside 0.001–0.25 s | Aim at a scanned floor / wall and hold still; in Preview choose an environment with that geometry and avoid hitching |
| Head pose places immediately when the experience opens | The user was already looking at the floor; dwell starts as soon as placement starts | Start placement only when the user is ready (`autoStart = false` + your own trigger) |
| Pinch / tap / drag does nothing on the reticle | Head-pose mode disables the prefab's `Interactable`s and does not subscribe to pinch / tap | Pass `PlacementInteraction.PINCH_OR_TAP` as the fifth `PlacementSettings` argument |
| Pinch-or-tap: pinch is ignored | Confirmation requires the ring to be in view (10 cm sphere visible to the camera) and an active hit-test session | Look at the ring when pinching |
| Vertical mode keeps showing the wall-search hint in Preview | The default Preview room has no walls | Use a Preview environment with walls, or test on device |
| Vertical: wall content authored for an older revision is now rotated 90° | Older revisions delivered local +Y out of the wall; the rotation is now upright (local +Y up, local +Z out of the wall toward the user) | Remove any compensating local rotation you added |
| Near Surface cannot be confirmed in Preview | The simulated hand cannot hold a valid palm-down, still pose | In the editor any tap (`TapEvent`, e.g. a click in Preview) confirms immediately; verify the palm flow on device |
| Near Surface crashed on start: `Cannot set property 'currentValue' of null` in `SurfaceSlider.resetSlider` | An older `SurfaceSlider.prefab` still held the removed SIK 2.x Slider | Use this revision (UIKit `Slider` in the prefab); do not reuse the old prefab |
| Height slider stays visible after Near Surface placement | By design: the slider is the post-placement height adjustment and lives at the scene root until the session ends (the reticle itself is switched off on completion) | Call `stopSurfacePlacement()` (or start a new placement) when adjustment is done |
| `Valid pose state changed: …` lines in the log during Near Surface | Debug `print` left in `TableTop` | Harmless; ignore |
| "Exception in HostFunction: Object is null" in SIK's cursor after restarting placement | A detector or the Near Surface slider was destroyed synchronously mid cursor update (older revisions, or custom teardown) | Always tear down through `stopSurfacePlacement()` / a new `startSurfacePlacement()`; never destroy placement objects yourself |
| Code awaiting the placement result hangs after `stopSurfacePlacement()` | Stop never calls the completion callback | Pass the optional third `onCancelled` argument to `startSurfacePlacement`; it fires when an unfinished session is stopped or replaced |

## Verification

After a fix, reproduce it in Preview (Horizontal + Head Pose on the default
floor) and confirm the callback pose and that the reticle disappears on
completion, stop and disable. Vertical and Near Surface confirmation need a
device or suitable Preview geometry.
