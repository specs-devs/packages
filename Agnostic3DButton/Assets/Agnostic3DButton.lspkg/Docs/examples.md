# Agnostic3DButton examples

[← Agent usage index](../README.md)

The prefab's carousel steps through six examples (`Example/<Name>/<Name>.ts`). Each builds its buttons from code with `Example/Shared/ButtonFactory.ts`, on a "console" tilted 55° toward the user.

## Hero button

One big round button. The cap follows your finger, a depth bar and a readout show `pressValue`, and the click counter goes up once per press.

## Keypad

A 3×4 keypad (1–9, C, 0, OK) of rounded-square keys sharing the same fingertips. Digits appear on the display, C clears, OK "sends" the code. Shows many buttons side by side without crosstalk: each key only reacts to fingers inside its own footprint.

## Shapes & toggle

The same component as a round, a square and a pill button (momentary), plus a latching toggle (`toggle = true`) that switches an on-light through `onToggle`.

## Pressure

A deep button (`travel` 3) drives a lamp continuously from `onPressValue`: the deeper you push, the brighter it glows.

## Any finger

The finger is a grabbable ball, not a hand: `useSIKIndexTips` is off and the ball's lowest point is added with `addFingerSource`. Pinch the ball, push it onto the button and it clicks; let go and the ball floats back.

## UIKit look

Agnostic3DButtons styled like UIKit's System 3.0 buttons (`style` UIKit + the `UIKit Primary` / `UIKit Secondary` / `UIKit Ghost` themes): a row of Primary / Secondary / Ghost rectangle buttons, a round icon button and a pill toggle. No UIKit components, just the package's own meshes and materials, pressed softly by the finger like the other examples.

## Build buttons from code

```ts
import {Agnostic3DButton} from "Agnostic3DButton.lspkg/Scripts/Agnostic3DButton"
import {Agnostic3DButtonVisual, ButtonStyle} from "Agnostic3DButton.lspkg/Scripts/Agnostic3DButtonVisual"

const o = global.scene.createSceneObject("MyButton")
const button = o.createComponent(Agnostic3DButton.getTypeName()) as Agnostic3DButton
button.size = new vec2(5, 5)
const visual = o.createComponent(Agnostic3DButtonVisual.getTypeName()) as Agnostic3DButtonVisual
visual.style = ButtonStyle.UIKit // optional: set the style (and pill / icon) before configure()
visual.configure(button, capMaterial, glowMaterial, "UIKit Primary", "GO")
button.onClick.add(() => print("go"))
```

## Your own mesh instead of the visual

Skip `Agnostic3DButtonVisual`, put your mesh under the button, and move it with `pressValue`:

```ts
button.onPressValue.add((v) => cap.getTransform().setLocalPosition(new vec3(0, -v * button.travel, 0)))
```
