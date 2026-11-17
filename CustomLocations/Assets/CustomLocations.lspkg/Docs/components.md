# CustomLocations components

[← Agent usage index](../README.md)

## Use when

Look up exact package inputs, methods and listener semantics. Import paths below use `CustomLocations.lspkg/`. All scene distances are centimeters unless noted. Native components own tracking; the package exports no tracking component or native event replacement.

## LocatedObject

Import: `CustomLocations.lspkg/Scripts/LocatedObject` (named interface). Requires `activate(): void`, `deactivate(): void`, `localize(): void`. It has no fields, default implementations or events.

`ActivateWhenInCameraView.listenerObjects` accepts implementing ScriptComponents. Actual first native `onFound` calls `localize()` once. Editor simulation and force activation can call `activate()` without any `localize()` call. Use ordinary lifecycle initialization for anything needed by activate/deactivate.

## ActivateWhenInCameraView

Import: `CustomLocations.lspkg/Scripts/ActivateWhenInCameraView` (named class, `@component`). Put beside `LocatedAtComponent` on the scan SceneObject.

| Input | Type | Source default | Meaning |
|---|---|---|---|
| `camera` | `Camera` | Unassigned | Required for automatic XZ distance and sphere visibility checks. |
| `centerReference` | `SceneObject` | Unassigned, `@allowUndefined` | Falls back to owning SceneObject on Awake. |
| `listenerObjects` | `LocatedObject[]` | Unassigned | Serialized as `@input("Component.ScriptComponent[]")`. Add implementing components. Null entries skipped. |
| `sphereInViewForActivationRadius` | `number` | `600` | World sphere radius for camera frustum test. |
| `distanceForActivation` | `number` | `1000` | Enter threshold for horizontal XZ distance. |
| `deActivateDistanceMultiplier` | `number` | `1.5` | Outer distance multiplier, computed once on Awake. |
| `simulateLocalizedInEditor` | `boolean` | `true` | Make localization getter true when `isEditor()`. Does not invoke localize callback. |
| `enableLogging` | `boolean` | `false` | Enable non-error tagged logging at initialization. |

| Public surface | Behavior |
|---|---|
| `onAwake(): void` | Resolve same-object Located At, subscribe found/lost, cache center Transform and outer distance, bind Update. Lifecycle hook; do not call repeatedly on a live instance. |
| `isLocalized: boolean` (getter) | Found once, or current editor simulation flag with isEditor(). Not current native tracking state. |
| `isActivated: boolean` (getter) | Internal active flag. |
| `activateListeners(): void` | Set the force flag; if not already active, set active and invoke optional activate callbacks. Bypasses localization/frustum entry and keeps content on (even beyond the outer distance) until `deactivateListeners()`. |
| `deactivateListeners(): void` | Clear the force flag; if active, clear active and invoke optional deactivate callbacks. The automatic check resumes on the next frame. |

No public package events are exposed. Each listener callback is guarded by try/catch; failure logs and iteration continues without rolling back the state flag.

### Activation behavior

When inactive, activate only if XZ camera-to-center distance is **strictly less than** `distanceForActivation`, `isLocalized` is true, and `camera.isSphereVisible(center, radius)` is true. While active, deactivate only if distance is **strictly greater than** the cached outer distance. Otherwise return without checking visibility or localization. A missing camera causes Update to return. `activateListeners()` sets a force flag that suppresses the outer-distance deactivation until `deactivateListeners()` is called; `deactivateListeners()` clears the flag and hands control back to the automatic check (which can re-activate on the next frame if you are close and looking).

Native found handling runs only once per component lifetime; lost handling only logs. Center Transform and outer threshold are fixed at Awake, so later `centerReference`/multiplier assignments are not a supported reconfiguration path. Current entry distance and visibility radius are read each update, but source has no input validation. Force-activation persists until `deactivateListeners()`; force-deactivation does not persist.

## ScaleInLocatedObject

Import: `CustomLocations.lspkg/Scripts/ScaleInLocatedObject` (named class, `@component`, implements LocatedObject).

| Input | Type | Source default | Meaning |
|---|---|---|---|
| `contentSceneObject` | `SceneObject` | Unassigned, `@allowUndefined` | Falls back to owning SceneObject. |
| `animationStep` | `number` | `0.05` | Fraction of initial local X scale added/subtracted per frame. Absolute value used. Not seconds. |
| `enableLogging` | `boolean` | `false` | Non-error logging enabled at initialization. |

- `onAwake(): void`: choose content, cache its initial **local X** scale as target, set local XYZ scale to zero, bind Update.
- `activate(): void`: enable content if needed; set positive speed to targetScale × abs(animationStep).
- `deactivate(): void`: set negative speed to targetScale × abs(animationStep).
- `localize(): void`: no-op.

Update adds speed to current X and writes uniform XYZ, stopping at zero or target. With positive scale and step 0.05 this takes approximately 20 frames. Deactivation does not disable content. Use a positive uniform initial scale; nonuniform original Y/Z values are not preserved. No public events or restart/reconfiguration method are exported.

## AudioLocatedObject

Import: `CustomLocations.lspkg/Scripts/AudioLocatedObject` (named class, `@component`, implements LocatedObject).

| Input | Type | Source default | Meaning |
|---|---|---|---|
| `audio` | `AudioComponent` | Unassigned, `@allowUndefined` | Resolve `Component.AudioComponent` on same SceneObject during Awake if absent. |
| `loops` | `number` | `1` | Passed directly to audio.play; hint documents -1 for indefinite looping. |
| `enableLogging` | `boolean` | `false` | Non-error logging at initialization. |

- `onAwake(): void`: initialize logger, resolve audio and log an error if absent.
- `activate(): void`: call `audio.play(loops)` when audio exists.
- `deactivate(): void`: call `audio.stop(true)` when audio exists.
- `localize(): void`: no-op.

No package audio-state event or completion event is exposed. Direct calls to activate can restart playback; the activator's state guard is what suppresses repeated entry calls.

## DeactivateLocationMeshOnDevice

Import: `CustomLocations.lspkg/Scripts/DeactivateLocationMeshOnDevice` (named class, `@component`). Attach to group root.

| Input | Type | Source default | Meaning |
|---|---|---|---|
| `hideInEditor` | `boolean` | `false` | Also hide collected visuals in Editor. |
| `enableLogging` | `boolean` | `false` | Non-error logging at initialization. |

- `onAwake(): void`: initialize logger, register OnStart.
- OnStart (private): collect one RenderMeshVisual from each immediate child with native Located At, then hide if hideInEditor or running outside Editor.
- `locationMeshVisuals: RenderMeshVisual[]` (getter): internal collected array; empty until Start. Treat as owned by helper.
- `setMeshesVisible(visible: boolean): void`: set enabled on each still-valid collected visual. Does not disable scan SceneObjects or native Located At components.

No public event or rediscovery method. It does not recurse or inspect non-scan descendant meshes. OnStart does not explicitly show meshes when hide=false; it leaves their existing state unchanged.

## Logger

Import: `CustomLocations.lspkg/Scripts/Logger` (named class, not a component). No Inspector inputs or events.

| Public surface | Behavior |
|---|---|
| `constructor(tag: string, enabled: boolean = true, _useColors: boolean = true)` | Keep tag and logging flag. Color argument is accepted for Utilities Logger compatibility but ignored. |
| `setEnabled(enabled: boolean): void` | Change non-error logging flag. |
| `setDebugEnabled(enabled: boolean): void` | Alias of setEnabled. |
| `success(message: string): void` | Print as INFO when enabled. |
| `info(message: string): void` | Print INFO when enabled. |
| `debug(message: string): void` | Print DEBUG when enabled. |
| `warn(message: string): void` | Print WARN when enabled. |
| `error(message: string): void` | Always print `tag \| ERROR \| message`, even when disabled. |

The package components pass their enableLogging=false defaults; standalone Logger defaults to enabled=true.

## CustomLocationsExamplesPanel

Import: `CustomLocations.lspkg/Examples/CustomLocationsExamplesPanel` (named class, `@component`). Builds Canvas, BackPlate and Flex UI with scan state rows, Scan meshes switch, Activate all and Deactivate all buttons. Uses UIKit.

| Input | Type | Source default | Meaning |
|---|---|---|---|
| `locationGroup` | `SceneObject` | Unassigned | Root with native group; immediate Located At children are rows. |
| `camera` | `Camera` | Unassigned, `@allowUndefined` | On Start, recursively find the first scene camera if absent; this is not necessarily main camera. |
| `panelWidth` | `number` | `28` | Width cm; Inspector 20–40. |
| `focalDistanceCm` | `number` | `130` | Typography calibration distance; Inspector 60–200. Does not reposition panel. |
| `refreshInterval` | `number` | `0.5` | Distance/active refresh seconds; Inspector 0.1–2. |
| `enableLogging` | `boolean` | `false` | Non-error logging at initialization. |

`onAwake(): void` is its only public method: initialize Logger, collect immediate scan rows/activators and group mesh toggle, build UI, bind Start/Update. Discovery is not repeated. On Start it resolves camera, subscribes to group onFound and each native scan's Ready/Can track/Cannot track/Found/Lost/Error events. Rows start Waiting and update on events; every refreshInterval they update distance and active suffix.

Group display uses `locationGroup.name`, not GroupId. Scan label uses location asset name without `.location`, or SceneObject name. Row distance is Euclidean (3D) world distance from the activator's `centerReference` (or the scan object when unset) to the camera, in meters; activation uses the XZ distance to the same center. Scan switch starts on in Editor/off on device, independent of actual visual state. It reads `Switch.isOn` in `onFinished` (the event argument is the explicit-change flag, not the state) and uses the group mesh helper if present or directly toggles each row's same-object RMV. Buttons invoke each discovered activator's force methods on TriggerUp. No consumer action methods, getters or package events are exposed; actions are private UI callbacks.

## Demo scaffolding (`Example/`)

These scripts ship in `CustomLocations.lspkg/Example/` and are wired inside `CustomLocations__PLACE_IN_SCENE.prefab`. They only present the example; they are not part of the CustomLocations API. Both import SpectaclesUIKit and SpectaclesInteractionKit.

| Object / script | Class | Key inputs |
|---|---|---|
| `Guide` — `Example/GuideDismissPanel/GuideDismissPanel.ts` | `GuideDismissPanel` | `hideUntilDismissed: SceneObject[]` — hidden until "Ok, I understood" is pressed (here: ExampleCarousel, Custom Locations and CustomLocations Status Panel); `buttonLabel: string = "Ok, I understood"` (only used when the panel is built at runtime) |
| `ExampleCarousel` — `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (here the `Custom Locations` group, one step), `exampleInfo: string[]` (one line per example), `steps: SceneObject[]` (empty here: step through `examples`), `stepInfo: string[] = []` (one info line per `steps` entry; empty entries fall back to the example info; empty here), `startIndex: number = 0`, `previousLabel` / `nextLabel`, `examplesPushBack: number = 20`, `anchorExamples: boolean = true` (false here so the scans keep their alignment), `startMinimized: boolean = false` (true here), `extraPanelDrop: number = 0` |

Keep the Guide above the examples in the hierarchy: it hides its targets in `onAwake`. With a single example the carousel shows no Previous/Next buttons, only the title bar and minimize toggle.
