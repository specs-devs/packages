# VolumetricLine components

[← Agent usage index](../README.md)

## Use when

Import the installed revision’s public classes, functions and wire types, or wire component inputs. This reference was derived from TypeScript source declarations. Defaults are source initializers; prefab values may override them. Public signatures do not certify runtime availability. Lifecycle methods are included for accuracy, not as user commands.

## RandomPositionAnimator.ts

Consumer import: `VolumetricLine.lspkg/Scripts/RandomPositionAnimator`.

Caches local positions in onAwake; onUpdate uses lerp weight smoothing directly, contrary to its Inspector hint. Zero freezes and one snaps. No public start/stop/reset method or event API; author the object array before awake.

### RandomPositionAnimator

Lens component. extends BaseScriptComponent.

| Input | Type | Source default | Meaning / annotation |
|---|---|---|---|
| `objectsToAnimate` | `SceneObject[]` | `unassigned` |  |
| `xRange` | `number` | `10` |  |
| `yRange` | `number` | `10` |  |
| `zRange` | `number` | `10` |  |
| `speed` | `number` | `1.0` |  |
| `smoothing` | `number` | `0.1` | Smoothing factor for movement (0=instant, 1=very smooth) |
| `enableLogging` | `boolean` | `false` | Enable general logging (operations, events, etc.) |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

| Public member | Declaration / source default |
|---|---|
| `onAwake` | `method onAwake(): void` |
| `onUpdate` | `method onUpdate(): void` |

## VolumetricLine.ts

Consumer import: `VolumetricLine.lspkg/Scripts/VolumetricLine`.

Core component; see [lifecycle](lifecycle.md) for all setter validation, initialization prerequisites and coordinates. refreshPath calls updateMesh; forceRefresh bypasses its guard. Public diagnostic mutators are not read-only. Inspector-private backing fields have public accessor names where declared; no public event API. Public capEnds/pathPoints/material are assignments without automatic refresh.

### VolumetricLine

Lens component. extends BaseScriptComponent.

| Input | Type | Source default | Meaning / annotation |
|---|---|---|---|
| `pathPoints` | `SceneObject[]` | `unassigned` | Array of scene objects that define the path of the 3D line, @allowUndefined |
| `_radius` | `number` | `10.0` | Radius of the circular cross-section, private Inspector input |
| `_circleSegments` | `number` | `16` | Number of segments around the circle (higher = smoother), private Inspector input |
| `_interpolationSteps` | `number` | `10` |      "Number of interpolated points between each path point for smooth curves"   , private Inspector input |
| `_smoothness` | `number` | `0.5` | Smoothing factor for spline interpolation (0=linear, 1=smooth), private Inspector input |
| `material` | `Material` | `unassigned` | Material to apply to the 3D line mesh, @allowUndefined |
| `_color` | `vec3` | `new vec3(1, 1, 0)` |  |
| `capEnds` | `boolean` | `true` | Whether to cap the ends of the tube |
| `_zOffset` | `number` | `0.0` | Manual Z-axis offset to compensate for position alignment issues, private Inspector input |
| `_useWorldPosition` | `boolean` | `true` |      "Use world position instead of local position (fixes most offset issues)"   , private Inspector input |
| `_autoCorrectOffset` | `boolean` | `true` | Enable automatic position offset detection and correction, private Inspector input |
| `_useRelativeToComponent` | `boolean` | `true` |      "Apply additional coordinate space transformation relative to this component's transform"   , private Inspector input |
| `_debugPositions` | `boolean` | `false` | Debug: Show position information in console, private Inspector input |
| `_debugLogs` | `boolean` | `false` | Debug: Show mesh generation logs, private Inspector input |
| `_continuousUpdate` | `boolean` | `true` | Continuously update mesh based on path point positions, private Inspector input |
| `_updateRate` | `number` | `0.05` | Update rate in seconds (higher = less frequent updates, better performance), private Inspector input |
| `_smoothUpdate` | `boolean` | `true` | Update every frame for smooth animation (may impact performance), private Inspector input |
| `_positionSmoothing` | `number` | `0.3` | Enable position smoothing to reduce jitter during animation, private Inspector input |
| `enableLogging` | `boolean` | `false` | Enable general logging (events, operations, etc.) |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

| Public member | Declaration / source default |
|---|---|
| `radius` | `get radius(): number` |
| `radius` | `set radius(value: number): inferred` |
| `circleSegments` | `get circleSegments(): number` |
| `circleSegments` | `set circleSegments(value: number): inferred` |
| `interpolationSteps` | `get interpolationSteps(): number` |
| `interpolationSteps` | `set interpolationSteps(value: number): inferred` |
| `smoothness` | `get smoothness(): number` |
| `smoothness` | `set smoothness(value: number): inferred` |
| `color` | `get color(): vec3` |
| `color` | `set color(color: vec3): inferred` |
| `zOffset` | `get zOffset(): number` |
| `zOffset` | `set zOffset(value: number): inferred` |
| `useWorldPosition` | `get useWorldPosition(): boolean` |
| `useWorldPosition` | `set useWorldPosition(value: boolean): inferred` |
| `debugPositions` | `get debugPositions(): boolean` |
| `debugPositions` | `set debugPositions(value: boolean): inferred` |
| `useRelativeToComponent` | `get useRelativeToComponent(): boolean` |
| `useRelativeToComponent` | `set useRelativeToComponent(value: boolean): inferred` |
| `autoCorrectOffset` | `get autoCorrectOffset(): boolean` |
| `autoCorrectOffset` | `set autoCorrectOffset(value: boolean): inferred` |
| `smoothUpdate` | `get smoothUpdate(): boolean` |
| `smoothUpdate` | `set smoothUpdate(value: boolean): inferred` |
| `positionSmoothing` | `get positionSmoothing(): number` |
| `positionSmoothing` | `set positionSmoothing(value: number): inferred` |
| `continuousUpdate` | `get continuousUpdate(): boolean` |
| `continuousUpdate` | `set continuousUpdate(value: boolean): inferred` |
| `updateRate` | `get updateRate(): number` |
| `updateRate` | `set updateRate(value: number): inferred` |
| `isEnabled` | `get isEnabled(): boolean` |
| `isEnabled` | `set isEnabled(isEnabled: boolean): inferred` |
| `onAwake` | `method onAwake(): void` |
| `onStart` | `method onStart(): void` |
| `onUpdate` | `method onUpdate(): void` |
| `updateMesh` | `method updateMesh(): void` |
| `refreshPath` | `method refreshPath(): void` |
| `forceRefresh` | `method forceRefresh(): void` |
| `setTestPositions` | `method setTestPositions(): void` |
| `resetOffsetDetection` | `method resetOffsetDetection(): void` |
| `testPositionModes` | `method testPositionModes(): void` |
| `setManualOffset` | `method setManualOffset(offset: vec3): void` |
| `getPositionDiagnostics` | `method getPositionDiagnostics(): string` |

## Demo scaffolding (`Example/`)

These scripts ship in `VolumetricLine.lspkg/Example/` and are wired inside
`VolumetricLine__PLACE_IN_SCENE.prefab` (order: Guide, ExampleCarousel,
then the `VolumetricLine Example` group). They only present the demo and are not
part of the VolumetricLine API.

| Object / script | Class | Key inputs |
|---|---|---|
| `Guide` — `Example/GuideDismissPanel/GuideDismissPanel.ts` | `GuideDismissPanel` | `hideUntilDismissed: SceneObject[]`: hidden until "Ok, I understood" is pressed (here: ExampleCarousel and the `VolumetricLine Example` group). Only the ones enabled at start are re-enabled. `buttonLabel: string = "Ok, I understood"` is only used when the panel is built at runtime |
| `ExampleCarousel` — `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (here the single `VolumetricLine Example` group), `exampleInfo: string[]` (one line per example), `steps: SceneObject[]`, `stepInfo: string[] = []` (what each step shows, same order as `steps`; empty entries fall back to the example info), `startIndex: number = 0`, `previousLabel` / `nextLabel`, `examplesPushBack: number = 20`, `anchorExamples: boolean = true`, `startMinimized: boolean = false`, `extraPanelDrop: number = 0` (8 here) |

The VolumetricLine and RandomPositionAnimator components sit on the
`VolumetricLine Example` child, not on the prefab root, so the carousel and the
guide can show and hide the example without hiding themselves.
