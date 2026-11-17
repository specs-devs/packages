<p align="center">
  <img src="Docs/media/InteractableHelper.png" width="250px" alt="InteractableHelper"/>
</p>

# Interactable Helper

Interactable Helper is a no-code way to wire SIK interaction events to visual
and audio responses. Put it on an object, list responses under Hover Enter,
Hover Exit, Pinch Down and Pinch Up / Select, and each event plays them: set
state, toggle, iterate children, transform tweens, animation clips, material
property or base color tweens, script callbacks, blendshapes, audio and video
textures.

## Features

- **Four SIK events**: hover enter, hover exit, pinch down (trigger start), pinch up / select (trigger end)
- **Eleven response types**, several per event
- **Play options**: Play From Current Value, Play Everytime, Toggle between two values
- **Easing, delay and duration** for every tween
- **On start / on complete actions**: call a script function or set objects on/off
- **Self-configuring**: adds a Collider and a SIK `Interactable` if the object has none

## Usage

This section ships with the package and describes the exact installed revision.
Read it, then follow the links into `Docs/` for the topic you need. It is
written for both people and coding agents; generic Lens scripting, scene
construction, and Specs spatial design are out of scope here.

### Package identity

- Package descriptor: `InteractableHelper.lspkg/package.native`
- Consumer import prefix: the component sits at the **package root**,
  `InteractableHelper.lspkg/InteractableHelper`. Its data types are under
  `InteractableHelper.lspkg/Scripts/` (for example `Scripts/EventResponseType`).
  See [components](Docs/components.md).
- Prefab entry point: `InteractableHelper__PLACE_IN_SCENE.prefab` (12 example groups, one
  per response type). It is self-contained: drop it into a Specs scene
  (Camera + SIK) and you get the guide, the example carousel and the 12
  examples.
- Demo scaffolding: `InteractableHelper.lspkg/Example/` holds `ExampleCarousel`
  and `GuideDismissPanel`. The prefab uses them to present the demo; the
  InteractableHelper component doesn't depend on them. The demo's visuals
  (Elephant prefab and animation, materials, shaders, audio, video) are in
  `InteractableHelper.lspkg/Examples/VisResources/`
  ([components](Docs/components.md#demo-assets-examplesvisresources)).
- Required companion packages (`package_dependencies.json`):
  `InteractionKit` (`Interactable`), `Utilities` and
  `SnapDecorators` (imported by the component), plus `UIKit`,
  `Motion` and `Icons`. The scene needs the SIK prefab, or no
  hover/pinch event ever fires.

### Version and API status

Read [API status](Docs/api-status.md) before reusing an older example. The
previous README showed an `execute()` / `eventType` scripting API that does not
exist in this package. Configuration happens in the Inspector.

### Applicability

Use Interactable Helper for simple, designer-configured reactions to hover and
pinch on a single object. For real controls (buttons, toggles, sliders, panels)
use UIKit. For grabbing and moving objects use SIK
`InteractableManipulation`. For custom logic, subscribe to the SIK
`Interactable` events in your own script.

### Package Docs (ship in `Docs/`)

Lens Studio auto-extracts these files into the project's install Cache on
import, so an agent can read them there. Treat only the members documented
here as supported API; never guess an import path.

- [cheat sheet](Docs/cheat-sheet.md) - load-bearing rules; read first
- [components](Docs/components.md) - `InteractableHelper` and every response data type: fields, combo values, defaults
- [API status](Docs/api-status.md) - Current / Deprecated / Experimental / Removed / Internal
- [minimal examples](Docs/examples.md) - prefab path, Inspector setup, callback scripts, triggering from code
- [guide and recipes](Docs/guide.md) - what each response type does, plus chained, staggered and toggle recipes
- [troubleshooting](Docs/troubleshooting.md) - package-specific symptoms and fixes

### Verification

1. Compile with no TypeScript errors. Callback target scripts expose a
   **public** method whose name matches `functionName`.
2. Preview with the SIK prefab: hover and pinch the object, and every configured
   response plays (the prefab examples show each type).
3. The logs show no `Interactable Helper on … is missing …` errors. Each
   response's target has the component it needs (AnimationPlayer,
   RenderMeshVisual, AudioComponent, Image with a video texture).
4. Toggle and Iterate responses alternate correctly over several pinches.

## Built with 👽 by the SPECS team
