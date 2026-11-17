# ReachyReceiver guide

[← Agent usage index](../README.md)

## Use when

Read the original network/bridge/robot tutorial and panel workflow, corrected against the shipped source. Simulation and Real Robot mode both route to the same hardcoded bridge. Read [Components](components.md) and [API status](api-status.md) for the full API. No bridge, simulator or robot was started by this pass.

## Resources

- **[Pollen Robotics Reachy Mini](https://pollen-robotics.com/reachy-mini/)** - Learn more about the Reachy Mini robot
- **WebSocket bridge (ships in this package)** - `ReachyReceiver.lspkg/WebsocketExamples/`
  - `websocket_bridge.py` - Python bridge between the Lens WebSocket and the Reachy Mini daemon (needs `aiohttp` and `websockets`). Flags: `--daemon-url` (default `http://localhost:8000`), `--ws-port` (default `8001`), `--debug`. Serves `ws://0.0.0.0:<ws-port>/ws` and `GET /health`.
  - `test_websocket.py` - test client for the bridge. Flag: `--url` (default `ws://localhost:8001/ws`). It sends health, goto, get_running_moves, play_recorded_move, stop_move and set_target, so it moves a connected robot.
- **[Pollen Robotics Reachy Mini repo](https://github.com/pollen-robotics/reachy_mini)** - daemon and simulator
- **[MuJoCo Simulator](https://pollen-robotics-reachy-mini.hf.space/#/getting-started)** - Test with simulation before deploying to physical robot

---

## Features

- **WebSocket Client**: Robot control with a fixed 2-second reconnect and an on-demand `checkConnection()` health request
- **Dual-Mode Operation**: Switch between Idle (pre-recorded animations) and Look-At Target (real-time tracking) modes
- **Real-Time Head Tracking**: target commands sent on every Update while connected (no fixed rate), with smooth interpolation and character-driven wobble
- **Body Following**: Automatic body yaw control that follows head movement with configurable inertia
- **Antenna Animation**: Synchronized antenna movement with motion intensity for expressive character
- **UI Control System**: Five-panel interface for tracking, speed, movement limits, character, and presets
- **Robot Mode Toggle**: Simulation / Real Robot switches (both currently route to the same bridge URL; the bridge decides which daemon it talks to)
- **Preset System**: Robotic, Natural, and Expressive presets for instant personality changes
- **Configurable Parameters**: Real-time adjustment of smoothing, limits, wobble, and animation speeds
- **Look-At Target Instantiation**: Runtime prefab instantiation with automatic lifecycle management
- **Connection Health Check**: `isReady()` for socket state and `checkConnection()` for a daemon health round trip

## Quick Start

Use the shipped prefab: drag `ReachyReceiver.lspkg/ReachyReceiver__PLACE_IN_SCENE.prefab` into a Specs scene. It already wires DaemonInterface (with `Module/Internet Module.internetModule`), ReachyMiniController, ReachyUIController and ReachyUIManager, the five UI panels and the `Prefabs/GrabThisReachyWillFollow.prefab` target. Most component inputs are private Inspector fields, so wire them in the Inspector rather than from code. Then:

1. Set `COMPUTER_IP` in `Scripts/DaemonInterface.ts` to the IP of the computer running the bridge.
2. Start the simulator or robot daemon and `websocket_bridge.py` ([bridge setup](#websocket-bridge-setup)).
3. Run the Lens; DaemonInterface connects on Start. To drive the controller from your own UI, see [Examples](examples.md).

## Script Highlights

### DaemonInterface.ts

Manages the WebSocket connection to the Python bridge (`ws://COMPUTER_IP:8001/ws`). Registers a singleton on Start, exposed through static `getInstance()` and `isReady()` (socket connected). When the socket closes it rejects pending requests and retries after a fixed 2 seconds; there is no backoff, attempt limit or periodic health polling. Requests carry a numeric `_id` and time out after 5 seconds. Public methods: `setBaseUrl()` (ignores its argument and uses COMPUTER_IP), `setWebSocketUrl()`, `getBaseUrl()`, `checkConnection()`, `listRecordedMoves()`, `playRecordedMove()`, `stopMove()`, `getRunningMoves()`, `goto()` and fire-and-forget `setTarget()`. Connect, disconnect and message sending are private. See [Components](components.md#daemoninterface).

### ReachyMiniController.ts

Central robot control orchestrator managing state transitions between Idle and LookAtTarget modes. Implements Idle mode with automatic playback of "attentive2" pre-recorded animation loop, move completion checking via polling, and automatic replay on completion. Features LookAtTarget mode with real-time target tracking, runtime prefab instantiation/destruction, and per-Update set_target commands to the daemon on every Update. Provides smooth head tracking with configurable yaw/pitch smoothing (0.01-0.2 range), velocity-based motion intensity calculation, and mechanical limit enforcement. Implements body following behavior with inertia-based body yaw that lags behind head movement and separate body smoothing parameter. Features character-driven wobble system with pitch/yaw/roll wobble amplitudes (sine wave based on elapsed time), wobble speed multiplier, and motion intensity blending. Manages antenna animation with base amplitude for idle movement, additional motion amplitude during tracking, and smooth interpolation with jitter prevention. Includes coordinate system conversion for AR space with reachyWorldPosition defining robot location, reachyHeadOffset for head center calculation, and world-to-local transform math. Provides parameter clamping with per-frame change limits (MAX_YAW_CHANGE_PER_FRAME, MAX_PITCH_CHANGE_PER_FRAME), mechanical joint limits (MIN_PITCH, MAX_PITCH, MAX_HEAD_YAW), and antenna/roll constraints. The only public state method is `setStateFromUI(idle: boolean)` (true = Idle, false = LookAtTarget); the enter/exit state helpers are private. Uses the bindUpdateEvent decorator for tracking and Idle move-completion polling, sending a target on each Update while connected (no fixed rate).

### ReachyUIController.ts

Maps UI slider and switch values to ReachyMiniController parameters for real-time robot control. Implements slider configuration system with SliderConfig interface defining min/max ranges, controller property mapping, and human-readable labels. Provides preset system with applyRoboticPreset() (fast, precise, no wobble), applyNaturalPreset() (balanced, medium wobble), and applyExpressivePreset() (slow, high wobble, animated). Features robot mode switching with enableSimulationMode() and enableRealRobotMode(); both call DaemonInterface.setBaseUrl(), which ignores the URL, so the mode changes no connection. Implements UI synchronization with syncUIFromController() reading Inspector values and updating slider positions at initialization. Manages slider callbacks with onSliderChanged() mapping normalized values to actual parameter ranges and live parameter updates. Handles switch callbacks with onTrackingModeChanged() for Idle/LookAtTarget toggle and onWobbleChanged() for enable/disable wobble. Provides initialization flow with initialize() called by ReachyUIManager, logger setup, robot mode configuration, and setupSliders()/setupSwitches() calls. Includes value normalization with slider ranges mapped to parameter ranges (e.g., 0.01-0.2 mapped to 0-100 slider) and reverse mapping for syncUIFromController(). Features logging integration with configurable log levels, initialization lifecycle logging, and parameter change logging for debugging.

### ReachyUIManager.ts

Orchestrates UI component lifecycle and panel navigation for five-panel control interface. Manages panel visibility with showTrackingPanel() (home), showPanel() (generic), setPanelEnabled() helper, and hideAllPanels() utility. Implements navigation system with bindNavigationButtons() for left sidebar panel buttons, closeButton binding for home/X button, and onPanelButtonPressed() callbacks. Handles tracking panel with trackingModeSwitch (Idle/LookAtTarget toggle) and robotModeToggleGroup (Simulation/Real Robot selection). Manages speed controls panel with slider assignments for head yaw/pitch, body follow, antenna, and motion intensity speeds. Includes movement limits panel with maxYawChange, maxPitchChange, maxAntennaChange slider configurations. Features character/wobble panel with wobble enable switch, pitch/yaw/roll wobble sliders, antenna base/motion sliders, and wobble speed control. Provides presets panel with roboticPreset, naturalPreset, expressivePreset button bindings. Implements component initialization with onStart() lifecycle, showTrackingPanel() default view, and controller.initialize() call. Includes robot mode switch handling with bindRobotModeSwitches(), SwitchToggleGroup integration, and enableSimulation/enableReachy switch configuration. Features preset button handling with bindPresetSwitches() connecting buttons to UIController preset methods. Provides logging integration with initialization logging, panel change logging, and switch state logging. Handles component references with explicit @input assignments for all UI elements and validation checks for undefined components.

### UIFrameAnimator.ts

Scales a UIKit Frame in and out. Public `animateShow()`, `animateHide()` and `animateFrameVisibility(visible, transform?)` return Promises; `onFrameVisibilityChanged` fires after each transition. Show scales to `defaultScale` in 0.6 s, hide scales Y to 0 in 0.39 s. There is no `animate(position, duration)` API. Not wired in the shipped prefabs.

### ControllerLookAtTarget.ts

Simple placeholder component for the look-at target prefab. Provides logging initialization with Logger integration and lifecycle debug output. Includes Inspector configuration with logging enable toggles. Designed as attachment point for future target behaviors like animation, effects, or user interaction. Not wired in the shipped prefabs.

## Network Architecture

```
SPECS (Lens Studio)
    ↓ WebSocket (ws://COMPUTER_IP:8001/ws)
WebSocket Bridge (Python)
    ↓ WebSocket + HTTP (ws://DAEMON_IP:8000/api/move/ws/set_target)
    ↓ HTTP REST (http://DAEMON_IP:8000/api/move/*)
Reachy Mini Daemon (MuJoCo or Physical Robot)
```

## Configuration

### Inspector Setup (Required)

**DaemonInterface Component:**
- internetModule: `ReachyReceiver.lspkg/Module/Internet Module.internetModule` (already wired in the prefab)
- COMPUTER_IP: a private static constant in `DaemonInterface.ts`, not an Inspector field; edit it to your computer's network IP (see [TypeScript Configuration](#typescript-configuration))

**ReachyMiniController Component:**
- daemonInterface: Assign DaemonInterface component
- Reachy Position in AR Space:
  - reachyWorldPosition: SceneObject where Reachy exists in AR (typically GlassesCamera or fixed anchor)
  - reachyHeadOffset: Offset from position to head center (default: 0, 15, 0 = 15cm above)
- Look-At Target Configuration:
  - targetSpawnPosition: SceneObject defining where to instantiate target when entering Look-At mode
  - lookAtTarget: ObjectPrefab to instantiate as target Reachy will follow

**ReachyUIController Component:**
- Only logging inputs. `simulationUrl`, `realRobotUrl` (both `http://localhost:8000`) and `startInSimulationMode` (`false`) are private getters over static constants in `ReachyUIController.ts`, not Inspector fields.

**ReachyUIManager Component:**
- Assign all panel SceneObjects (panelTracking, panelSpeed, panelMovements, panelCharacter, panelPresets)
- Assign all UI component references (sliders, switches, buttons from UIKit)
- Assign uiController: ReachyUIController component
- Assign reachyController: ReachyMiniController component

### WebSocket Bridge Setup

**For Simulation:**
```bash
# Install dependencies
pip install aiohttp websockets

# Start MuJoCo simulator
mjpython -m reachy_mini.daemon.app.main --sim --scene minimal

# Start bridge (ships in ReachyReceiver.lspkg/WebsocketExamples/)
python3 websocket_bridge.py --daemon-url http://localhost:8000 --ws-port 8001
```

**For Real Robot:**
```bash
# Find robot IP
nmap -p 8000 192.168.1.0/24

# Start robot daemon
curl -X POST "http://ROBOT_IP:8000/api/daemon/start?wake_up=true"

# Start bridge
python3 websocket_bridge.py --daemon-url http://ROBOT_IP:8000 --ws-port 8001
```

### TypeScript Configuration

Update `COMPUTER_IP` in `DaemonInterface.ts`:
```text
private static readonly COMPUTER_IP: string = "YOUR_COMPUTER_IP";  // e.g., "192.168.1.100"
```

Update `START_IN_SIMULATION_MODE` in `ReachyUIController.ts`:
```text
private static readonly START_IN_SIMULATION_MODE: boolean = false;  // false = real robot
```

## UI Panels

**Panel 1 - Tracking Mode**
- Tracking toggle: Switch between Idle and Look-At Target
- Robot mode: Choose Simulation (localhost) or Real Robot (network IP)

**Panel 2 - Speed Controls**
- Head yaw/pitch speed, body follow speed, antenna speed, motion intensity
- Only affects Look-At Target mode

**Panel 3 - Movement Limits**
- Max yaw/pitch/antenna speeds per frame
- Only affects Look-At Target mode

**Panel 4 - Character/Wobble**
- Enable wobble, pitch/yaw/roll wobble, antenna movement, wobble speed
- Only affects Look-At Target mode

**Panel 5 - Presets**
- Robotic: Fast, precise, no wobble
- Natural: Balanced, medium wobble
- Expressive: Slow, high wobble, animated
- Only affects Look-At Target mode

## Understanding the Two Modes

**Idle Mode**: Plays a pre-recorded "attentive2" animation on loop. All UI parameters (sliders, wobble, presets) are ignored. The animation is a fixed sequence like a video file.

**Look-At Target Mode**: Real-time control where the robot tracks the AR target. When you toggle this ON:
1. The lookAtTarget prefab is instantiated at targetSpawnPosition
2. The target animates in (scales from 0 to full size)
3. Reachy starts tracking this target in real-time
4. All UI parameters work - smoothing speeds, wobble settings, movement limits, and presets affect how the robot moves
5. You can move the instantiated target anywhere in the scene and Reachy will follow
6. When you toggle back to Idle, the target is destroyed

To test presets or parameter changes, you must be in Look-At Target mode.

## Protocol

The bridge accepts JSON messages via WebSocket:

**Health Check:**
```json
{"type": "health", "_id": 1}
```

**Set Target (sent each Update while tracking):**
```json
{
  "type": "set_target",
  "head_pose": {"x": 0, "y": 0, "z": 0, "roll": 0, "pitch": 0, "yaw": 0},
  "body_yaw": 0,
  "antennas": [0, 0],
  "_id": 2
}
```

**Goto (interpolated movement):**
```json
{
  "type": "goto",
  "head_pose": {"x": 0, "y": 0, "z": 0, "roll": 0, "pitch": 0, "yaw": 0},
  "body_yaw": 0,
  "duration": 0.5,
  "interpolation": "minjerk",
  "_id": 3
}
```

**Play Recorded Move:**
```json
{
  "type": "play_recorded_move",
  "dataset_name": "pollen-robotics/reachy-mini-emotions-library",
  "move_name": "attentive2",
  "_id": 4
}
```

**Stop Move:**
```json
{
  "type": "stop_move",
  "uuid": "move-uuid-from-play-response",
  "_id": 5
}
```

## Troubleshooting

### Robot Not Moving

Check all components are running:
```bash
# 1. Check daemon is running
curl http://ROBOT_IP:8000/api/health
# Expected: {"status": "ok"}

# 2. Check bridge is running
curl http://localhost:8001/health
# Expected: {"status": "ok", "daemon_url": "http://..."}

# 3. Check Lens Studio Logger for WebSocket connection status
# Should see: "WebSocket connected successfully"
```

### Panels All Showing at Startup

Verify ReachyUIManager.onStart() executes properly:
1. Check for TypeScript compilation errors in Lens Studio
2. Enable logging on ReachyUIManager component
3. Check Logger output for "Initialization complete" message
4. Verify panel SceneObject assignments in Inspector

### Parameters Not Working

All parameter changes only work in Look-At Target mode. If in Idle mode, the pre-recorded animation overrides everything. Toggle tracking switch to enable Look-At Target mode.

### Target Not Appearing

If robot doesn't follow target:
- Verify reachyWorldPosition is assigned (where Reachy is in AR space)
- Verify targetSpawnPosition is assigned (where target is instantiated)
- Verify lookAtTarget prefab is assigned
- Make sure tracking toggle is ON (Look-At Target mode)
- Check Logger for "Instantiated lookAtTarget" message

### Connection Issues

In Lens Studio Logger, if you see "WebSocket closed":
- Verify bridge is running: `curl http://localhost:8001/health`
- Check bridge logs for errors
- Ensure daemon is running: `curl http://ROBOT_IP:8000/api/health`
- Verify COMPUTER_IP in DaemonInterface.ts matches your actual network IP

## Dependencies

Declared in `package_dependencies.json` (names only; Motion and Icons are also declared):

- **Utilities**: Logger system for debugging and monitoring
- **SnapDecorators**: @bindStartEvent, @bindUpdateEvent decorators for lifecycle management
- **InteractionKit**: animate() utility and Event for smooth transitions
- **UIKit**: Switch, Slider, BaseButton, SwitchToggleGroup and Frame UI components

## Resources

- [Reachy Mini Documentation](https://pollen-robotics-reachy-mini.hf.space/)
- [Pollen Robotics GitHub](https://github.com/pollen-robotics/reachy_mini)
- Lens Studio Documentation
- UI Kit

## Built with 👽 by the SPECS team
