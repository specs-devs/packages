# ReachyReceiver components

[← Agent usage index](../README.md)

## Use when

Look up every input/public method/event. Named imports use `ReachyReceiver.lspkg/Scripts/<class>`. Private TypeScript fields can be Inspector inputs; consumers must not access them by adding casts. All table defaults are source defaults, not prefab overrides.

## DaemonInterface

Import: `ReachyReceiver.lspkg/Scripts/DaemonInterface`.

| Input | Type | Default | Meaning from source hint |
|---|---|---|---|
| `internetModule` | `InternetModule` | `Unassigned` | InternetModule asset for creating WebSocket connections. The prefab wires the shipped `Module/Internet Module.internetModule`. |
| `enableLogging` | `boolean` | `false` | Enable general logging (operations, events, etc.) |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

Public Start initializes Logger/singleton and connects. Static `getInstance(): DaemonInterface | null`, `isReady(): boolean` (connected socket only). No public events. `internetModule` is a private Inspector input.

| Public method | Signature / behavior |
|---|---|
| setBaseUrl | `(url: string): void`; ignores argument, routes to ws://192.168.1.100:8001/ws. |
| setWebSocketUrl | `(url: string): void`; skip same URL only if connected; otherwise disconnect/reconnect. Call after Start initialization. |
| getBaseUrl | `(): string`; current WebSocket URL. |
| checkConnection | `(): Promise<boolean>`; send health with 2-second request timeout, false on failure. |
| listRecordedMoves | `(datasetName: string): Promise<string[]>`; type list_recorded_moves. |
| playRecordedMove | `(datasetName: string, moveName: string): Promise<string>`; return response.uuid string. |
| stopMove | `(moveUuid: string): Promise<void>`; type stop_move. |
| getRunningMoves | `(): Promise<MoveUUID[]>`; response.moves. |
| goto | `(headPose: XYZRPYPose, bodyYaw?: number, duration=0.5, interpolation="minjerk"): Promise<string>`; request-response uuid. Interpolation string not validated. |
| setTarget | `(headPose: XYZRPYPose, bodyYaw?: number, antennas?: [number,number]): Promise<void>`; fire-and-forget, default antennas [0,0], silently ignored if disconnected. |

Exported `XYZRPYPose`: x/y/z numbers in meters and roll/pitch/yaw in radians. `MoveUUID`: uuid:string. WSMessage and PendingRequest are private interfaces. Request transport assigns numeric _id, waits default 5 seconds, resolves status="ok" and rejects other replies. Only text JSON responses accepted. Socket close rejects pending and schedules fixed 2-second retry. No public connect/disconnect/sendMessage/healthCheck/getConnectionStatus.

## ReachyMiniController

Import: `ReachyReceiver.lspkg/Scripts/ReachyMiniController`.

| Input | Type | Default | Meaning from source hint |
|---|---|---|---|
| `daemonInterface` | `ScriptComponent` | `Unassigned` | Reference to the DaemonInterface component (singleton) |
| `reachyWorldPosition` | `SceneObject` | `Unassigned` | SceneObject representing where Reachy robot is positioned in the AR world (e.g., GlassesCamera or a fixed anchor point) |
| `reachyHeadOffset` | `vec3` | `new vec3(0, 15, 0)` | Offset from reachyWorldPosition to Reachy's head center in local space (default: 0, 15, 0 = 15cm above) |
| `targetSpawnPosition` | `SceneObject` | `Unassigned` | SceneObject reference for where to instantiate/position the target when entering Look-At mode |
| `lookAtTarget` | `ObjectPrefab` | `Unassigned` | Prefab to instantiate as the target that Reachy will follow |
| `HEAD_YAW_SMOOTHING` | `number` | `0.06` | How fast head yaw moves towards target (0.01-0.2, default 0.06) |
| `HEAD_PITCH_SMOOTHING` | `number` | `0.04` | How fast head pitch moves towards target (0.01-0.2, default 0.04) |
| `BODY_SMOOTHING` | `number` | `0.04` | How fast body follows head (0.01-0.2, default 0.04) |
| `ANTENNA_SMOOTHING` | `number` | `0.025` | Antenna smoothing to prevent jitter (0.01-0.1, default 0.025) |
| `MOTION_INTENSITY_SMOOTHING` | `number` | `0.05` | How fast motion intensity adapts (0.01-0.2, default 0.05) |
| `maxYawChangeDegrees` | `number` | `3` | Max yaw change per frame in degrees (1-10, default 3) |
| `maxPitchChangeDegrees` | `number` | `1.5` | Max pitch change per frame in degrees (0.5-5, default 1.5) |
| `maxAntennaChangeDegrees` | `number` | `2` | Max antenna change per frame in degrees (1-5, default 2) |
| `enableWobble` | `boolean` | `true` | Enable character wobble for natural movement |
| `pitchWobbleDegrees` | `number` | `6` | Pitch wobble amplitude in degrees (0-10, default 6) |
| `yawWobbleDegrees` | `number` | `5` | Yaw wobble amplitude in degrees (0-10, default 5) |
| `rollWobbleDegrees` | `number` | `8` | Roll/tilt wobble amplitude in degrees (0-15, default 8) |
| `antennaBaseDegrees` | `number` | `8` | Base antenna movement when idle (0-15, default 8) |
| `antennaMotionDegrees` | `number` | `20` | Extra antenna movement during motion (0-30, default 20) |
| `WOBBLE_SPEED` | `number` | `0.4` | Wobble speed multiplier (0.1-2.0, default 0.4) |
| `enableLogging` | `boolean` | `false` | Enable general logging (operations, events, etc.) |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

All inputs except the two logging flags are private. Public decorated `onStart(): void` initializes Logger and enters Idle. Public `setStateFromUI(idle: boolean): void` selects true=Idle, false=LookAtTarget. No public getters/events. RobotState enum and state helpers are private/unexported.

Idle attempts a neutral goto and loops dataset pollen-robotics/reachy-mini-emotions-library move attentive2, polling completion every .1 second only when it has a UUID. LookAt instantiates target under targetSpawnPosition at local origin/identity, animates to uniform .3 scale over 1 second, starts Update tracking; Idle hides over 1 second and destroys it. AR distances/offsets use cm; daemon pose position uses meters but this controller sends zero XYZ and computed angles.

Head/body yaw and antenna updates use per-frame smoothing/clamps; limits pitch −30°/+20°, head yaw allowance ±35° relative body, body ±160°, antenna ±45°, roll ±10°. Wobble layers sin waves over elapsed time. Robot world rotation applies to head offset only; angle computation uses world direction. Source sends antenna tuple [right,left], despite daemon method comment labeling [left,right]. Imported stream sends each Update when ready, no guaranteed 60 fps.

## ReachyUIController

Import: `ReachyReceiver.lspkg/Scripts/ReachyUIController`.

| Input | Type | Default | Meaning from source hint |
|---|---|---|---|
| `enableLogging` | `boolean` | `false` | Enable general logging (operations, events, etc.) |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

Only logging fields are Inspector inputs. Public `initialize(uiManager: any, reachyController: any)` stores references, initializes Logger/mode, binds sliders/switches and syncs. Public `syncUIFromController()`, `enableSimulationMode()`, `enableRealRobotMode()`, `applyRoboticPreset()`, `applyNaturalPreset()`, `applyExpressivePreset()`. These return void. No public events/getters. simulationUrl/realRobotUrl/startInSimulationMode are private hardcoded getters, both URLs http://localhost:8000, startup simulation=false. Both mode methods call singleton setBaseUrl which ignores URL.

Sliders map normalized 0–1 to Mini fields: headYawSpeedSlider→HEAD_YAW_SMOOTHING(.01–.2), headPitchSpeedSlider→HEAD_PITCH_SMOOTHING(.01–.2), bodyFollowSpeedSlider→BODY_SMOOTHING(.01–.2), antennaSpeedSlider→ANTENNA_SMOOTHING(.01–.1), motionIntensitySlider→MOTION_INTENSITY_SMOOTHING(.01–.2), maxYawSlider→maxYawChangeDegrees(1–10), maxPitchSlider→maxPitchChangeDegrees(.5–5), maxAntennaSlider→maxAntennaChangeDegrees(1–5), pitchWobbleSlider→pitchWobbleDegrees(0–10), yawWobbleSlider→yawWobbleDegrees(0–10), rollWobbleSlider→rollWobbleDegrees(0–15), baseAntennaSlider→antennaBaseDegrees(0–15), wobbleSpeedSlider→WOBBLE_SPEED(.1–2). There is no antennaMotion slider. Tracking numeric value 0 selects Idle, all other values select LookAt; wobble only numeric 1 enables.

Preset rows below follow field order: HEAD_YAW_SMOOTHING, HEAD_PITCH_SMOOTHING, BODY_SMOOTHING, ANTENNA_SMOOTHING, MOTION_INTENSITY_SMOOTHING, maxYawChangeDegrees, maxPitchChangeDegrees, maxAntennaChangeDegrees, enableWobble, pitchWobbleDegrees, yawWobbleDegrees, rollWobbleDegrees, antennaBaseDegrees, WOBBLE_SPEED.

| Preset | Values in listed order |
|---|---|
| Robotic | .15, .15, .1, .05, .1, 10, 5, 5, false, 0, 0, 0, 2, .1 |
| Natural | .06, .04, .04, .025, .05, 3, 1.5, 2, true, 6, 5, 8, 8, .4 |
| Expressive | .03, .02, .02, .02, .03, 2, 1, 1.5, true, 10, 8, 12, 12, .6 |

Presets update properties, slider positions and wobble switch; antennaMotionDegrees remains unchanged. Existing dynamic-any source is not an invitation to cast consumer private accesses. Repeated initialize can duplicate bindings.

## ReachyUIManager

Import: `ReachyReceiver.lspkg/Scripts/ReachyUIManager`.

| Input | Type | Default | Meaning from source hint |
|---|---|---|---|
| `panelTracking` | `SceneObject` | `Unassigned` | Tracking mode panel (also serves as intro/home) |
| `panelSpeed` | `SceneObject` | `Unassigned` | Speed controls panel |
| `panelMovements` | `SceneObject` | `Unassigned` | Movement limits panel |
| `panelCharacter` | `SceneObject` | `Unassigned` | Character/wobble panel |
| `panelPresets` | `SceneObject` | `Unassigned` | Presets panel |
| `trackingModeSwitch` | `Switch` | `Unassigned` | Main tracking mode toggle (Idle vs Look-At) |
| `robotModeToggleGroup` | `SwitchToggleGroup` | `Unassigned` | Toggle group for Simulation vs Real Robot selection |
| `enableSimulationSwitch` | `Switch` | `Unassigned` | Enable Simulation mode switch |
| `enableReachySwitch` | `Switch` | `Unassigned` | Enable Real Robot mode switch |
| `headYawSpeedSlider` | `Slider` | `Unassigned` | Head yaw speed slider (0.01-0.2) |
| `headPitchSpeedSlider` | `Slider` | `Unassigned` | Head pitch speed slider (0.01-0.2) |
| `bodyFollowSpeedSlider` | `Slider` | `Unassigned` | Body follow speed slider (0.01-0.2) |
| `antennaSpeedSlider` | `Slider` | `Unassigned` | Antenna speed slider (0.01-0.1) |
| `motionIntensitySlider` | `Slider` | `Unassigned` | Motion intensity slider (0.01-0.2) |
| `maxYawSlider` | `Slider` | `Unassigned` | Max yaw speed slider (1-10 degrees) |
| `maxPitchSlider` | `Slider` | `Unassigned` | Max pitch speed slider (0.5-5 degrees) |
| `maxAntennaSlider` | `Slider` | `Unassigned` | Max antenna speed slider (1-5 degrees) |
| `enableWobbleSwitch` | `Switch` | `Unassigned` | Enable wobble toggle |
| `pitchWobbleSlider` | `Slider` | `Unassigned` | Pitch wobble slider (0-10 degrees) |
| `yawWobbleSlider` | `Slider` | `Unassigned` | Yaw wobble slider (0-10 degrees) |
| `rollWobbleSlider` | `Slider` | `Unassigned` | Roll wobble slider (0-15 degrees) |
| `baseAntennaSlider` | `Slider` | `Unassigned` | Base antenna movement slider (0-15 degrees) |
| `wobbleSpeedSlider` | `Slider` | `Unassigned` | Wobble speed slider (0.1-2.0) |
| `presetToggleGroup` | `SwitchToggleGroup` | `Unassigned` | Preset toggle group (manages Robotic/Natural/Expressive switches) |
| `roboticPresetSwitch` | `Switch` | `Unassigned` | Robotic preset switch |
| `naturalPresetSwitch` | `Switch` | `Unassigned` | Natural preset switch |
| `expressivePresetSwitch` | `Switch` | `Unassigned` | Expressive preset switch |
| `closeButton` | `BaseButton` | `Unassigned` | X button in top-left corner (returns to Tracking panel) |
| `panelNavButtons` | `BaseButton[]` | `Unassigned` | Left sidebar panel navigation buttons array: [0]=Tracking, [1]=Speed, [2]=Movements, [3]=Character, [4]=Presets |
| `uiController` | `ScriptComponent` | `Unassigned` | ReachyUIController component |
| `reachyController` | `ScriptComponent` | `Unassigned` | ReachyMiniController component (the robot controller) |
| `enableLogging` | `boolean` | `false` | Enable general logging (operations, events, etc.) |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

All object/component inputs allowUndefined and start unassigned. Only public method is decorated `onStart(): void`: Logger, show Tracking/hide others, bind buttons/robot/preset groups, call UIController.initialize(this,reachyController). Navigation helpers and panel enable methods are private. No public events/getters.

panelNavButtons order: Tracking, Speed, Movements, Character, Presets; needs at least five. closeButton TriggerUp returns home when assigned (prefab null). Robot group onToggleSelected compares toggleable with simulation/Reachy switches. Prefab wiring (Panel-Tracking, top to bottom): `trackingModeSwitch` = "Idle vs Look at", `enableSimulationSwitch` = "Enable Simulation", `enableReachySwitch` = "Enable Real Robot"; the last two are the `_switches` of `robotModeToggleGroup`. Preset group compares with Robotic/Natural/Expressive. Warnings explain missing references/events.

## UIFrameAnimator

Import: `ReachyReceiver.lspkg/Scripts/UIFrameAnimator`.

| Input | Type | Default | Meaning from source hint |
|---|---|---|---|
| `initialVisibility` | `boolean` | `true` | Initial visibility state of the frame |
| `defaultScale` | `vec3` | `new vec3(1, 1, 1)` | Default scale of the frame when visible |
| `frame` | `Frame \| null` | `null` | Frame component to animate |
| `enableLogging` | `boolean` | `false` | Enable general logging (operations, events, etc.) |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

Not used by any shipped prefab; add it yourself to animate a Frame. initialVisibility/defaultScale/frame are private Inspector inputs. Public decorated `onStart(): void` initializes Logger and sets local XYZ=0 only when initially hidden. Public `animateShow(): Promise<void>`, `animateHide(): Promise<void>`, `animateFrameVisibility(visible: boolean, transform?: Transform): Promise<void>`. Readonly `onFrameVisibilityChanged: PublicApi<boolean>` supports .add callback. No public current-visibility getter.

Frame required despite null default. Same current visibility returns early (ignoring supplied transform). Optional transform copies world position/rotation and temporarily disables Frame following. Show scale→defaultScale in .6 sec; Hide→(defaultX,0,defaultZ) in .39 sec with ease-in-out-quad. Cancellation resolves prior work, which can still restore following, change private visibility and invoke event. No generic animate(targetPosition,duration) API.

## ControllerLookAtTarget

Import: `ReachyReceiver.lspkg/Scripts/ControllerLookAtTarget`.

| Input | Type | Default | Meaning from source hint |
|---|---|---|---|
| `enableLogging` | `boolean` | `false` | Enable general logging (operations, events, etc.) |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

Only logging inputs and public decorated `onStart(): void` (Logger initialization). Placeholder with no robot targeting logic, public commands or events. No shipped prefab uses it.

## Demo scaffolding (`Example/`)

These scripts ship in `ReachyReceiver.lspkg/Example/` and are wired inside
`ReachyReceiver__PLACE_IN_SCENE.prefab`. They only present the demo; the
Reachy components don't need them.

| Object / script | Class | Key inputs |
|---|---|---|
| `Guide`: `Example/GuideDismissPanel/GuideDismissPanel.ts` | `GuideDismissPanel` | `hideUntilDismissed: SceneObject[]` lists the objects hidden until "Ok, I understood" is pressed (here: `ExampleCarousel` and `ReachyController`). `buttonLabel: string = "Ok, I understood"` is only used when the panel is built at runtime |
| `ExampleCarousel`: `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (here: `ReachyController`), `exampleInfo: string[]` (one line per example), `steps: SceneObject[]` (empty here), `stepInfo: string[] = []` (one line per step, same order as `steps`; empty entries fall back to the example info), `startIndex: number = 0`, `previousLabel` / `nextLabel`, `examplesPushBack: number = 20`, `anchorExamples: boolean = true` (prefab: `false`, so the robot reference and panel stay where they are authored), `startMinimized: boolean = false` (prefab: `true`), `extraPanelDrop: number = 0` (prefab: `15`) |

Both inputs point at the `ReachyController` group rather than the prefab root,
because hiding the root would also hide the guide and the carousel. With a
single example the carousel hides Previous / Next and only carries the guidance.

## Prefabs, bridge and assets

- `ReachyReceiver__PLACE_IN_SCENE.prefab`: the demo (guide, carousel, `ReachyController` group). Uses DaemonInterface, ReachyMiniController, ReachyUIController, ReachyUIManager, GuideDismissPanel and ExampleCarousel.
- `Prefabs/GrabThisReachyWillFollow.prefab`: the Look At target wired to ReachyMiniController `lookAtTarget`.
- `Prefabs/Snap3DInteractable.prefab`: extra resource, not wired by default. `Prefabs/move_gizmo/`: the ReachyReference move gizmo model.
- `Module/Internet Module.internetModule`: the InternetModule asset DaemonInterface needs. Wire it to `internetModule` if you build your own scene.
- `WebsocketExamples/websocket_bridge.py`: Python bridge from the Lens WebSocket (`--ws-port`, default 8001, path `/ws`, plus `GET /health`) to the daemon (`--daemon-url`, default `http://localhost:8000`). Needs `aiohttp` and `websockets`.
- `WebsocketExamples/test_websocket.py`: bridge test client (`--url`, default `ws://localhost:8001/ws`). It sends goto, play_recorded_move and set_target, so it moves a connected robot.
- `Visuals/`: materials, shaders and textures for the panel visuals (ActivityIndicator, AI Visual, MicIcon, CloseIcon, Image, `image_unlit.graphShader`, `Plane.mesh`). `Texture/reachy-icon.png` / `.svg`: package icon.
