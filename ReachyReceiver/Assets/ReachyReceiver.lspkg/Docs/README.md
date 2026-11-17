# Reachy Receiver

## What it is
A package that connects a Specs Lens to a Reachy Mini robot (physical or MuJoCo simulator) through a WebSocket
bridge, so the robot can idle or look at an AR target you move around. It ships the Lens-side control scripts, a
five-panel tuning UI and a Python bridge. It is an independent community project, not affiliated with or
endorsed by Pollen Robotics; the robot or simulator and the bridge are external requirements.

## What it does
1. Drop `ReachyReceiver__PLACE_IN_SCENE` into the scene. `DaemonInterface` opens a WebSocket to the bridge
   (`ws://COMPUTER_IP:8001/ws`), which forwards commands to the Reachy Mini daemon.
2. `ReachyMiniController` starts in **Idle**: the robot plays a pre-recorded move on loop.
3. Turning on "Idle vs Look at" in the Tracking panel switches to **LookAtTarget**: the
   `GrabThisReachyWillFollow` target spawns about 40 cm above the panel, you can grab and move it, and the
   robot's head, body yaw and antennas track it with `set_target` commands sent every Update while connected.
4. Turning it off scales the target out and destroys it, returning to Idle.
5. `ReachyUIManager` shows one of five panels at a time — Tracking, Speed, Movements, Character and Vibe — to
   tune smoothing, limits, wobble and presets (Robotic, Natural, Expressive) in real time.

## Highlights
- Two modes: fixed recorded animation (Idle) and real-time tracking of an AR target (LookAtTarget).
- Body yaw follows the head with configurable inertia; antennas animate with motion intensity.
- Fixed 2-second reconnect; `isReady()` reports socket state, `checkConnection()` does a health round trip.
- JSON protocol over WebSocket (`health`, `set_target`, `goto`, `play_recorded_move`), documented in the guide.
- Python bridge (`WebsocketExamples/websocket_bridge.py`) and test client ship with the package.
- "Enable Simulation" / "Enable Real Robot" are an exclusive pair, but both route to the same bridge URL; the
  bridge decides which daemon it talks to.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/DaemonInterface.ts` | WebSocket client to the bridge: connect, reconnect, health check and command sending. |
| `Scripts/ReachyMiniController.ts` | Idle / LookAtTarget state machine and head, body and antenna motion. |
| `Scripts/ReachyUIManager.ts` | Initializes the UI controller and shows one of the five panels at a time. |
| `Scripts/ReachyUIController.ts` | Binds sliders, switches and presets to the controller's parameters. |
| `Scripts/UIFrameAnimator.ts` | Scale-based show/hide animation for frames (ships, not used by the prefab). |
| `WebsocketExamples/websocket_bridge.py` | Python bridge between the Lens and the Reachy Mini daemon. |

## Extra info
- **Requires:** InteractionKit, UIKit, Utilities, SnapDecorators, Motion, Icons. A running bridge on your
  computer plus a Reachy Mini daemon (MuJoCo simulator or physical robot); set the `COMPUTER_IP` constant in `DaemonInterface.ts` to
  your computer's address (or call `setWebSocketUrl()` after start).
  The UI can be inspected in the Lens Studio Preview without a bridge, but robot motion needs the full setup.
- **Get started:** `ReachyReceiver__PLACE_IN_SCENE.prefab` (guide, example carousel and the `ReachyController`
  group); look-at target `Prefabs/GrabThisReachyWillFollow.prefab`.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) — entry rules and startup ordering; read first
  - [components.md](components.md) — inputs, public methods, pose types, slider/preset maps
  - [api-status.md](api-status.md) — public vs private surfaces and known source gaps
  - [examples.md](examples.md) — typed readiness, state selection and frame observation
  - [troubleshooting.md](troubleshooting.md) — bridge, state, target, UI and animation issues
  - [guide.md](guide.md) — bridge/simulator/robot setup, network architecture, protocol and panels
