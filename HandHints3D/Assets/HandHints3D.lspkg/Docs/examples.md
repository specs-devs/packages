# HandHints3D minimal examples

[← Agent usage index](../README.md)

## Use when

Copy only the smallest example that establishes the package lifecycle. Compose the rest of the experience with CLAD's planning, scripting, scene and spatial-design skills.

## Drop the prefab

Drag `HandHints3D.lspkg/HandHints3D__PLACE_IN_SCENE.prefab` into the scene to get the full demo: the guide, then a carousel over six example hints. For your own Lens, keep the `HandHint` object of the example closest to what you need (each one auto-plays its gesture 999 times at local position (0, -20, -100)), ideally under an empty parent object that you position (see [Positioning the hint](#positioning-the-hint)), and delete `Guide`, `ExampleCarousel` and the other groups.

## Inspector auto-play

On a `HandHint` object's `InteractionHintController`: keep `autoPlay` on, set `numberOfLoops` and `animationSpeed`, and edit `hintAnimations`. Each entry picks `handType` (Left / Right / Both), the clip for that hand type, and a `position`. Two or more entries play as a sequence with a fade between them.

## One hint from script

```ts
import {HandAnimationsLibrary, HandMode, InteractionHintController} from "HandHints3D.lspkg/Scripts/InteractionHintController"

@component
export class ShowPinchHint extends BaseScriptComponent {
  @input
  hintController: InteractionHintController

  onAwake(): void {
    // OnStartEvent: the controller creates animationEndEvent and resolves the rig in its own onAwake.
    this.createEvent("OnStartEvent").bind(() => {
      this.hintController.playHintAnimation(HandMode.Right, HandAnimationsLibrary.Right.PinchNear, 3, 1.0)
      this.hintController.animationEndEvent.bind(() => {
        print("pinch hint done")
      })
    })
  }
}
```

Turn `autoPlay` off on the controller when a script drives it, otherwise the Inspector list plays first and the call replaces it.

## A sequence with positions

```ts
import {HandAnimationClipInfo, HandAnimationsLibrary, HandMode, InteractionHintController} from "HandHints3D.lspkg/Scripts/InteractionHintController"

function showMoveThenScale(controller: InteractionHintController): void {
  const sequence = [
    new HandAnimationClipInfo(HandMode.Right, HandAnimationsLibrary.Right.PinchNear, new vec3(0, 0, -50)),
    new HandAnimationClipInfo(HandMode.Right, HandAnimationsLibrary.Right.PinchMoveY, new vec3(0, 10, -50)),
    new HandAnimationClipInfo(HandMode.Both, HandAnimationsLibrary.Both.TwoHandsPinchScale, new vec3(0, 0, -50))
  ]
  controller.playHintAnimationSequence(sequence, 2)
}
```

Positions are local to the prefab's parent; each clip moves the controller's SceneObject there when it starts.

## Tutorial chaining

`animationEndEvent` fires after every completed hint, so bind it once and advance your own state:

```ts
import {HandAnimationsLibrary, HandMode, InteractionHintController} from "HandHints3D.lspkg/Scripts/InteractionHintController"

@component
export class GestureTutorial extends BaseScriptComponent {
  @input
  hintController: InteractionHintController

  private steps = [
    {hand: HandMode.Right, clip: HandAnimationsLibrary.Right.PinchNear},
    {hand: HandMode.Right, clip: HandAnimationsLibrary.Right.PinchMoveY},
    {hand: HandMode.Both, clip: HandAnimationsLibrary.Both.TwoHandsPinchScale}
  ]
  private index = 0

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.hintController.animationEndEvent.bind(() => this.next())
      this.play()
    })
  }

  private play(): void {
    const step = this.steps[this.index]
    this.hintController.playHintAnimation(step.hand, step.clip, 3, 0.8)
  }

  private next(): void {
    this.index += 1
    if (this.index < this.steps.length) {
      // Give the fade-out a moment before the next hint starts.
      const delay = this.createEvent("DelayedCallbackEvent")
      delay.bind(() => this.play())
      delay.reset(0.5)
    }
  }
}
```

If a single follow-up hint is all you need, guard the callback with a flag (see `Scripts/ExampleTS.ts`, which otherwise would re-trigger on every completion).

## Positioning the hint

The controller writes each clip's `position` to **its own** SceneObject's local position on every play and loop, so moving the `HandHint` object directly is undone. Put it under an empty parent (the prefab's example groups play this role) and position that parent, for example (0, -20, -100) to show hints 1 m ahead and a little below eye level, and leave the clip positions at zero.

## Keep a hint looping, and hide it

Pass a large loop count (`playHintAnimation(..., 999)`) to keep a hint going; there is no stop API, so hide the hint by disabling the `HandHint` SceneObject (or its parent) and enable it again for the next hint.
