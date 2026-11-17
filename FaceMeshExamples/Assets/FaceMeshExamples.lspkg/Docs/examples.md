# FaceMeshExamples examples

[← Agent usage index](../README.md)

## Drop in the prefab

1. Open a Specs project with the Camera (Device Tracking) and the SIK prefab.
2. Drag `FaceMeshExamples__PLACE_IN_SCENE` into the scene root and press Preview: the guide shows; "Ok, I understood" reveals the panel and the active head on the stage.
3. On SPECS, look at someone 0.5–2 m away: the head moves onto their face and copies their expressions.

## Switch heads from your own script

```ts
import {FaceMeshExamplesMain} from "FaceMeshExamples.lspkg/Scripts/FaceMeshExamplesMain"

@component
export class NextHeadOnTap extends BaseScriptComponent {
  @input main: FaceMeshExamplesMain

  onAwake() {
    this.createEvent("TapEvent").bind(() => this.main.cycle(1))
  }
}
```

## Add your own head

1. Generate a head (Lens Studio AI → GenAI Home Page → Head Generator) and rig it with expression shape keys named after the Lens `Expressions` enum; the [tools](how-heads-were-made.md) do this in Blender.
2. Add a slot under `HeadSlots` (e.g. `Slot_Robot`), put the head in it and give it a `HeadFade` material.
3. Add the slot to `FaceMeshExamplesHeadController.slots`, the head's visual to `FaceMeshExamplesExpressionDriver.heads` and `FaceMeshExamplesMain.fadeHeads`, and a `CHARACTERS` entry in `FaceMeshExamplesSceneContracts`.
4. Preview: the panel lists it; on SPECS it follows faces and expressions like the others.

## Compare tracking with the head

Press **Debug** on the panel: the raw Face Mesh with a dot grid appears 22 cm to the side of the head, so you can see which expression the head is missing.
