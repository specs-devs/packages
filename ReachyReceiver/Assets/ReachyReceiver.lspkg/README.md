# Reachy Receiver 

A comprehensive robot control integration package for operating Pollen Robotics Reachy Mini humanoid robot from Snap Spectacles AR glasses. This package provides WebSocket client connectivity, dual-mode operation (Idle/Look-At), real-time head tracking with character wobble, UI control system, and seamless integration with both MuJoCo simulation and physical robot hardware for telepresence and AR robotics experiences.

> **Disclaimer**: This is an independent community project. It is not officially affiliated with, sponsored by, or endorsed by Pollen Robotics or Snap Inc.

> **Note**: This package supports **Reachy Mini** robot. For setup guides, see [Pollen Robotics Reachy Mini Documentation](https://pollen-robotics-reachy-mini.hf.space/).

## Resources

- **[Pollen Robotics Reachy Mini](https://pollen-robotics.com/reachy-mini/)** - Learn more about the Reachy Mini robot
- **[WebSocket Bridge](https://github.com/pollen-robotics/reachy_mini)** - Python bridge server for Spectacles connectivity
  - `websocket_bridge.py` - WebSocket-to-HTTP bridge for daemon communication
- **[MuJoCo Simulator](https://pollen-robotics-reachy-mini.hf.space/#/getting-started)** - Test with simulation before deploying to physical robot

---

## Features

- **WebSocket Client**: Real-time robot control with automatic reconnection and health monitoring
- **Dual-Mode Operation**: Switch between Idle (pre-recorded animations) and Look-At Target (real-time tracking) modes
- **Real-Time Head Tracking**: 60fps target tracking with smooth interpolation and character-driven wobble
- **Body Following**: Automatic body yaw control that follows head movement with configurable inertia
- **Antenna Animation**: Synchronized antenna movement with motion intensity for expressive character
- **UI Control System**: Five-panel interface for tracking, speed, movement limits, character, and presets
- **Robot Mode Toggle**: Seamless switching between MuJoCo simulation and physical robot hardware
- **Preset System**: Robotic, Natural, and Expressive presets for instant personality changes
- **Configurable Parameters**: Real-time adjustment of smoothing, limits, wobble, and animation speeds
- **Look-At Target Instantiation**: Runtime prefab instantiation with automatic lifecycle management
- **Connection Health Monitoring**: Status tracking with health endpoint polling and reconnection logic

## Quick Start

Set up basic Reachy Mini control with UI:

```typescript
import {DaemonInterface} from "ReachyReceiver.lspkg/Scripts/DaemonInterface";
import {ReachyMiniController} from "ReachyReceiver.lspkg/Scripts/ReachyMiniController";
import {ReachyUIManager} from "ReachyReceiver.lspkg/Scripts/ReachyUIManager";
import {ReachyUIController} from "ReachyReceiver.lspkg/Scripts/ReachyUIController";

@component
export class ReachySetup extends BaseScriptComponent {
  @input internetModule: InternetModule;
  @input reachyWorldPosition: SceneObject;
  @input targetSpawnPosition: SceneObject;
  @input lookAtTargetPrefab: ObjectPrefab;

  private daemonInterface: DaemonInterface;
  private reachyController: ReachyMiniController;
  private uiManager: ReachyUIManager;
  private uiController: ReachyUIController;

  onAwake() {
    // Create daemon interface
    this.daemonInterface = this.getSceneObject().createComponent("Component.ScriptComponent") as DaemonInterface;
    this.daemonInterface.internetModule = this.internetModule;

    // Create robot controller
    this.reachyController = this.getSceneObject().createComponent("Component.ScriptComponent") as ReachyMiniController;
    this.reachyController.daemonInterface = this.daemonInterface;
    this.reachyController.reachyWorldPosition = this.reachyWorldPosition;
    this.reachyController.targetSpawnPosition = this.targetSpawnPosition;
    this.reachyController.lookAtTarget = this.lookAtTargetPrefab;

    // Create UI manager
    this.uiManager = this.getSceneObject().createComponent("Component.ScriptComponent") as ReachyUIManager;
    this.uiManager.reachyController = this.reachyController;

    // Create UI controller
    this.uiController = this.getSceneObject().createComponent("Component.ScriptComponent") as ReachyUIController;
    this.uiManager.uiController = this.uiController;

    print("Reachy receiver initialized");
  }
}
```

## Script Highlights

### DaemonInterface.ts

Manages WebSocket connectivity to the Reachy Mini daemon via Python bridge server. Implements singleton pattern for shared daemon access across components with static getInstance() and isReady() methods. Handles connection lifecycle with automatic reconnection logic, exponential backoff (2s to 32s intervals), and configurable maxReconnectAttempts. Provides health monitoring via periodic polling to daemon /api/health endpoint for connection status verification. Features message queue system with MessageRequest interface tracking _id, callbacks, and timestamps for request-response correlation. Implements JSON-based protocol supporting health checks, set_target (60fps tracking), goto (interpolated movement), play_recorded_move (emotions), stop_move, and get_running_moves operations. Includes WebSocket event handling with onOpen, onMessage, onError, onClose for connection state management. Provides public API with sendMessage(), healthCheck(), and getConnectionStatus() for external integration. Supports both simulation (localhost:8000) and real robot (network IP:8000) via bridge configuration.

### ReachyMiniController.ts

Central robot control orchestrator managing state transitions between Idle and LookAtTarget modes. Implements Idle mode with automatic playback of "attentive2" pre-recorded animation loop, move completion checking via polling, and automatic replay on completion. Features LookAtTarget mode with real-time target tracking, runtime prefab instantiation/destruction, and 60fps set_target commands to daemon. Provides smooth head tracking with configurable yaw/pitch smoothing (0.01-0.2 range), velocity-based motion intensity calculation, and mechanical limit enforcement. Implements body following behavior with inertia-based body yaw that lags behind head movement and separate body smoothing parameter. Features character-driven wobble system with pitch/yaw/roll wobble amplitudes (sine wave based on elapsed time), wobble speed multiplier, and motion intensity blending. Manages antenna animation with base amplitude for idle movement, additional motion amplitude during tracking, and smooth interpolation with jitter prevention. Includes coordinate system conversion for AR space with reachyWorldPosition defining robot location, reachyHeadOffset for head center calculation, and world-to-local transform math. Provides parameter clamping with per-frame change limits (MAX_YAW_CHANGE_PER_FRAME, MAX_PITCH_CHANGE_PER_FRAME), mechanical joint limits (MIN_PITCH, MAX_PITCH, MAX_HEAD_YAW), and antenna/roll constraints. Implements state management with setState(), setStateFromUI(), enterIdleState(), exitIdleState(), enterLookAtTargetState(), and exitLookAtTargetState() methods. Features update loop integration with bindUpdateEvent decorator for real-time tracking, move completion polling for Idle mode, and conditional execution based on currentState.

### ReachyUIController.ts

Maps UI slider and switch values to ReachyMiniController parameters for real-time robot control. Implements slider configuration system with SliderConfig interface defining min/max ranges, controller property mapping, and human-readable labels. Provides preset system with applyRoboticPreset() (fast, precise, no wobble), applyNaturalPreset() (balanced, medium wobble), and applyExpressivePreset() (slow, high wobble, animated). Features robot mode switching with enableSimulationMode() and enableRealRobotMode() that update DaemonInterface WebSocket URL. Implements UI synchronization with syncUIFromController() reading Inspector values and updating slider positions at initialization. Manages slider callbacks with onSliderChanged() mapping normalized values to actual parameter ranges and live parameter updates. Handles switch callbacks with onTrackingModeChanged() for Idle/LookAtTarget toggle and onWobbleChanged() for enable/disable wobble. Provides initialization flow with initialize() called by ReachyUIManager, logger setup, robot mode configuration, and setupSliders()/setupSwitches() calls. Includes value normalization with slider ranges mapped to parameter ranges (e.g., 0.01-0.2 mapped to 0-100 slider) and reverse mapping for syncUIFromController(). Features logging integration with configurable log levels, initialization lifecycle logging, and parameter change logging for debugging.

### ReachyUIManager.ts

Orchestrates UI component lifecycle and panel navigation for five-panel control interface. Manages panel visibility with showTrackingPanel() (home), showPanel() (generic), setPanelEnabled() helper, and hideAllPanels() utility. Implements navigation system with bindNavigationButtons() for left sidebar panel buttons, closeButton binding for home/X button, and onPanelButtonPressed() callbacks. Handles tracking panel with trackingModeSwitch (Idle/LookAtTarget toggle) and robotModeToggleGroup (Simulation/Real Robot selection). Manages speed controls panel with slider assignments for head yaw/pitch, body follow, antenna, and motion intensity speeds. Includes movement limits panel with maxYawChange, maxPitchChange, maxAntennaChange slider configurations. Features character/wobble panel with wobble enable switch, pitch/yaw/roll wobble sliders, antenna base/motion sliders, and wobble speed control. Provides presets panel with roboticPreset, naturalPreset, expressivePreset button bindings. Implements component initialization with onStart() lifecycle, showTrackingPanel() default view, and controller.initialize() call. Includes robot mode switch handling with bindRobotModeSwitches(), SwitchToggleGroup integration, and enableSimulation/enableReachy switch configuration. Features preset button handling with bindPresetSwitches() connecting buttons to UIController preset methods. Provides logging integration with initialization logging, panel change logging, and switch state logging. Handles component references with explicit @input assignments for all UI elements and validation checks for undefined components.

### UIFrameAnimator.ts

Manages frame-by-frame animation of UI panel elements during show/hide transitions. Implements position animation with configurable animation speed and smooth interpolation. Provides state management with isAnimating flag and currentTime tracking. Features public API with animate() method accepting target position and duration parameters. Includes UpdateEvent binding for per-frame position updates during active animations. Supports interruption with mid-animation target changes and automatic cleanup when animation completes.

### ControllerLookAtTarget.ts

Simple placeholder component for the look-at target prefab. Provides logging initialization with Logger integration and lifecycle debug output. Includes Inspector configuration with logging enable toggles. Designed as attachment point for future target behaviors like animation, effects, or user interaction.

## Network Architecture

```
Spectacles (Lens Studio)
    ↓ WebSocket (ws://COMPUTER_IP:8001/ws)
WebSocket Bridge (Python)
    ↓ WebSocket + HTTP (ws://DAEMON_IP:8000/api/move/ws/set_target)
    ↓ HTTP REST (http://DAEMON_IP:8000/api/move/*)
Reachy Mini Daemon (MuJoCo or Physical Robot)
```

## Configuration

### Inspector Setup (Required)

**DaemonInterface Component:**
- internetModule: Assign InternetModule from Resources
- COMPUTER_IP: Update in TypeScript to your computer's network IP (e.g., "192.168.1.100")

**ReachyMiniController Component:**
- daemonInterface: Assign DaemonInterface component
- Reachy Position in AR Space:
  - reachyWorldPosition: SceneObject where Reachy exists in AR (typically SpectaclesCamera or fixed anchor)
  - reachyHeadOffset: Offset from position to head center (default: 0, 15, 0 = 15cm above)
- Look-At Target Configuration:
  - targetSpawnPosition: SceneObject defining where to instantiate target when entering Look-At mode
  - lookAtTarget: ObjectPrefab to instantiate as target Reachy will follow

**ReachyUIController Component:**
- simulationUrl: "http://localhost:8000"
- realRobotUrl: "http://localhost:8000" (bridge forwards to robot)
- startInSimulationMode: true for simulation, false for real robot

**ReachyUIManager Component:**
- Assign all panel SceneObjects (panelTracking, panelSpeed, panelMovements, panelCharacter, panelPresets)
- Assign all UI component references (sliders, switches, buttons from SpectaclesUIKit)
- Assign uiController: ReachyUIController component
- Assign reachyController: ReachyMiniController component

### WebSocket Bridge Setup

**For Simulation:**
```bash
# Install dependencies
pip install aiohttp websockets

# Start MuJoCo simulator
mjpython -m reachy_mini.daemon.app.main --sim --scene minimal

# Start bridge
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

Update `DaemonInterface.ts` line 43:
```typescript
private static readonly COMPUTER_IP: string = "YOUR_COMPUTER_IP";  // e.g., "192.168.1.100"
```

Update `ReachyUIController.ts` line 31:
```typescript
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

**Set Target (60fps tracking):**
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

- **Utilities** (v1.0.0): Logger system for debugging and monitoring
- **SnapDecorators** (v1.0.0): @bindStartEvent, @bindUpdateEvent decorators for lifecycle management
- **SpectaclesInteractionKit**: animate() utility for smooth transitions
- **SpectaclesUIKit**: Switch, Slider, BaseButton, SwitchToggleGroup UI components

## Resources

- [Reachy Mini Documentation](https://pollen-robotics-reachy-mini.hf.space/)
- [Pollen Robotics GitHub](https://github.com/pollen-robotics/reachy_mini)
- [Lens Studio Documentation](https://docs.snap.com/lens-studio)
- [Spectacles UI Kit](https://github.com/Snapchat/SpectaclesUIKit)

## Built with 👻 by the Spectacles team



