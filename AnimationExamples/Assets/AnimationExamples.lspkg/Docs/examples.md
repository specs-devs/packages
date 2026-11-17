# AnimationExamples examples

[← Agent usage index](../README.md)

## Use when

Read when dropping the manager into a scene or driving it from custom UI.

The ready-to-drop prefab is `AnimationExamples.lspkg/AnimationExamples__PLACE_IN_SCENE.prefab`. Its `Examples` child holds one AnimationExamplesManager with the eight example prefab bindings; the prefab also carries the demo guide and carousel (see [components](components.md#demo-scaffolding-example)). The manager creates `Animations` and its own `UI` under its SceneObject at runtime; in the prefab the carousel hides that `UI` and steps through the examples instead. A consumer can also assign a custom prefab list.

```typescript
import {AnimationExamplesManager} from "AnimationExamples.lspkg/Scripts/AnimationExamplesManager"

@component
export class ChooseAnimation extends BaseScriptComponent {
  @input manager: AnimationExamplesManager

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.manager.setActive(0)
      print("Animation examples: " + this.manager.getCount())
    })
  }

  showNext(): void { this.manager.next() }
  showPrevious(): void { this.manager.previous() }
}
```

Individual examples live in `Prefabs/ScaleSquishExample.prefab`, `PushOutZExample.prefab`, `OpacityCallbackExample.prefab`, `SubscribeToFinishExample.prefab`, `CustomTimestampEventExample.prefab`, `FromAnimationAssetExample.prefab`, `ExistingPlayerExample.prefab`, and `FrameSizingExample.prefab`.

For runtime fallback examples, configure a player clip and leave its asset empty. For ExistingPlayer, configure an authored asset. `TweenExamples.ts` is a read-and-uncomment walkthrough, not another active prefab demo.

The package project has a demo-only Guide and ExampleCarousel. Its AnimationExamplesCarouselSource resolves spawned examples by name, disables the manager UI to avoid two navigators, and wraps each animation in a holder so absolute tracks cannot overwrite placement. These demo scripts ship inside the package in `Example/ExampleCarousel/` and `Example/GuideDismissPanel/`; a consumer that only needs the animations can delete the `Guide` and `ExampleCarousel` objects and keep `Examples` (the manager then shows its own arrow UI).
