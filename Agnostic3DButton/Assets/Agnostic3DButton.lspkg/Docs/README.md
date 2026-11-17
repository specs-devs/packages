# Agnostic 3D Button

## What it is
A package that gives Specs projects one soft-press 3D button that works with any finger: Interaction Kit (SIK)
index fingertips, a grabbed object, a controller tip, or anything else with a transform. It replaces the usual
hand-built mix of physics colliders, helper objects and thresholds. It is for developers who need keypads,
consoles, toggles or analog pressure controls that you push with a finger rather than pinch.

## What it does
- You add `Agnostic3DButton` (press logic) and `Agnostic3DButtonVisual` (the look) to a SceneObject whose local
  +Y is the top of the button.
- Every frame the button measures how deep the deepest finger pushes into a box or cylinder volume defined in
  its local space, and turns that depth into a smooth `pressValue` (0..1).
- It fires `onHoverEnter` / `onHoverExit`, `onPressStart`, `onPressValue`, `onPressed`, `onReleased`, `onClick`
  and, in `toggle` mode, `onToggle`.
- The visual builds a bevelled cap in a holed base (bezel and well) at start. The cap sinks and squashes with the
  press, a glow ring blooms on hover and flashes on click, and a finger shadow follows the nearest finger. It can
  also show a label, an icon and play a click sound.
- The `Agnostic3DButton__PLACE_IN_SCENE` prefab shows a guide and an example carousel with six examples: Hero
  Button, Keypad, Shapes & Toggle, Pressure, Any Finger and UIKit look.

## Highlights
- No physics: the volume is analytic (box or cylinder), so it follows the button when you move, rotate or scale it.
- Any finger: a `fingers` list, both SIK index tips (`useSIKIndexTips`, on by default), or your own position
  source via `addFingerSource`.
- Reliable clicks: press and release thresholds with hysteresis, and `enterFromTopOnly` so fingers sliding in from
  the side or below never press.
- Never stuck: a short `releaseDelay` after lift-off, and a `maxHoldWithoutFinger` failsafe that always springs
  back a lost finger.
- Themes Specs Glass, Neon, Candy and Metal, plus a `UIKit` style with UIKit Primary / Secondary / Ghost themes
  that matches the UI Kit button look without using UI Kit components.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/Agnostic3DButton.ts` | Press logic: fingers, volume, `pressValue`, thresholds, toggle and all events. |
| `Scripts/Agnostic3DButtonVisual.ts` | Builds and animates the cap, base, glow ring, label, icon and finger shadow. |
| `Scripts/ButtonVolume.ts` | Box / cylinder footprint tests and press-depth math. |
| `Scripts/ButtonThemes.ts` | Theme colour sets (`BUTTON_THEMES`, `findTheme`, `mixColor`). |
| `Scripts/ButtonMeshes.ts` | MeshBuilder helpers for the slab, well, ring and debug wireframe. |
| `Example/Shared/ButtonFactory.ts` | Demo helper that builds buttons from code for the examples. |
| `Example/ExampleCarousel/ExampleCarousel.ts` | Steps through the six examples in the demo prefab. |

## Extra info
- **Requires:** InteractionKit, UIKit, Motion, Icons. InteractionKit supplies the index tips (and the grabbable
  ball in Any Finger); UIKit runs the guide and carousel. No physics, internet, camera or Snap Cloud access. In the
  Lens Studio Preview, press from above with a pinch-hold and drag; the Preview's Poke enters from below, which
  `enterFromTopOnly` ignores by design. Real-hand feel (travel, thresholds) is best tuned on Specs.
- **Get started:** drag `Agnostic3DButton__PLACE_IN_SCENE.prefab` into a Specs scene and press "Ok, I understood".
  For your own button, add both components to an empty SceneObject and set the visual's `capMaterial` /
  `glowMaterial` to `Example/Materials/ButtonCap.mat` and `ButtonGlow.mat`.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md): the rules that most often break a button; read first.
  - [components.md](components.md): every input, event and method.
  - [examples.md](examples.md): what each example shows and how to build your own.
  - [how-it-works.md](how-it-works.md): the volume, the projection and the hysteresis.
  - [troubleshooting.md](troubleshooting.md): symptom, cause and fix.
  - [api-status.md](api-status.md): the current public surface and platform notes.
