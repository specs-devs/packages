# SurfacePlacement components

[← Agent usage index](../README.md)

## Use when

Use this as the import and member index after choosing a capability in
[api-status.md](api-status.md). Everything below is read from the package
source of this revision.

Imports use the prefix `SurfacePlacement.lspkg/`. The supported API is in
`Scripts/SurfacePlacementController` and `Scripts/PlacementSettings`; the
example component is at the package root (`SurfacePlacement.lspkg/Example`).

## Current API

### `SurfacePlacementController` — `Scripts/SurfacePlacementController`

A plain class decorated with the package's `@Singleton` (not a component).

| Member | Meaning |
|---|---|
| `static getInstance(): SurfacePlacementController` | Creates the singleton on first call: a scene-root SceneObject `"SurfacePlacementController"` with an `AudioComponent` (calibration sound) and a hidden `HandHints.prefab` instance |
| `startSurfacePlacement(settings: PlacementSettings, callback: (pos: vec3, rot: quat) => void, onCancelled: (() => void) \| null = null)` | Stops any running session, instantiates the placement prefab for `settings.placementMode` under the controller object, configures it and starts calibration. `callback` fires once with the world position (cm) and world rotation. Optional `onCancelled` fires instead if the session is stopped or replaced before it completed |
| `stopSurfacePlacement()` | Hides the hand hint and tears the current detector down (interactables disabled now, SceneObject destroyed next frame). Calls the session's `onCancelled` if it had not completed; `callback` is never called. No-op when nothing runs |

Apart from `onCancelled` there are no events, progress values or "is running" queries; see
[lifecycle](lifecycle.md).

### `PlacementSettings` — `Scripts/PlacementSettings`

```ts
new PlacementSettings(
  mode: PlacementMode = PlacementMode.HORIZONTAL,
  useWidget = true,
  widgetOffset = new vec3(2, 2, 0),
  onSliderUpdated: ((value: vec3) => void) | null = null,
  interaction: PlacementInteraction = PlacementInteraction.HEAD_POSE
)
```

| Read-only property | From argument | Used by |
|---|---|---|
| `placementMode` | `mode` | All modes; selects the prefab |
| `useAdjustmentWidget` | `useWidget` | `NEAR_SURFACE` only: shows the height slider after placement |
| `adjustmentWidgetOffset` | `widgetOffset` | `NEAR_SURFACE` only: slider offset (cm) from the placement point |
| `onSliderUpdate` | `onSliderUpdated` | `NEAR_SURFACE` only: called with the adjusted **world position** while the slider moves |
| `interaction` | `interaction` | `HORIZONTAL` / `VERTICAL` only |

### Enums — `Scripts/PlacementSettings`

| Enum | Members (numeric value) |
|---|---|
| `PlacementMode` | `HORIZONTAL` (0), `VERTICAL` (1), `NEAR_SURFACE` (2) |
| `PlacementInteraction` | `HEAD_POSE` (0), `PINCH_OR_TAP` (1) |

### Mode behavior (constants in the detector scripts)

| Mode | Prefab | Accepted surface | Hit range | Delivered rotation |
|---|---|---|---|---|
| `HORIZONTAL` | `Prefabs/HorizontalPlacement.prefab` | hit normal `y > 0.95` | 20–500 cm | Yaw-only, local +Y up, local +Z toward the user |
| `VERTICAL` | `Prefabs/VerticalPlacement.prefab` | hit normal `abs(y) < 0.15`, stable for >15 hit results | 50–1000 cm | Wall normal averaged over ≤2.5 s / 12 samples; upright: local +Y up, local +Z out of the wall toward the user |
| `NEAR_SURFACE` | `Prefabs/TableTopPlacement.prefab` | flat, still palm(s): palm angle, joint heights within 6 cm, thumb tip moving <1.5 cm, >60 stable frames | hand / phone position | Yaw-only, local +Y up; position 1 cm below the hand |

Head-pose confirmation (Horizontal / Vertical): aim measured 100 cm along the
view; still within 4 cm for 0.5 s, then a 1.5 s fill that resets if the aim
drifts more than 10 cm or the last accepted hit is older than 0.5 s. Frames with
`getDeltaTime()` outside 0.001–0.25 s reset the fill. See [guide](guide.md).

### `Example` — `Example.ts` (on each example group in `SurfacePlacement__PLACE_IN_SCENE.prefab`)

| `@input` | Type | Default | Meaning |
|---|---|---|---|
| `objectVisuals` | `SceneObject` (`@allowUndefined`) | prefab: the red panda | Hidden while placing, enabled on completion. Optional: when unset, only the example's own transform moves |
| `placementSettingMode` | `int` combo | `1` | **0 = Near Surface, 1 = Horizontal, 2 = Vertical** (not `PlacementMode` values). The prefab's four groups use 1/0, 1/1, 2/0 and 0/0 (mode / interaction) |
| `placementInteraction` | `int` combo | `0` (`HEAD_POSE`) | 0 = Head Pose (hold still), 1 = Pinch or Tap; Horizontal / Vertical only |
| `autoStart` | `boolean` | `true` | Start in `OnStart` and again on every re-enable |
| `enableLogging`, `enableLoggingLifecycle` | `boolean` | `false` | Logger output |

| Method | Meaning |
|---|---|
| `startPlacement()` | Hides `objectVisuals` and starts placement with the configured mode (Near Surface: widget on, offset `vec3(10, 10, 0)`) |
| `resetPlacement()` | `stopSurfacePlacement()` then `startPlacement()`; wired to the prefab's UIKit button `triggerUpCallbacks` |

On completion the example moves **its own SceneObject** to the pose (the panda is
a child) and, in Near Surface mode, follows the slider's world position. It
calls `stopSurfacePlacement()` on `OnDisableEvent`.

## Demo scaffolding (`Example/`, not supported API)

Shipped in `SurfacePlacement.lspkg/Example/` and used only by
`SurfacePlacement__PLACE_IN_SCENE.prefab` to present the examples. Do not import
them from your own scripts.

| Script | Sits on | Key inputs |
|---|---|---|
| `Example/GuideDismissPanel/GuideDismissPanel` | `Guide` (first child of the prefab root; UIKit `Frame` + text + `OkButton`) | `buttonLabel` (`"Ok, I understood"`; only used when the panel is built at runtime), `hideUntilDismissed: SceneObject[]` (prefab: `ExampleCarousel` and the first example group; enabled when the guide is closed) |
| `Example/ExampleCarousel/ExampleCarousel` | `ExampleCarousel` (builds its Previous / Next / minimize panel at runtime) | `examples: SceneObject[]` (the four example groups; one enabled at a time), `exampleInfo: string[]` (panel text per example), `steps` (empty), `stepInfo: string[]` (empty; text per step, same order as `steps`, empty entries fall back to the example's info), `startIndex` (0), `previousLabel` / `nextLabel` (`"Previous"` / `"Next"`), `examplesPushBack` (20 cm), `anchorExamples` (off: placement is world-anchored), `startMinimized` (off), `extraPanelDrop` (8.5 cm, keeps the panel below the placement hints) |

## Internal (prefab parts, not supported API)

Listed so you can recognize them in a hierarchy; do not import or wire them.

| Script | Sits on | Role |
|---|---|---|
| `Scripts/SurfaceDetector` | base class of the three below | Hit-test session, reticle animation, head-pose dwell, completion |
| `Scripts/Horizontal` | `HorizontalPlacement.prefab` | Floor/table detection; `@input screenTextObj` |
| `Scripts/Vertical` | `VerticalPlacement.prefab` | Wall detection; `@input step1`, `step2` (search / found hints) |
| `Scripts/TableTop` | `TableTopPlacement.prefab` | Palm / phone detection; `@input instructTextObj`, `sliderPrefab` |
| `Scripts/SingleSurface` | Horizontal + Vertical prefabs | Reticle interpolation, pinch/tap/drag (11 cm drag threshold); `@input interactable` |
| `Scripts/SurfaceSlider` | `SurfaceSlider.prefab` | ±4 cm height slider (UIKit `Slider` child) |
| `Scripts/CircleAnimation` | all three placement prefabs | Ring shader: loading amount, scan, color |
| `Scripts/DotsLine` | `HorizontalPlacement.prefab` | Dotted line length |
| `Scripts/HandHintsController` | `HandHints.prefab` | Hand / phone hint animations |
| `Scripts/ForceHover` | none (deprecated) | Forces UIKit `RoundButton` hover state |
| `Decorators/Singleton` | — | `@Singleton` decorator adding `getInstance()` |
