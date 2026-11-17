# Solvers

## What it is
A package of small components that keep an object in a spatial relationship with a target: face it, follow it,
copy its transform, scale with distance to it, or fire callbacks when it crosses distance thresholds. Each solver
ships as a TypeScript component and a JavaScript twin. It is for developers who need script-driven follow, face,
match or proximity behaviour on any SceneObject without writing the math themselves.

## What it does
- You add a solver to the object you want to drive and assign its `target` (no solver falls back to the camera).
  The solver then updates the object every frame.
- Billboard: yaw-only rotation toward (or away from) the target.
- Tether and Tether Between Angle Range: follow the target with an offset, repositioning only when distance or
  angle thresholds are crossed.
- Match Transform: copy the target's position, rotation and scale, with per-axis locks and lerp speeds.
- Scale Over Distance (linear): remap the distance to the target into a uniform scale.
- Distance Events: enter, exit and percent-inside callbacks for distance ranges.
- In-Between Rotation: orient an object halfway between two targets' forward directions.
- Sharp Turn: detect a sharp change in an object's movement direction.
- `Solvers__PLACE_IN_SCENE.prefab` shows a guide and an example carousel with one group per solver (TS and JS
  copies); `SolversShowcase` retargets the active group to a red "Head pose" sphere.

## Highlights
- Eight solvers, each with a TypeScript component and a JavaScript twin attachable as a script asset.
- Works in Lens Studio world units (cm) and degrees; `target` can be assigned at any time.
- TS solvers can be created from code with `createComponent(<Class>.getTypeName())` and configured through
  public fields.
- `TetherBetweenAngleRangeTS` is a lazy follow: content stays put until it is off the view angle or too far away.
- Optional logging on every TS solver (`enableLogging`, `enableLoggingLifecycle`).

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/TS/BillboardTS.ts` | Yaw-only rotation toward or away from the target. |
| `Scripts/TS/TetherTS.ts` | Smoothed follow of a target with an offset, gated by distance thresholds. |
| `Scripts/TS/TetherBetweenAngleRangeTS.ts` | Lazy tether that repositions when content leaves the view angle or distance range. |
| `Scripts/TS/MatchTransformTS.ts` | Copies a target's position, rotation and scale with locks and lerp speeds. |
| `Scripts/TS/ScaleOverDistanceLinear.ts` | `ScaleOverDistanceLinearTS`: maps distance to a uniform scale. |
| `Scripts/TS/DistanceEventsTS.ts` | Enter, exit and percent-inside callbacks for distance ranges. |
| `Scripts/TS/InBetweenRotationUtilityTS.ts` | Orients an object between two targets' forward directions. |
| `Scripts/TS/SharpTurnTS.ts` | Detects sharp changes in movement direction. |
| `Scripts/TS/SolversShowcase.ts` | Demo driver that retargets and cycles the example groups. |

## Extra info
- **Requires:** SnapDecorators, InteractionKit, Utilities, UIKit, Motion, Icons. Works in the Lens Studio Preview
  (move the camera or a dragged target). For a full 3-axis look-at use the engine `LookAtComponent`; for grabbing
  use Interaction Kit (SIK). Import TS solvers from `Solvers.lspkg/Scripts/TS/<File>`; the JS twins in
  `Scripts/JS/` are attached in the Inspector, not imported.
- **Get started:** drag `Solvers__PLACE_IN_SCENE.prefab` into an empty Specs scene with a Camera and the SIK
  prefab, then copy the group for the solver you need.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md): load-bearing rules; read first.
  - [components.md](components.md): every solver, TS and JS: inputs, defaults, methods and events.
  - [examples.md](examples.md): the prefab and compiling snippets.
  - [guide.md](guide.md): how each solver works, plus combined recipes.
  - [troubleshooting.md](troubleshooting.md): known limitations and fixes.
  - [api-status.md](api-status.md): current and internal surfaces, and TS / JS parity.
