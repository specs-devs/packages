# Face Mesh Examples

## What it is
A package that puts a character head on the face of the person the wearer is looking at. Specs' world camera tracks
their face with a Head binding, and the tracked Face Mesh expression weights drive matching shape keys on the head, so
the character talks and blinks with them. It is for developers building face-tracked effects (heads, masks,
expression-driven props) for the people in front of the wearer.

## What it does
1. Drop `FaceMeshExamples__PLACE_IN_SCENE.prefab` into a Specs scene with the Camera (Device Tracking) and Interaction
   Kit (SIK), then press "Ok, I understood" on the guide.
2. `FaceMeshExamplesMain` moves `HeadAnchor` (the Head binding, face index 0) under the camera and places a stage about
   70 cm in front of the wearer.
3. When a face is tracked, `FaceMeshExamplesHeadController` moves the active head onto it with adaptive smoothing and
   holds the last pose briefly when tracking drops; with no face in view the head waits on the stage.
4. `FaceMeshExamplesExpressionDriver` copies jaw, mouth, smile, frown, pucker, puff, blink, eye and brow weights onto
   the head's shape keys, with per-shape gain, smoothing and per-person jaw calibration.
5. A UI Kit selector panel that lazily follows the wearer cycles heads, scales the head, changes the neck fade and
   toggles a Debug view of the raw Face Mesh. Waving a hand side to side also switches heads (press **W** in the
   Lens Studio Preview).

## Highlights
- Four rigged heads ship: Capybara, Egg Guy, Frog and Pirate Shark, made with the Lens Studio GenAI Head Generator.
- The `HeadFade` shader fades the neck to black, which is see-through on the Specs additive display.
- Shape keys are named after the Lens `Expressions` enum, so any head rigged that way animates.
- Add your own head by adding a slot, a `HeadFade` material and a `CHARACTERS` entry.
- No internet, camera-frame or Snap Cloud access.
- Script API: `cycle(delta)` and `recenterStage()` on `FaceMeshExamplesMain`.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/FaceMeshExamplesMain.ts` | Owns the active head, wires panel, audio and stage; exposes `cycle()` and `recenterStage()`. |
| `Scripts/FaceMeshExamplesHeadController.ts` | Shows one head slot and moves it onto the tracked face or the fallback stage. |
| `Scripts/FaceMeshExamplesExpressionDriver.ts` | Copies Face Mesh expression weights onto each head's shape keys. |
| `Scripts/FaceMeshExamplesHeadSelectorUI.ts` | UI Kit panel: previous/next head, scale, fade and Debug buttons. |
| `Scripts/FaceMeshExamplesWaveSwitcher.ts` | Detects a side-to-side hand wave (or **W** in the Preview) to switch heads. |
| `Scripts/FaceMeshExamplesPanelFollow.ts` | Keeps the selector panel low in front of the wearer, re-centring only on large turns or moves. |
| `Scripts/FaceMeshExamplesDebugFaceMesh.ts` | Shows the raw tracked Face Mesh next to the head for comparison. |
| `Scripts/FaceMeshExamplesSceneContracts.ts` | Shared data: character catalog, scene object names and helpers. |

## Extra info
- **Requires:** InteractionKit, UIKit, Motion, Icons. The heads track other people (0.5-2 m away), never the wearer.
  Face tracking quality and expression fidelity need checking on Specs; the Preview covers the guide, panel, stage and
  **W** wave shortcut. Hand data is only available from `OnStart`.
- **Get started:** `FaceMeshExamples__PLACE_IN_SCENE.prefab` carries the Head binding, the heads, the panel, the audio
  and the guide; drop it in and look at someone's face.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - the rules that most often break the Lens, read first.
  - [components.md](components.md) - every component, its inputs and public methods.
  - [examples.md](examples.md) - prefab drop-in, adding your own head, driving it from script.
  - [how-heads-were-made.md](how-heads-were-made.md) - Head Generator prompts and the Blender pipeline.
  - [api-status.md](api-status.md) - current surface and platform notes.
  - [troubleshooting.md](troubleshooting.md) - symptom, cause and fix.
