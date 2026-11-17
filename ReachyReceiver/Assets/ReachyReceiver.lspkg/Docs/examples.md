# ReachyReceiver examples

[← Agent usage index](../README.md)

## Use when

Consume public APIs without inventing private setters. All three snippets passed static TypeScript compilation against the installed type declarations. They target an already wired/initialized scene; bridge and robot behavior needs separate QA.

## Prefab setup

Drag `ReachyReceiver.lspkg/ReachyReceiver__PLACE_IN_SCENE.prefab` into a Specs scene with installed companion setup. It wires Daemon, Mini, UIController and UIManager with five panels. Mini target is `Prefabs/GrabThisReachyWillFollow.prefab`, a draggable UIKit Frame with text, scaled to .3 during target reveal. `Prefabs/Snap3DInteractable.prefab` is an additional resource with dependency-owned interaction/loading scripts, not the wired default target.

The two tracking modes behave differently: in **Idle**, Reachy plays a continuous animation and ignores the Speed / Movements / Character / Vibe settings; in **Look At**, Reachy follows the target and those settings shape how it moves. (This used to be a loose "IMPORTANT: there are 2 modes" note under the prefab's Frame; it is now disabled so all on-screen guidance lives in UI panels.)

Configure private input fields through Inspector. Direct daemon URL changes must happen after its Start initialization; UI mode changes call setBaseUrl and can replace a direct URL with the hardcoded COMPUTER_IP bridge. Verify ordering rather than assuming one component's Start runs first.

## Read socket readiness

```typescript
import {DaemonInterface} from "ReachyReceiver.lspkg/Scripts/DaemonInterface";

@component
export class ReachyReadiness extends BaseScriptComponent {
  @input status: Text;

  onAwake(): void {
    this.createEvent("UpdateEvent").bind(() => {
      this.status.text = DaemonInterface.isReady() ? "Socket connected" : "Waiting for bridge";
    });
  }
}
```

No robot command is sent by this observer. isReady does not prove a responding daemon; checkConnection() returns Promise<boolean> for request/response health.

## Select controller state

```typescript
import {ReachyMiniController} from "ReachyReceiver.lspkg/Scripts/ReachyMiniController";

@component
export class ReachyStateControl extends BaseScriptComponent {
  @input controller: ReachyMiniController;

  selectIdle(): void {
    this.controller.setStateFromUI(true);
  }

  selectLookAtTarget(): void {
    this.controller.setStateFromUI(false);
  }
}
```

Wire explicit consumer controls to these methods. Idle can send neutral/recorded-move commands; LookAtTarget can send target commands when connected. Only execute in a deliberately configured simulator/robot session. RobotState enum and internal enter/exit/state methods are not public exports.

## Observe frame visibility

```typescript
import {UIFrameAnimator} from "ReachyReceiver.lspkg/Scripts/UIFrameAnimator";

@component
export class ObserveFrame extends BaseScriptComponent {
  @input animator: UIFrameAnimator;

  onAwake(): void {
    this.animator.onFrameVisibilityChanged.add((visible: boolean) => {
      print(`Frame visibility: ${visible}`);
    });
  }
}
```

The event fires after animation work, including cancelled transitions in current source. It is not proof that every competing transition has settled. Show/hide APIs return async completion; an optional Transform copies world position/rotation when visibility is changed.
