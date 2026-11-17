# FaceMeshExamples cheat sheet

[← Agent usage index](../README.md)

## Use when

Read this first, before you build or edit a Lens with FaceMeshExamples.

1. **The heads go on other people.** Specs' world camera faces outward: the Head binding tracks the faces the wearer looks at, never the wearer's own. → [troubleshooting](troubleshooting.md)
2. **The Head binding must sit under the camera.** `HeadAnchor` carries the Head binding (face index 0). `FaceMeshExamplesMain` moves it under the camera at start if the prefab ships it elsewhere; don't reparent it later. → [components](components.md#facemeshexamplesmain)
3. **One head per slot, in order.** `FaceMeshExamplesHeadController.slots` lists `Slot_Capybara`, `Slot_EggWithEyes`, `Slot_Frog`, `Slot_PirateShark`; the panel and the wave cycle through them in that order. Add a head by adding a slot (and a `CHARACTERS` entry). → [examples](examples.md#add-your-own-head)
4. **Expressions need shape keys with Lens names.** `FaceMeshExamplesExpressionDriver` copies Face Mesh expression weights onto shape keys named after the Lens `Expressions` enum (`JawOpen`, `MouthSmileLeft`, …). A head without those keys follows the face but doesn't animate. → [how the heads were made](how-heads-were-made.md)
5. **Black is see-through on SPECS.** The HeadFade shader fades the bottom of each head to black so the neck dissolves into the real world. The panel's Fade − / + sets how much. → [components](components.md#materials-and-shaders)
6. **No face in view = the stage.** With no tracked face, the active head waits on `HeadStage` about 70 cm in front of the wearer; it jumps back onto a face as soon as one is tracked. → [components](components.md#facemeshexamplesheadcontroller)
7. **Hand data only exists after OnStart.** The wave switcher reads SIK `HandInputData` from OnStart on; in the Lens Studio preview, press **W** to simulate a wave. → [components](components.md#facemeshexampleswaveswitcher)
