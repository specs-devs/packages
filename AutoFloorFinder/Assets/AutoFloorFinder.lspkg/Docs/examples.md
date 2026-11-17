# AutoFloorFinder examples

[← Agent usage index](../README.md)

## Use when

Set up the prefab or subscribe from a typed consumer script.

## Setup

**Fastest**: drag `AutoFloorFinder__PLACE_IN_SCENE.prefab` into your scene and set
**World Camera** to your main (Device Tracking) camera. The prefab contains the component plus a
visible `Floor Marker` plate already wired into **Target Objects** — press play and the plate
snaps to the floor. It also brings the demo guide panel and example carousel (scripts in
`Example/`); delete `Guide` and `ExampleCarousel` for your own Lens. Swap the marker for your own
content, or delete it and use the script API.

**Manual**:

1. Add **Auto Floor Finder** to any SceneObject.
2. Set **World Camera** to your main (Device Tracking) camera.
3. Either:
   - add SceneObjects to **Target Objects** — their world Y is pinned to the floor height, or
   - use the script API from your own components (below), or both.

**World Camera** is required and validated at start — the component throws a descriptive error in
`onAwake` if it is missing. It never scans the scene for a camera (see the runtime-discipline
rules: dependencies are wired explicitly, no hierarchy searches at setup).

Target objects keep their **authored positions** until the first floor commit — the component
never writes a placeholder height, so place your content where it should sit while the floor is
being acquired (depending on hit availability and cycle voting).

The WorldQuery module is acquired internally (`require("LensStudio:WorldQueryModule")`) — no module
wiring needed. Requires a WorldQuery-capable runtime (SPECS).

## Script API

```text
@input floorFinder: AutoFloorFinder;

onAwake() {
    this.floorFinder.addOnFloorUpdated((floorY: number) => {
        print("floor committed at world Y " + floorY);
    });
    this.floorFinder.addOnCalibrationStateChanged((state) => {
        // 0 = Acquiring, 1 = Tracking, 2 = Locked
    });
}

update() {
    if (this.floorFinder.hasFloor()) {
        const y = this.floorFinder.getSmoothedFloorWorldY();
    }
}
```

- `hasFloor(): boolean` — true once a first estimate is committed.
- `getFloorWorldY(): number` — last committed floor height (world Y, cm).
- `getSmoothedFloorWorldY(): number` — exponentially smoothed height (what targets follow).
- `getCalibrationState(): number` — 0 Acquiring, 1 Tracking, 2 Locked. `isLocked(): boolean`.
- `addOnFloorUpdated / removeOnFloorUpdated` — fires on every commit.
- `addOnCalibrationStateChanged / removeOnCalibrationStateChanged` — fires on stage transitions.

### Recipe: place content on the floor in front of the user at launch

`targetObjects` pins Y only. To also position content along the wearer's (flattened) forward when
the floor is first found, use a one-shot handler — no per-frame work:

```text
@input floorFinder: AutoFloorFinder;
@input worldCamera: Camera;
@input content: SceneObject;

onAwake() {
    const placeOnce = (floorY: number) => {
        this.floorFinder.removeOnFloorUpdated(placeOnce); // first commit only
        const camTransform = this.worldCamera.getSceneObject().getTransform();
        const camPos = camTransform.getWorldPosition();
        const fwd = camTransform.back; // -Z forward
        const flatLen = Math.sqrt(fwd.x * fwd.x + fwd.z * fwd.z);
        const nx = flatLen > 1e-5 ? fwd.x / flatLen : 0;
        const nz = flatLen > 1e-5 ? fwd.z / flatLen : -1;
        const distanceCm = 150;
        const t = this.content.getTransform();
        t.setWorldPosition(new vec3(camPos.x + nx * distanceCm, floorY, camPos.z + nz * distanceCm));
        t.setWorldRotation(quat.fromEulerAngles(0, Math.atan2(nx, nz), 0)); // yaw-only, face the wearer
    };
    this.floorFinder.addOnFloorUpdated(placeOnce);
}
```

For interactive placement (hover, drag, confirm), use the **SurfacePlacement** package instead —
that's its job; this component only owns the floor height.

## Tuning

Sensible defaults work out of the box. The Inspector deliberately exposes only the
experience-level decisions:

| Inspector input | Default | What it does |
|---|---|---|
| `worldCamera` | — | Required. Ray-basis camera; throws in `onAwake` if unset. |
| `targetObjects` | empty | SceneObjects whose world Y is pinned to the floor (after first commit). |
| `useSmoothedHeight` / `smoothCoefficient` | on / 0.4 | Smooth target writes vs raw commits. |
| `minUserToFloorDistanceCm` / `maxUserToFloorDistanceCm` | 90 / 250 | Plausibility band for accepted hits. **Lower the min for seated use.** |
| `enableLogging` | off | Tuning stats, cycle diagnostics, lifecycle transitions. |

Estimator internals (cycle cadence, ray fan, voting thresholds, lock/unlock rules) are public
fields on the component rather than Inspector inputs. To override one, set it from a script that
runs before this component's `onAwake` — i.e. on a SceneObject *above* it in the Scene Hierarchy:

```text
@input floorFinder: AutoFloorFinder;

onAwake() {
    this.floorFinder.updateFrequencySec = 1.0;
    this.floorFinder.rayAnglesDegrees = [0, -15, -30];
}
```

The most useful ones (defaults are field-tuned for a stable, quickly-locking floor):

| Field | Default | What it does |
|---|---|---|
| `updateFrequencySec` | 2.5 | Seconds between estimation cycles (pre-lock). |
| `rayAnglesDegrees` | 0, -10, -20, -30 | Downward ray-fan pitch offsets from camera forward. |
| `maxDiff` | 18 | Max height spread (cm) for hits/attempts to count as consistent. |
| `lockAfterConsecutiveSuccessfulCycles` | 2 | Stability streak required to lock. |
| `lockedRevalidationIntervalSec` | 20 | Revalidation cadence while locked. |
| `unlockUserDistanceDeltaCm` / `relockGroundDeltaCm` | 30 / 15 | How far things must shift (cm) before an unlock. |

**Experimental options (both off by default):**

- `useExperimentalClassificationApi` enables WorldQuery surface classification as a hit filter
  (`hitAcceptanceMode` 0–2). If classification quality degrades at runtime, the component detects
  it and automatically falls back to position-only acceptance.
- `enableHitFilter` enables WorldQuery's session-level hit filtering. It depends on the
  experimental WorldQuery filtering API, so it ships off — the estimator's own voting and
  plausibility checks are designed to handle raw-hit noise without it.

## Troubleshooting

- **`AutoFloorFinder ERROR: WorldQuery hit-test session unavailable`** (or the Lens logs
  `Cannot invoke 'create': API not available on the simulated platform`): the Preview panel is not
  simulating a SPECS runtime. Set the Preview device to SPECS or run on device — the
  component logs this once and disables itself instead of crashing the Lens.
- **Never finds a floor**: enable `enableLogging` and watch the `tune` line. `zero raw hits`
  means WorldQuery isn't available (unsupported runtime) or tracking hasn't initialized;
  consistent rejections usually mean the camera-to-floor distance is outside the plausibility
  band (seated user → lower `minUserToFloorDistanceCm`).
- **Floor jumps to a table/desk**: tighten `maxUserToFloorDistanceCm` and keep some downward
  angles in `rayAnglesDegrees` so the fan sees real floor, not just surfaces ahead.
- **Slow to lock**: reduce `lockAfterConsecutiveSuccessfulCycles` or relax
  `stableSpreadThresholdCm` / `stableDriftThresholdCm`.


## Complete typed consumer

```ts
import {AutoFloorFinder, FloorCalibrationState} from "AutoFloorFinder.lspkg/Scripts/AutoFloorFinder";

@component
export class FloorConsumer extends BaseScriptComponent {
    @input floorFinder: AutoFloorFinder;
    private floorUpdated = (floorY: number): void => {
        console.log(`Committed floor Y: ${floorY}cm`);
    };
    private stateUpdated = (state: FloorCalibrationState): void => {
        console.log(`Floor calibration: ${FloorCalibrationState[state]}`);
    };
    onAwake(): void {
        this.createEvent("OnStartEvent").bind(() => {
            this.floorFinder.addOnFloorUpdated(this.floorUpdated);
            this.floorFinder.addOnCalibrationStateChanged(this.stateUpdated);
            if (this.floorFinder.hasFloor()) {
                this.floorUpdated(this.floorFinder.getFloorWorldY());
            }
        });
        this.createEvent("OnDestroyEvent").bind(() => {
            if (!isNull(this.floorFinder)) {
                this.floorFinder.removeOnFloorUpdated(this.floorUpdated);
                this.floorFinder.removeOnCalibrationStateChanged(this.stateUpdated);
            }
        });
    }
}
```

The reference fragments above assume the same import and a `@component` class; their update method also needs an UpdateEvent binding. Use exact callback identities to unsubscribe. Subscribe in OnStart for cross-component access; an earlier floor commit can be recovered using hasFloor/getFloorWorldY. Advanced configuration must be set before AutoFloorFinder.onAwake, whereas consumer subscriptions can happen later.
