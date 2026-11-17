# AutoFloorFinder components

[← Agent usage index](../README.md)

## Use when

Wire the component, query floor state or tune the estimator.

## Component and prefab

Import `AutoFloorFinder` from `AutoFloorFinder.lspkg/Scripts/AutoFloorFinder`. Example prefab: `AutoFloorFinder.lspkg/AutoFloorFinder__PLACE_IN_SCENE.prefab`. The root carries the component (camera is an external reference and must be rewired in consumer scenes; the example smoothCoefficient override is .5, script default .4). Its children, in order:

- `Guide`: the guide panel at local (0,0,-100) (`GuideDismissPanel`, see [Demo scaffolding](#demo-scaffolding-example)).
- `ExampleCarousel`: the example panel that describes the demo.
- `Floor Marker`: the plate listed in `targetObjects`, at local (0,-60,-100), scale (60,1,60).

Assets used by the demo: `Meshes/Box.mesh` and `Materials/FloorMarker.mat` (on `Shaders/unlit.graphShader`) render the `Floor Marker` plate. They are demo visuals; any target SceneObject works.

## Demo scaffolding (`Example/`)

Demo-only scripts shipped in `AutoFloorFinder.lspkg/Example/` so the prefab works on its own. They aren't part of the package API; remove `Guide` and `ExampleCarousel` when you build your own Lens.

| File | Used by | Key inputs |
|---|---|---|
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | `Guide` | `buttonLabel` (`"Ok, I understood"`), `hideUntilDismissed: SceneObject[]` (`Floor Marker`, `ExampleCarousel`): hidden while the guide shows, enabled when it's closed. Estimation already runs while the guide shows. |
| `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (`Floor Marker`), `exampleInfo: string[]`, `steps: SceneObject[]` (empty), `stepInfo: string[]` (one line per `steps` entry; empty entries fall back to the example's info; empty here), `startIndex` (`0`), `previousLabel` / `nextLabel`, `examplesPushBack` (`20` cm), `anchorExamples` (`false`, the plate stays world-anchored), `startMinimized` (`true`), `extraPanelDrop` (`24` cm) |

With a single example the carousel shows only its title, the description and the minimize button; Previous / Next appear when `examples` lists more than one object.

## Inputs and advanced fields

| Name | Type | Source default | Configuration surface |
|---|---|---|---|
| `worldCamera` | `Camera` | `required / unset` | Inspector |
| `targetObjects` | `SceneObject[]` | `[]` | Inspector |
| `useSmoothedHeight` | `boolean` | `true` | Inspector |
| `smoothCoefficient` | `number` | `0.4` | Inspector |
| `minUserToFloorDistanceCm` | `number` | `90.0` | Inspector |
| `maxUserToFloorDistanceCm` | `number` | `250.0` | Inspector |
| `enableLogging` | `boolean` | `false` | Inspector |
| `initialHeight` | `number` | `-100.0` | Script field |
| `updateFrequencySec` | `number` | `2.5` | Script field |
| `afterSuccessTries` | `number` | `6` | Script field |
| `afterSuccessDelaySec` | `number` | `0.08` | Script field |
| `afterSuccessNeedAttempts` | `number` | `3` | Script field |
| `needHits` | `number` | `2` | Script field |
| `rayAnglesDegrees` | `number[]` | `[0, -10, -20, -30]` | Script field |
| `enforceDownwardForNegativeAngles` | `boolean` | `true` | Script field |
| `minDownwardWorldY` | `number` | `0.2` | Script field |
| `rayLength` | `number` | `500.0` | Script field |
| `moveCameraPosForwardAmount` | `number` | `0.0` | Script field |
| `maxDiff` | `number` | `18.0` | Script field |
| `targetWriteEpsilon` | `number` | `0.01` | Script field |
| `lockAfterConsecutiveSuccessfulCycles` | `number` | `2` | Script field |
| `stableSpreadThresholdCm` | `number` | `10.0` | Script field |
| `stableDriftThresholdCm` | `number` | `10.0` | Script field |
| `minAcceptedHitsForLock` | `number` | `4` | Script field |
| `lockedRevalidationIntervalSec` | `number` | `20.0` | Script field |
| `unlockUserDistanceDeltaCm` | `number` | `30.0` | Script field |
| `relockGroundDeltaCm` | `number` | `15.0` | Script field |
| `unlockConsecutiveFailedCycles` | `number` | `4` | Script field |
| `tuningLogIntervalSec` | `number` | `2.0` | Script field |
| `useExperimentalClassificationApi` | `boolean` | `false` | Script field |
| `hitAcceptanceMode` | `number` | `FloorHitAcceptanceMode.PositionOnly` | Script field |
| `nearFloorToleranceCm` | `number` | `12.0` | Script field |
| `degradationWindowSec` | `number` | `5.0` | Script field |
| `degradationMinSamples` | `number` | `8` | Script field |
| `degradationThreshold` | `number` | `0.5` | Script field |
| `degradationConsecutiveWindowsToFallback` | `number` | `2` | Script field |
| `enableHitFilter` | `boolean` | `false` | Script field |

`worldCamera` provides ray origin and orientation, and is mandatory. Targets are cached onAwake; later targetObjects array edits do not rebuild that cache. `useSmoothedHeight` chooses smoothed or committed Y; smoothing applies the coefficient once per frame (not a time-based rate). Distances, height spreads and epsilon are cm; cycle delays/revalidation are seconds; ray pitch offsets are degrees. Logging includes tuning counters, acceptance and lifecycle.

Ray fan defaults to 0/-10/-20/-30 degrees; only negative angles receive the acquiring downward clamp. An attempt needs `needHits`; a cycle needs `afterSuccessNeedAttempts`. `afterSuccessTries` controls attempt budget. `maxDiff` constrains agreement. Successful-cycle streak, spread, drift and accepted-hit thresholds gate lock. Locked cycles run at `lockedRevalidationIntervalSec`; relative wearer-height or ground drift and repeated failed revalidation can unlock.

Experimental classification fields create a classified session only when useExperimentalClassificationApi is true. FloorHitAcceptanceMode: ClassificationOnly=0, PositionOnly=1, ClassificationWithNearFloorFallback=2. Defaults select PositionOnly; no classification required.

## Query methods

| Method | Returns / effect |
|---|---|
| `hasFloor()` | boolean; first floor estimate committed. |
| `getFloorWorldY()` | number; last committed world Y, initialHeight before acquisition. |
| `getSmoothedFloorWorldY()` | number; smoothed world Y, initialHeight before acquisition. |
| `getCalibrationState()` | FloorCalibrationState; Acquiring=0 / Tracking=1 / Locked=2. |
| `isLocked()` | boolean; low-frequency revalidation state. |
| `addOnFloorUpdated(handler: FloorUpdatedHandler)` | Registers `(floorWorldY: number) => void`, called on each commit. |
| `removeOnFloorUpdated(handler)` | Removes first matching callback identity. |
| `addOnCalibrationStateChanged(handler: CalibrationStateChangedHandler)` | Registers `(state: FloorCalibrationState) => void`. |
| `removeOnCalibrationStateChanged(handler)` | Removes first matching callback identity. |

## Lifecycle

onAwake validates camera, gets WorldQuery, caches transforms/rays and starts one hit-test session. SnapDecorators `@bindUpdateEvent` invokes the estimator update. No targets move until hasFloor is true; then only world Y changes. Unsupported WorldQuery/session creation is caught and printed once; updates return without estimation. onDestroy stops the session and empties callbacks. There is no explicit public start/stop/reset or OnDisable session cleanup.
