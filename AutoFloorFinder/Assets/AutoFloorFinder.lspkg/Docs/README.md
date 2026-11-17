# Auto Floor Finder

## What it is
A package that estimates the real-world floor height on Specs automatically, with no placement UI. It is for Lenses
whose content should sit on the floor (avatars, boards, play spaces, ambient content) without asking the wearer to
pick a spot. It estimates height only: it does not choose X/Z, check occupancy or find tabletops and walls. Use
SurfacePlacement when the wearer should place content deliberately.

## What it does
1. You add the `AutoFloorFinder` component and wire `worldCamera` to your Device Tracking camera (it throws in
   `onAwake` if the camera is missing).
2. It acquires the WorldQuery module internally, opens one hit-test session and casts batched fans of rays at
   configurable pitch angles every cycle.
3. Hits are kept only inside a plausible camera-to-floor band (90–250 cm by default), must agree across attempts and
   cycles, and a sudden height jump becomes a candidate that must be corroborated before it replaces the floor.
4. Calibration moves from Acquiring to Tracking to Locked; once locked it revalidates on a slower cadence (every 20 s by
   default) and unlocks again if the floor drifts or revalidation disagrees.
5. Each committed height pins the world Y of every SceneObject in `targetObjects` (keeping their X/Z), optionally
   smoothed, and fires the registered floor and calibration callbacks.

## Highlights
- Hit voting plus height-jump hysteresis instead of a single noisy downward ray.
- Query API: `hasFloor()`, `getFloorWorldY()`, `getSmoothedFloorWorldY()`, `getCalibrationState()`, `isLocked()`.
- Callbacks through `addOnFloorUpdated` / `removeOnFloorUpdated` and `addOnCalibrationStateChanged` /
  `removeOnCalibrationStateChanged` (`FloorCalibrationState`: Acquiring, Tracking, Locked).
- Targets keep their authored placement until the first commit; no placeholder height is written.
- Advanced tuning fields and experimental surface-classification options, both off by default, set before `onAwake`.
- Optional logging of cycle diagnostics, commits and lifecycle transitions for tuning.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/AutoFloorFinder.ts` | The estimator component: ray fans, voting, calibration lifecycle, target pinning and callbacks. |
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | Demo guide panel that hides the floor marker and carousel until dismissed. |
| `Example/ExampleCarousel/ExampleCarousel.ts` | Demo carousel that describes the example in the prefab. |

## Extra info
- **Requires:** SnapDecorators, Utilities, InteractionKit, UIKit, Motion, Icons. Needs a Specs runtime with WorldQuery
  and real surface data: the Lens Studio Preview returns no WorldQuery hits, so targets keep their authored height
  there and floor acquisition must be verified on device. Lower `minUserToFloorDistanceCm` for seated use.
- **Get started:** drop `AutoFloorFinder__PLACE_IN_SCENE.prefab` into a Specs scene and rewire `worldCamera`; its
  `Floor Marker` plate is already listed in `targetObjects`. Delete `Guide` and `ExampleCarousel` for your own Lens.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) – required setup and common mistakes, read first
  - [components.md](components.md) – inputs, defaults, advanced fields and callbacks
  - [api-status.md](api-status.md) – current, experimental and not-provided APIs
  - [examples.md](examples.md) – prefab setup, manual setup and typed consumer scripts
  - [troubleshooting.md](troubleshooting.md) – capability errors, hit acceptance, placement and calibration
  - [guide.md](guide.md) – why the estimator votes, related packages and roadmap ideas
