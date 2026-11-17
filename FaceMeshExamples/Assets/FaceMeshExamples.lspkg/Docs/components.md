# FaceMeshExamples components

[← Agent usage index](../README.md)

All scripts live in `FaceMeshExamples.lspkg/Scripts/`.

## FaceMeshExamplesMain

Owns the experience: which head is active, the selector panel, the audio and the stage. Puts `HeadStage` in front of the camera at start and moves `HeadAnchor` under the camera if needed.

| Input | Default | What it does |
| --- | --- | --- |
| `headController` | — | `HeadSlots`' FaceMeshExamplesHeadController |
| `selectorUI` | — | `HeadSelectorUI`'s FaceMeshExamplesHeadSelectorUI |
| `headStage` | — | World-anchored fallback stage |
| `headAnchor` | — | The object with the Head binding (moved under the camera at start) |
| `camera` | empty | Main Camera; empty = SIK's world camera |
| `clickAudio`, `swapAudio` | — | AudioComponents for the button click and the head swap |
| `debugFaceMesh` | — | The panel's Debug button toggles it |
| `fadeHeads` | [] | Head visuals using the HeadFade material (Fade − / + updates them) |
| `fadeAmount` | 0.3 | Fraction of each head's height, from the bottom, that fades out |
| `startIndex` | 0 | Head shown first |
| `scaleStep` | 0.1 | Step for the panel's − / + scale buttons |
| `stageDistanceCm`, `stageHeightOffsetCm` | 110, 0 | Where the stage sits when no face is tracked |
| `clickVolume`, `swapVolume` | 0.6, 0.8 | Audio volumes |

Methods: `cycle(delta)` switches head by `delta` (wraps), `recenterStage()` puts the stage back in front of the wearer.

## FaceMeshExamplesHeadController

Shows one slot at a time and moves `HeadSlots` onto the tracked face (or the stage).

| Input | Default | What it does |
| --- | --- | --- |
| `headAnchor`, `headBinding` | — | `HeadAnchor` and its Head binding (face index 0) |
| `headStage` | — | Default parent of `HeadSlots` when no face is tracked |
| `slots` | [] | One SceneObject per head, in cycle order |
| `jawScaleAmount` | 0.2 | Extra vertical stretch on jaw open |
| `minCutoff`, `speedResponse` | 0.8, 0.02 | Pose stabilization (lower cutoff = steadier, higher response = less lag) |
| `lostGraceSec` | 0.4 | Hold the last pose this long after tracking drops |

Methods: `setActive(index)`, `getActiveIndex()`, `getSlotCount()`, `getSlot(index)`, `isFaceBound()`.

## FaceMeshExamplesExpressionDriver

Copies Face Mesh expression weights onto each head's shape keys (names match the Lens `Expressions` enum).

| Input | Default | What it does |
| --- | --- | --- |
| `faceMesh` | — | The Face Mesh asset tracking the person |
| `heads` | [] | RenderMeshVisuals of the rigged heads |
| `gain` | 1.0 | Overall exaggeration on top of the per-expression gains |
| `responsiveness` | 0.45 | Smoothing (1 = none, lower = steadier) |
| `calibrate` | true | Learn each person's resting/peak range and stretch it to full strength |
| `minRange` | 0.15 | Smallest range calibration will stretch |
| `learnedGain` | 1.0 | Strength of the learned expression shapes |

## FaceMeshExamplesHeadSelectorUI

The UIKit panel: ‹ / › cycle heads, − / + scale, Fade − / +, Debug. Inputs: `viewDistanceCm` (55), `innerWidthCm` (16), `innerHeightCm` (4.5), `buttonSizeCm` (3.5), `initialName`, `indexColor`, `sourceColor`. It raises events that `FaceMeshExamplesMain` handles; it doesn't change heads itself.

## FaceMeshExamplesPanelFollow

Keeps the panel below the wearer's view. Inputs: `camera` (empty = SIK world camera), `distanceCm` (45), `heightCm` (−30), `followSpeed` (3), `turnThresholdDeg` (30), `moveThresholdCm` (20).

## FaceMeshExamplesWaveSwitcher

Wave either hand side to side to switch heads. Inputs: `main`, `minSwingCm` (6), `windowSec` (1.2), `reversalsNeeded`, `cooldownSec` (1.5). In the Lens Studio preview, press **W**.

## FaceMeshExamplesDebugFaceMesh

Shows the raw tracked Face Mesh next to the head with a dot-grid mask, so you can compare tracking with the head. Inputs: `faceVisual`, `showDebugFaceMesh`, `maskMaterial`, `maskTexture` (`Textures/FaceMeshDotGrid.png`), `debugParent`, `offsetCm` (−22, 0, 0). Authoring-only: `dumpVertices` and `recordSeconds` / `recordInterval` print Face Mesh data for the offline tools (see [how the heads were made](how-heads-were-made.md)). Methods: `isDebugVisible()`, `setDebugVisible(visible)`.

## Supporting scripts

- `FaceMeshExamplesAudioController`: plays the click and swap sounds.
- `FaceMeshExamplesSceneBuild`: runtime fallback that adds a placeholder sphere to an empty slot.
- `FaceMeshExamplesSceneContracts`: the `CHARACTERS` table (id, display name, slot name, placeholder colour, Head Generator prompt) and the shared scene names.

## Materials and shaders

- `Shaders/HeadFade.graphShader` + one `Materials/HeadFade_<Head>.mat` per head: the head's texture with a fade to black toward the neck. Black is see-through on SPECS.
- `Materials/Placeholder_<Head>.mat` + `Meshes/PlaceholderSphere.mesh`: shown in a slot with no head.
- `Materials/FaceMeshDebugDots.mat`, `Materials/ProbeFaceMesh.facemesh`: the debug view.
