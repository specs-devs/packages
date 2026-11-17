<p align="center">
  <img src="Docs/media/Agnostic3DButton.png" width="250px" alt="Agnostic3DButton"/>
</p>

# Agnostic 3D Button

Every Specs project ends up building its own 3D button: a physics collider, a few helper objects,
some thresholds and a lot of tuning. Agnostic 3D Button is one soft-press button that works with
**any finger** — SIK fingertips, a grabbed ball, a controller tip, anything with a transform.

It needs no physics. The button defines a made-up geometric volume (a box or a cylinder) in its own
local space, measures how deep the deepest finger pushes into it every frame, and turns that depth
into a smooth `pressValue` (0..1) with hover, press, release, click, toggle and pressure events. A
separate visual makes it beautiful: a bevelled cap that sinks and squashes softly, a glow that blooms
on hover and flashes on click, and four themes.

## Features

- **Any finger**: a list of SceneObjects, both SIK index tips (on by default), or your own position source.
- **No physics**: an analytic box / cylinder volume in local space; scale or rotate the button and the volume follows.
- **Soft press**: the cap follows the finger, springs back when it leaves, presses only when the finger comes in from the top.
- **Reliable clicks**: press and release thresholds with hysteresis, so a click fires once per press.
- **Toggle and pressure**: latching `toggle` mode with `onToggle`, and continuous `onPressValue` for analog controls.
- **Beautiful by default**: a bevelled cap that sinks into a holed base (bezel + well), glow ring, colour easing, label, click sound; themes Specs Glass, Neon, Candy, Metal.
- **UIKit look**: `style` UIKit with the UIKit Primary / Secondary / Ghost themes gives the System 3.0 button look, with no UIKit components.
- **Finger shadow**: a flat circle in a darker shade of the button's colour under the nearest finger; it shrinks as the finger approaches.
- **Responsive, never stuck**: the cap follows the finger the same frame, holds briefly after lift-off, and always releases a lost finger.
- **Self-contained demo**: the prefab ships a guide and an example carousel with six examples.

## Quick Start

1. Drag `Agnostic3DButton__PLACE_IN_SCENE` into a Specs scene (Camera with Device Tracking and the SIK prefab are already there) and press "Ok, I understood".
2. Press the buttons softly with your index finger; the carousel steps through the examples.
3. For your own button: add `Agnostic3DButton` and `Agnostic3DButtonVisual` to an empty SceneObject (its local +Y is the top of the button), set the visual's materials to `Example/Materials/ButtonCap.mat` and `ButtonGlow.mat`, then listen for clicks:

```ts
import {Agnostic3DButton} from "Agnostic3DButton.lspkg/Scripts/Agnostic3DButton"

@component
export class Doorbell extends BaseScriptComponent {
  @input button: Agnostic3DButton

  onAwake() {
    this.button.onClick.add(() => print("Ding dong"))
    this.button.onPressValue.add((v) => print("pressed " + v.toFixed(2)))
  }
}
```

## Usage

This section ships with the package and describes the exact installed revision.
Read it, then follow the links into `Docs/` for the topic you need. It is
written for both people and coding agents; generic Lens scripting, scene
construction, and Specs spatial design are out of scope here.

### Package identity

- Package descriptor: `Agnostic3DButton.lspkg/package.native`
- Consumer import prefix: `Agnostic3DButton.lspkg/Scripts/`. The components are
  `Agnostic3DButton.lspkg/Scripts/Agnostic3DButton` (press logic, events) and
  `Agnostic3DButton.lspkg/Scripts/Agnostic3DButtonVisual` (the look). See [components](Docs/components.md).
- Prefab entry point: `Agnostic3DButton__PLACE_IN_SCENE.prefab`. It is self-contained: the guide
  ("Ok, I understood"), the example carousel and the six examples (Hero Button, Keypad, Shapes & Toggle,
  Pressure, Any Finger, UIKit look).
- Demo-only code lives in `Example/` (examples, `ExampleCarousel`, `GuideDismissPanel`, the button
  factory and panel helpers); the package API is `Scripts/`.
- Required companion packages (`package_dependencies.json`): `InteractionKit`
  (hand data for the index tips, the grabbable ball in Any Finger) and `UIKit` (the
  guide and carousel), plus UI Kit's `Motion` and `Icons`.
  No physics, internet, camera or Snap Cloud access.

### Version and API status

This is the first release. [API status](Docs/api-status.md) lists the public surface.

### Applicability

Use it for any button you press with a finger or an object: keypads, consoles, toggles, analog
pressure controls, buttons on moving or scaled objects. For pinch-and-point UI panels, use UI Kit's
buttons; for pinch-grabbing objects, SIK's Interactable.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md): read this first. It covers the rules that most often break a button.
- [Components](Docs/components.md): every input, event and method.
- [Examples](Docs/examples.md): what each example shows and how to build your own.
- [How it works](Docs/how-it-works.md): the volume, the projection and the hysteresis.
- [Troubleshooting](Docs/troubleshooting.md): symptom → cause → fix.
- [API status](Docs/api-status.md): what's current in this revision.

### Verification

1. TypeScript compiles with no errors.
2. In the Lens Studio preview: the guide shows, "Ok, I understood" hides it, the carousel steps through the six examples, and pressing each button from above with the simulated hand sinks the cap into its well, fires one click per press, latches the toggle, types on the keypad, dims the lamp, and lets the ball press its button. (The preview tool's Poke teleports the fingertip into the button from below, which `enterFromTopOnly` ignores by design: press with a pinch-hold + drag from above.)
3. On SPECS: index fingertips press every button softly from the top; pressing from the side does nothing.
