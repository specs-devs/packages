# InteractableHelper guide and recipes

[← Agent usage index](../README.md)

## Use when

You want to know what each response type and play option does, or you need a
multi-step pattern (chained animations, staggered waves, hover in/out pairs).
This guide replaces the older README's "Script Highlights" and "Advanced
Usage". Those sections described a scripting API (`execute()`, `eventType`,
`new CallbackAction(fn)`) that this package doesn't have. Exact field names are
in [components.md](components.md).

## How a helper runs

The helper lives on a **host** object (collider + SIK `Interactable`). It owns
four lists of responses, one per event: hover enter, hover exit, pinch down
(trigger start) and pinch up / select (trigger end). When an event fires, every
response in that list runs, top to bottom. They don't wait for each other.
Sequencing comes from each response's `delay` and from the on start / on
complete actions.

## Response types

- **Set State / Toggle**: enable or disable a target (Set State supports a
  delay). Typical uses are showing a highlight on hover enter and hiding it on
  hover exit.
- **Iterate Through Children**: the target's children act as pages. At start,
  only child 0 is visible; each event shows the next child and wraps.
- **Transform Animation**: one or more move/scale/rotate tweens, in local or
  world space, all started together. Three play options:
  - *Play From Current Value*: tween from wherever the transform is to `endVal`.
  - *Play Everytime*: always `startValue` → `endValue`.
  - *Toggle*: `a → b` on the 1st, 3rd, … event and `b → a` on the 2nd, 4th, …
- **Custom Animation**: plays the target's `AnimationPlayer` clips, either the
  next clip on each event or one named clip.
- **Material Property Animation**: tweens a float / vec3 / vec4 shader
  parameter on the target's `RenderMeshVisual.mainMaterial.mainPass`. The
  material is cloned on first use, so the change stays on that object.
- **Material Base Color Animation**: clones the target's material (mesh or
  Image) and tweens its base color, or tweens a `Text` color, to `endColor`.
- **Custom Callback**: calls a public method on any script.
- **BlendShape Animation**: tweens one blendshape weight, with the same play
  options as transforms.
- **Play Audio Clip**: play once (with delay), play/stop, or play/pause/resume.
- **Play Video Texture**: plays the Image's video texture once or looping, with
  callbacks when playback is ready and when it is done.

All tweens take `animationDurationInSeconds`, `delay` (seconds) and an
`easingData`.

## Recipe: chained sequence (scale up, then back, then a message)

On the host's **Pinch Down** list:

1. Response A: Transform Animation on `Button`, `Scale Local`, *Play Everytime*
   `(1,1,1) → (1.3,1.3,1.3)`, 0.2 s, `doOnComplete` on, `onCompleteAction` =
   Custom Callback → your script's `playReturn`.
2. In `playReturn`, call `helper.response(helper.onPinchUp_Select[0], EventType.TriggerUp)`,
   where that list holds the "scale back" animation. Or simply set the text you
   want to show.

A simpler alternative with no code: two Transform Animations in **one**
response. The second uses `delay` = the first one's duration, so it starts
when the first ends.

## Recipe: staggered color wave

On one event list, add one *Material Base Color Animation* response per tile.
Give them the same `endColor` and `delay` = `0, 0.1, 0.2, …`. Each response
clones its tile's material, so the tiles animate independently. To return to
the base color, add a matching list on the opposite event (for example
hover exit) with the original color as `endColor`.

## Recipe: hover-driven blendshape (in and out)

- **Hover Enter**: BlendShape Animation on the character, *Play From Current
  Value*, `endVal = 1`, 0.5 s.
- **Hover Exit**: the same blendshape, *Play From Current Value*, `endVal = 0`.

Use From Current Value (not Toggle) for enter/exit pairs. Each list has its own
counter, so two Toggles on enter/exit would both start on `a → b`.

## Recipe: audio + visual click

On **Pinch Up / Select**, add a *Play Audio Clip* (Play Once) targeting the
object with the `AudioComponent`. In the same list, add a *Transform Animation*
(Scale Local, Toggle) targeting the button. Both start on the same event.

## Tips

- Keep one helper per host. If several hosts must react to one pinch, use a
  Custom Callback that fans out.
- Put the visual targets as siblings of the host (the prefab pattern), so you
  can scale the host's collider without scaling the content.
- Configuration mistakes (wrong callback function, property, clip or
  blendshape name, missing component) throw an `Interactable Helper on …`
  error the first time the event fires. Exercise every event once in Preview.
