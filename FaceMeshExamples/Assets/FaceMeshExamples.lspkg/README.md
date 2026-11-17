<p align="center">
  <img src="Docs/media/FaceMeshExamples.png" width="250px" alt="FaceMeshExamples"/>
</p>

# Face Mesh Examples

Face Mesh Examples puts a character head on the face of the person you're looking at. Specs' world camera tracks their face with a **Head binding**, the head follows its position and rotation, and the tracked **Face Mesh** reports their expressions (jaw, mouth, smile, blinks, brows) every frame. Those weights drive matching shape keys on each head, so the character talks and blinks with them.

Four heads ship with the package: **Capybara**, **Egg Guy**, **Frog** and **Pirate Shark**. Each was made with the Lens Studio GenAI Head Generator, rigged with expression shape keys and given a shader that fades the neck to black (on Specs' additive display, black is see-through).

## Features

- **Heads on other people's faces**: Specs' camera faces outward, so the heads go on the faces you see through the glasses, not on the wearer.
- **Live expressions**: jaw open/left/right, smile, frown, pucker, puff, blinks, eye open and brows are copied from the Face Mesh onto each head's shape keys, with per-shape gain and smoothing so cartoon faces read clearly. Jaw open is calibrated per person.
- **Stable tracking**: the head follows the face with adaptive smoothing and holds its last pose briefly when tracking drops. With no face in view, it waits on a stage 70 cm in front of you.
- **Selector panel**: a small UIKit panel that follows you lets you cycle heads, scale the current head and change the neck fade. Its Debug button shows the raw tracked Face Mesh next to the head.
- **Wave to switch**: wave either hand side to side to switch to the next head. In the Lens Studio preview, press **W**.
- **Self-contained**: the prefab carries the Head binding, the heads, the panel, the audio and a guide. Drop it into a Specs scene with SIK and the Camera.

## Quick Start

1. Drag `FaceMeshExamples__PLACE_IN_SCENE` into a Specs scene (Camera with Device Tracking and the SIK prefab are already there) and press "Ok, I understood".
2. On SPECS, look at someone's face about 0.5–2 m away. The current head appears on it and copies their expressions.
3. Use the panel below your view: **‹ / ›** cycle heads, **− / +** scale the head, **Fade − / +** changes how much of the neck fades out, **Debug** toggles the raw Face Mesh. Or wave a hand to switch heads.

To drive the heads from your own script, call `cycle()` on `FaceMeshExamplesMain`:

```ts
import {FaceMeshExamplesMain} from "FaceMeshExamples.lspkg/Scripts/FaceMeshExamplesMain"

@component
export class NextHeadOnPinch extends BaseScriptComponent {
  @input main: FaceMeshExamplesMain

  onAwake() {
    this.createEvent("TapEvent").bind(() => this.main.cycle(1))
  }
}
```

## Usage

This section ships with the package and describes the exact installed revision.
Read it, then follow the links into `Docs/` for the topic you need. It is
written for both people and coding agents; generic Lens scripting, scene
construction, and Specs spatial design are out of scope here.

### Package identity

- Package descriptor: `FaceMeshExamples.lspkg/package.native`
- Consumer import prefix: `FaceMeshExamples.lspkg/Scripts/`. The entry component is
  `FaceMeshExamples.lspkg/Scripts/FaceMeshExamplesMain`; the head list is in
  `FaceMeshExamples.lspkg/Scripts/FaceMeshExamplesSceneContracts`. See [components](Docs/components.md).
- Prefab entry point: `FaceMeshExamples__PLACE_IN_SCENE.prefab`. It is self-contained:
  drop it into a Specs scene (Camera with Device Tracking + SIK) and you get the guide
  panel ("Ok, I understood"), the four heads on the tracked face, the selector panel and
  wave switching. It ships its own Head binding (`HeadAnchor`) and moves it under the camera
  at start; face tracking only works there.
- Assets: `Heads/` (the four rigged GLB heads), `Materials/` (one HeadFade material per head,
  placeholder materials, the debug-dots material, `ProbeFaceMesh.facemesh`), `Shaders/`
  (`HeadFade.graphShader`, `unlit.graphShader`), `Audio/` (click and swap sounds),
  `Icons/` (panel icons), `Textures/FaceMeshDotGrid.png` (debug mask).
- Demo scaffolding: `Example/GuideDismissPanel` (the "Ok, I understood" guide).
- Head authoring tools (Blender scripts) live next to the project in `Tools/`, outside the
  package. See [how the heads were made](Docs/how-heads-were-made.md).
- Required companion packages (`package_dependencies.json`): `InteractionKit` (hand data for the wave, the camera finder, Pinch on the panel) and `UIKit` (the selector panel and the guide), plus UI Kit's `Motion` and `Icons`.
  No internet, camera frame or Snap Cloud access.

### Version and API status

This is the first release. [API status](Docs/api-status.md) lists the public surface and
the platform notes.

### Applicability

Use this package for face-tracked effects on the people the wearer looks at: character
heads, masks, expression-driven props. For a plain Face Mesh overlay, use the FaceMesh
package; for full-body effects, use BodyMesh.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md): read this first. It covers the rules that most often break a lens.
- [Components](Docs/components.md): every component, its inputs and its public methods.
- [Examples](Docs/examples.md): prefab drag-and-drop, your own head, driving it from script.
- [How the heads were made](Docs/how-heads-were-made.md): Head Generator prompts and the Blender tools.
- [Troubleshooting](Docs/troubleshooting.md): symptom → cause → fix.
- [API status](Docs/api-status.md): what's current in this revision and platform notes.

### Verification

1. TypeScript compiles with no errors; the HeadFade shader compiles.
2. In the Lens Studio preview: the guide shows, "Ok, I understood" hides it, the active head waits on the stage in front of you, the panel cycles heads (name and index update, swap sound plays), scale and fade change the head, Debug toggles the Face Mesh view, and W switches heads.
3. On SPECS: looking at someone's face puts the head on it, the head copies their jaw, smile, blinks and brows, and it returns to the stage when they leave the view.
