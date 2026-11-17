# SurfacePlacement components

[← Agent usage index](../README.md)

## Use when

Use this as the import and member index after choosing a capability in
[api-status.md](api-status.md). Everything below is read from the package
source of this revision.

Imports use the prefix `SurfacePlacement.lspkg/`. The supported API is in
`Scripts/SurfacePlacementController`, `Scripts/PlacementSettings` and
`Scripts/SurfaceMove`; the example component is at the package root
(`SurfacePlacement.lspkg/Example`).

## Current API

### `SurfacePlacementController` — `Scripts/SurfacePlacementController`

A plain class decorated with the package's `@Singleton` (not a component).

| Member | Meaning |
|---|---|
| `static getInstance(): SurfacePlacementController` | Creates the singleton on first call: a scene-root SceneObject `"SurfacePlacementController"` with an `AudioComponent` holding the calibration chime. On the next frame it plays the chime once at zero volume, so starting audio output does not stall the first placement |
| `startSurfacePlacement(settings: PlacementSettings, callback: (pos: vec3, rot: quat) => void)` | Stops any running placement (its callback never fires), instantiates the placement prefab for `settings.placementMode` under the controller object, applies `settings.showDebug` and starts it. `callback` fires once with the world position (cm) and world rotation |
| `stopSurfacePlacement()` | Stops the current placement's hit tests and update loop and destroys its SceneObject at once, finished or not. The callback is not called. No-op when there is no current placement |

There are no events, progress values, cancel callbacks or "is running" queries;
see [lifecycle](lifecycle.md).

### `PlacementSettings` — `Scripts/PlacementSettings`

```ts
new PlacementSettings(
  mode: PlacementMode,
  showDebug: boolean = false
)
```

| Read-only property | From argument | Used by |
|---|---|---|
| `placementMode` | `mode` (required) | All modes; selects the prefab |
| `showDebug` | `showDebug` | All modes: prints placement logs. Tabletop also marks where the depth pass aims round the hand and where its hits land |

### `PlacementMode` — `Scripts/PlacementSettings`

| Member | Value | Prefab (internal) |
|---|---|---|
| `GROUND` | 0 | `Prefabs/HorizontalPlacement.prefab` (`Horizontal`) |
| `WALL` | 1 | `Prefabs/VerticalPlacement.prefab` (`Vertical`) |
| `TABLETOP` | 2 | `Prefabs/TableTopPlacement.prefab` (`TableTop`) |

The controller lists the prefabs in the same order as the enum.

### Mode behavior (constants in the detector scripts)

| Mode | Confirmation | Accepted surface | Delivered pose |
|---|---|---|---|
| `GROUND` | Dwell | Hit normal `y > 0.95`, 20–350 cm along the gaze (aimed slightly below it) | Hit position; yaw-only rotation, local +Y up, local +Z toward the user |
| `WALL` | Dwell, once more than 15 consecutive results have hit a wall | Hit normal `abs(y) < 0.15`, 50–1000 cm along the gaze | Hit position; facing from the wall normal averaged over ≤2.5 s / 12 samples; local +Y out of the wall toward the user, local −Z up the wall |
| `TABLETOP` | One tracked hand, flat and still, for 1 s (0.85 s fill + 0.15 s hold) | Fingertips and finger knuckles within 2 cm of a plane tipped less than 25° from level; thumb tip moving ≤1.5 cm over the last 22 frames; resting on the surface, when depth measures it | Centre of the ring round the hand, at the measured table height (else 1 cm below the lowest fingertip); upright, local +Y up, local +Z back along the hand toward the wrist |

**Dwell (Ground / Wall):** stillness is measured on a point 100 cm along the
camera's view. The aim must stay within 4 cm across a 0.5 s window; then the
ring fills over 1.0 s, during which the aim may drift up to 10 cm from where the
fill began (Ground allows 1.5× both limits once filling: 6 cm and 15 cm). An
accepted surface hit within the last 0.5 s is also required. Any breach empties
the ring. See [guide](guide.md).

**Tabletop:** the ring surrounds one hand at a time: the one it already
surrounds while that stays in view, otherwise the right one when both are. A
hand counts once it is tracked and its thumb tip is in the camera's view.
Calibration restarts if the hand moves, curls, turns more than 15° on the
surface, or leaves the view for more than 0.25 s. Depth hits count when they
face up (normal `y ≥ 0.9`) and lie within 10 cm of the hand's height; the table
is the lowest 1.5 cm band two aim points agree on. Calibration is abandoned, and
waits 1.5 s before it may start again, if the hand sits more than 7 cm above
that surface or five answers come back with none usable. After a tracked hand
has stayed out of view for 2 s, the prompt asks the user to look at their hand.
In the Lens Studio editor a click places at once, 50 cm ahead of the camera
along its heading and 20 cm below its height, facing the camera.

**High-accuracy pass:** when the Ground / Wall fill or the Tabletop calibration
starts, a second World Query session with `highAccuracy` fires hit tests while
it runs (Ground / Wall at the settled point, re-fired at most every 0.2 s;
Tabletop at five points round the hand in turn). Ground and Wall pause their
coarse hit tests meanwhile. Ground takes the position from the latest accurate
hit, Wall the position and facing, Tabletop only the table height. A result
that has not landed by the end of the fill never delays placement; the coarse
pose (or the hand's estimate) is used. It is skipped in the Lens Studio editor,
on runtimes without the option, and for targets within 50 cm of the camera; its
session is stopped when placement completes or stops.

**Reticle size:** Ground and Wall scale the reticle with its distance (relative
to 300 cm, clamped 0.1–4×) so it keeps a constant size on screen; Ground draws
it up to 10% larger up close (fully at 100 cm or nearer, fading out by 300 cm).
The Tabletop ring is sized round the hand instead.

### `SurfaceMove` — `Scripts/SurfaceMove`

A component for the SceneObject that holds a UIKit `Frame` placed beside the
content (the Frame supplies the `Interactable` and `InteractableManipulation` it
uses).

| `@input` | Type | Meaning |
|---|---|---|
| `surfaceContent` | `SceneObject` | What stays on the surface while the Frame moves. Its local +Y must face out of the surface, as the placement rotation leaves it. Where it sits in the hierarchy is free |

On `OnStartEvent` it turns off the Frame manipulation's rotation and scaling
and adds an idle InteractionKit `Billboard`. When the first drag starts it takes
the Frame's offset from the content. From then on, every `LateUpdateEvent` puts
the content back at that offset from the Frame, projected onto the surface
plane (through the content, with its +Y as the normal). When the content's up is within about
25° of world up (`y ≥ 0.9`, a floor or table), the Frame turns about the
vertical to face the user while dragged, pivoting on the pinched point, and the
content turns with it; on a wall neither turns. Let go, the Frame eases back to
its offset from the content over 0.12 s. It logs and does nothing if the object
has no Frame or `surfaceContent` is unset. Keep the Frame's own billboarding off.

### `Example` — `Example.ts` (on each example group in `SurfacePlacement__PLACE_IN_SCENE.prefab`)

| `@input` | Type | Default | Meaning |
|---|---|---|---|
| `objectVisuals` | `SceneObject` (required) | prefab: `VisualParent [FOR TOGGLING VISUALS]` (the cube and the menu) | Hidden while placing, enabled on the result. Its local scale is set to 1 (Tabletop) or 2 (Ground, Wall) each time placement starts |
| `menuObj` | `SceneObject` | prefab: `TestMenu` | The menu holding the reset button. Each start puts it back at its authored local position with no local rotation; on walls it is pitched −90° about X to face the user and raised 20 cm up the wall |
| `placementSettingMode` | `int` combo | `0` | **0 = Tabletop, 1 = Ground, 2 = Wall** (not `PlacementMode` values). The prefab's groups use 0, 1 and 2 |

| Method | Meaning |
|---|---|
| `startPlacement()` | Hides `objectVisuals`, sizes it and lays out `menuObj` for the mode, and starts placement with `new PlacementSettings(mode, SHOW_DEBUG)` |
| `resetPlacement()` | `stopSurfacePlacement()` then `startPlacement()`; wired to the prefab's **Reset Placement** button `triggerUpCallbacks` |

It starts placement on `OnStartEvent`. On the result it moves **its own
SceneObject** to the pose (the visuals are children) and shows the visuals. With
several examples in a scene, each stops its placement on `OnDisableEvent` while
it is unfinished, and places again on `OnEnableEvent` once it has started.
1.5 s after start, if nothing is placed yet, it warms up the visuals: it moves
its SceneObject 100 cm in front of the camera, shows the visuals at 0.001 scale
for three frames, then hides them at their real size, so the first reveal does
not hitch. `const SHOW_DEBUG = false` at the top of `Example.ts` is passed as
`PlacementSettings.showDebug`.

## Demo scaffolding (`Example/`, not supported API)

Shipped in `SurfacePlacement.lspkg/Example/` and used only by
`SurfacePlacement__PLACE_IN_SCENE.prefab` to present the examples. Do not import
them from your own scripts.

| Script | Sits on | Key inputs |
|---|---|---|
| `Example/GuideDismissPanel/GuideDismissPanel` | `Guide` (UIKit `Frame` + text + `OkButton`) | `buttonLabel` (`"Ok, I understood"`; only used when the panel is built at runtime), `hideUntilDismissed: SceneObject[]` (prefab: `ExampleCarousel` and the `Tabletop` group; enabled when the guide is closed) |
| `Example/ExampleCarousel/ExampleCarousel` | `ExampleCarousel` (builds its Previous / Next / minimize panel at runtime) | `examples: SceneObject[]` (`Tabletop`, `Ground`, `Wall`; one enabled at a time), `exampleInfo: string[]` (panel text per example), `steps` (empty), `stepInfo: string[]` (empty; text per step, same order as `steps`, empty entries fall back to the example's info), `startIndex` (0), `previousLabel` / `nextLabel` (`"Previous"` / `"Next"`), `examplesPushBack` (20 cm), `anchorExamples` (off: placement is world-anchored), `startMinimized` (off), `extraPanelDrop` (8.5 cm, keeps the panel below the placement prompts) |

The prefab root also holds a UIKit `ThemeManager`.

## Internal (prefab parts, not supported API)

Listed so you can recognize them in a hierarchy; do not import or wire them.

| Script | Sits on | Role |
|---|---|---|
| `Scripts/SurfaceDetector` | base class of the three below | Hit-test sessions, dwell, high-accuracy pass, reticle size, completion; `@input circleAnim`, `confirmText` |
| `Scripts/Horizontal` | `HorizontalPlacement.prefab` | Ground detection; `@input screenTextObj` |
| `Scripts/Vertical` | `VerticalPlacement.prefab` | Wall detection; `@input step1`, `step2` (searching / wall found) |
| `Scripts/TableTop` | `TableTopPlacement.prefab` | Palm detection and table measuring; `@input instructTextObj`, `dotsObj`, `ticksObj` |
| `Scripts/SingleSurface` | Horizontal + Vertical prefabs | Gaze ray, pose before the first hit, reticle easing |
| `Scripts/CircleAnimation` | all three placement prefabs | Ring shader: fill amount, pop and collapse, dot color |
| `Decorators/Singleton` | — | `@Singleton` decorator adding `getInstance()` |
