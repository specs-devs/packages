# Utilities animation

[← Agent usage index](../README.md)

## Use when

Read before calling `AnimationUtils` tweens, chaining them, or cancelling them.

## Runtime

`AnimationUtils` imports `animate` and `CancelSet` from
`SpectaclesInteractionKit.lspkg/Utils/animate`, so SpectaclesInteractionKit must
be installed (it is a declared dependency). Animations advance once per frame
with `getDeltaTime()` and keep running while their object is disabled; nothing
is tied to a component's lifetime.

## Tweens

```typescript
import {AnimationUtils} from "Utilities.lspkg/Scripts/Utils/AnimationUtils"
import {MathUtils} from "Utilities.lspkg/Scripts/Utils/MathUtils"

@component
export class Slide extends BaseScriptComponent {
  private cancel: (() => void) | null = null

  onAwake(): void {
    const transform = this.getTransform()
    this.cancel = AnimationUtils.makeTween((t) => {
      // t goes 0 → 1 linearly; the last call is always t = 1.
      transform.setLocalPosition(new vec3(MathUtils.lerp(-10, 10, MathUtils.easeOutElastic(t)), 0, 0))
    }, 1.5)
    this.createEvent("OnDestroyEvent").bind(() => this.cancel?.())
  }
}
```

- `makeTween` returns a function; calling it stops further callbacks (no final
  `callback(1)`). Calling it after the tween ended is harmless.
- To loop, start the next tween from the `t >= 1` callback (the demo's
  `AnimationDemo.ts` does this).

## Scale animations

```typescript
const set = AnimationUtils.animateScale(target, vec3.one(), new vec3(1.5, 1.5, 1.5), 0.5, "ease-out-back", () => print("done"))
// later, if needed:
set.cancel()
```

- `easing` is a SIK easing name: `"linear"`, `"ease-in-cubic"`,
  `"ease-out-cubic"`, `"ease-in-out-cubic"`, the same for `sine`, `quad`,
  `quart`, `quint`, `expo`, `circ`, `back`, `elastic`, `bounce`, plus
  `"ease-in-back-cubic"` / `"ease-out-back-cubic"` / `"ease-in-out-back-cubic"`.
  An unknown name throws as soon as the animation starts.
- `animateVisualFeedback(target, fadeIn, duration = 0.5, onComplete?)` scales
  0 → 1 (`fadeIn = true`) or 1 → 0. It replaces the local scale; it does not fade
  opacity and does not restore the object's original scale.
- `onComplete` runs when the animation finishes, not when it is cancelled.

## Easing-name map

`getEasingId(name)` / `getEasingName(id)` / `getAllEasings()` translate the
display names used by InteractableHelper (`"Cubic Out"`) to numeric ids and back.
These names are not SIK easing strings, and no helper converts between the two.

| Id | Name | Id | Name | Id | Name |
|---|---|---|---|---|---|
| 0 | None | 12 | Quartic InOut | 24 | Circular InOut |
| 1 | Linear In | 13 | Quintic In | 25 | Back In |
| 2 | Linear Out | 14 | Quintic Out | 26 | Back Out |
| 3 | Linear InOut | 15 | Quintic InOut | 27 | Back InOut |
| 4 | Quadratic In | 16 | Sine In | 28 | Elastic In |
| 5 | Quadratic Out | 17 | Sine Out | 29 | Elastic Out |
| 6 | Quadratic InOut | 18 | Sine InOut | 30 | Elastic InOut |
| 7 | Cubic In | 19 | Exponential In | 31 | Bounce In |
| 8 | Cubic Out | 20 | Exponential Out | 32 | Bounce Out |
| 9 | Cubic InOut | 21 | Exponential InOut | 33 | Bounce InOut |
| 10 | Quartic In | 22 | Circular In | | |
| 11 | Quartic Out | 23 | Circular Out | | |

Unknown names map to 0, unknown ids to `"None"`.
