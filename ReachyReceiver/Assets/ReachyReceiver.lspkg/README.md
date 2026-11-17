<p align="center">
  <img src="Docs/media/ReachyReceiver.png" width="250px" alt="ReachyReceiver"/>
</p>

# Reachy Receiver

ReachyReceiver connects a Specs Lens to a Reachy Mini WebSocket bridge, offers Idle and LookAtTarget behavior, and provides five UI panels for tracking and tuning. The robot/simulator and bridge are external requirements. The full original network tutorial is preserved in [Guide](Docs/guide.md).

> This independent community project is not officially affiliated with, sponsored by, or endorsed by Pollen Robotics or Snap Inc. The source targets Reachy Mini.

## Usage

This section ships with the package and describes what it contains. Generic Lens scripting, scene construction and Specs spatial design are out of scope here; package wiring, API, protocol and limitations live here.

### Package identity

- [package.native](package.native): existing ReadMe preserved, SetupScript empty and no instantiable root.
- Consumer/editable prefix: `ReachyReceiver.lspkg/` / `Assets/ReachyReceiver.lspkg/`; e.g. `ReachyReceiver.lspkg/Scripts/DaemonInterface`.
- Demo scaffolding: `ReachyReceiver.lspkg/Example/` holds `ExampleCarousel` and `GuideDismissPanel` (see [Components](Docs/components.md#demo-scaffolding-example)). They only present the demo; the Reachy scripts don't import them.
- [Manifest](package_dependencies.json): InteractionKit, UIKit, Utilities, SnapDecorators, Motion, Icons.
- Prefab wiring: the PLACE_IN_SCENE prefab uses DaemonInterface (with `Module/Internet Module.internetModule`), ReachyMiniController, ReachyUIController, ReachyUIManager and the `Example/` scaffolding. `UIFrameAnimator` and `ControllerLookAtTarget` ship but no shipped prefab uses them.
- Bridge: `ReachyReceiver.lspkg/WebsocketExamples/websocket_bridge.py` (Python bridge to the Reachy Mini daemon) and `test_websocket.py` (test client). See [Guide](Docs/guide.md#websocket-bridge-setup).
- Demo [ReachyReceiver__PLACE_IN_SCENE.prefab](ReachyReceiver__PLACE_IN_SCENE.prefab): drop it into a Specs scene (Camera + SIK/UIKit) for the full demo — it includes the guide panel, the example carousel and the `ReachyController` group (controller, daemon interface, robot reference, UI panel); target [GrabThisReachyWillFollow.prefab](Prefabs/GrabThisReachyWillFollow.prefab). The manifest and bridge instructions are not live compatibility or connectivity proof.

### API status

Read [API status](Docs/api-status.md). Daemon request transport and Mini state internals are private; consume only documented public methods.

### Applicability

Use when a Reachy Mini daemon is reachable through an explicitly configured external bridge and the AR robot/target locations are authored. This package supplies UI and control messages, not a local simulated robot or bridge deployment. UI inspection while disconnected is not physical motion proof.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md): entry rules and startup ordering.
- [API status](Docs/api-status.md): private/public distinctions and implementation gaps.
- [Components](Docs/components.md): all inputs, public methods, pose types, slider/preset maps, frame event and the `Example/` demo scaffolding.
- [Examples](Docs/examples.md): typed readiness, state selection and frame observation.
- [Troubleshooting](Docs/troubleshooting.md): bridge, state, target, UI and animation issues.
- [Guide](Docs/guide.md): bridge/simulator/robot setup, network architecture, protocol and panel walkthrough.

### Verification

Checked in the Lens Studio Preview on 2026-10-01 (no bridge running). Repeat these after changing the package:

1. TypeScript compiles clean with no `as any` added by consumers; the Preview logs no errors (the Depth24 warning is Lens Studio's).
2. Tracking, Speed, Movements, Character and Vibe each show only their own panel; sliders start at the controller's Inspector values.
3. A Vibe preset (e.g. Expressive) moves the Character sliders and the Enable Wobble switch.
4. "Enable Simulation" / "Enable Real Robot" are exclusive and don't move the "Idle vs Look at" switch.
5. "Idle vs Look at" on spawns the target (look up: it sits above the panel), it can be grabbed and moved; off scales it out and destroys it. ReachyReference shows the red/green/blue move gizmo.

Socket/health, Idle recorded-move loop, Look At robot motion and reconnect need the bridge from [Guide](Docs/guide.md) plus a simulator or robot; Preview success is not hardware success.

## Built with 👽 by the SPECS team
