# InteractableHelper minimal examples

[← Agent usage index](../README.md)

## Use when

You need the smallest working setup. What each response type does, and longer
recipes, are in [guide](guide.md).

## Prefab (no code)

1. Make sure the scene has the SpectaclesInteractionKit prefab.
2. Drag `InteractableHelper.lspkg/InteractableHelper__PLACE_IN_SCENE.prefab` into the
   scene. It brings its own guide and example carousel. Each of the 12 groups
   demonstrates one response type. Copy the group closest to what you need,
   and swap in your own targets.

## Inspector setup on your own object

1. On the object to hover/pinch (the *host*), add a `Physics Collider` sized to
   the visual (for example a Box).
2. Add the `InteractableHelper` script. A SIK `Interactable` is added at start if
   the host has none.
3. Under **Pinch Up / Select Responses**, add an element. Set `Scene Object` to
   the target and `Event Response Type` = `Transform Animation`. Then add one
   animation: `Scale Local`, `Toggle`, `a = (1,1,1)`, `b = (1.5,1.5,1.5)`,
   duration `0.3`, easing `Quadratic Out`.
4. Preview: each pinch toggles the target between the two scales.

## Custom Callback target script

```typescript
@component
export class ScoreCounter extends BaseScriptComponent {
  @input label: Text;

  private score = 0;

  // Called by InteractableHelper (Custom Callback, functionName = "addPoint").
  // It passes one string argument ("" for responses, "a" for start/complete actions).
  public addPoint(_arg?: string) {
    this.score++;
    this.label.text = `Score: ${this.score}`;
  }
}
```

In the response, set `Script` = the `ScoreCounter` component and
`Function Name` = `addPoint`. The same script works as an
`onStartAction`/`onCompleteAction` with `actionType` = Custom Callback.

## Fire a configured response from code

```typescript
import {InteractableHelper, EventType} from "InteractableHelper.lspkg/InteractableHelper";

@component
export class ReplayFirstPinchResponse extends BaseScriptComponent {
  @input helper: InteractableHelper;

  replay() {
    const item = this.helper.onPinchUp_Select[0];
    if (item) {
      this.helper.response(item, EventType.TriggerUp);
    }
  }
}
```

`response()` doesn't advance the per-event iteration counter (only real events
do). Toggle and Iterate responses replayed this way repeat the current step.

## Listen to the same Interactable from another script

```typescript
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";

@component
export class PinchLogger extends BaseScriptComponent {
  @input host: SceneObject; // the object carrying InteractableHelper

  onAwake() {
    // The helper may create the Interactable in its own OnStart, so look it up afterwards.
    this.createEvent("OnStartEvent").bind(() => {
      const interactable = this.host.getComponent(Interactable.getTypeName());
      if (interactable) {
        interactable.onTriggerEnd.add(() => print("pinched " + this.host.name));
      }
    });
  }
}
```

If the host has no `Interactable` authored in the scene, the lookup can still
be null in the same OnStart: add the `Interactable` to the host in the Inspector
(the helper reuses it), or retry on the next frame.
