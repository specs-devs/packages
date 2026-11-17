# Raymarching examples

[← Agent usage index](../README.md)

## Drop in the prefab

Drag `Raymarching__PLACE_IN_SCENE` into a Specs scene (Camera with Device Tracking + the SIK prefab). The guide appears; "Ok, I understood" opens the carousel: Hand Goo → Pinch & Merge → Lava Lamp → Assistant Orb → Style Lab.

## Goo on your own objects

1. Create an object `Goo` with a **MetaballField**: `material` = `Shaders/MetaballField.mat`, `proxyMesh` = `Meshes/UnitSphere`, `preset` = Bubblegum.
2. Create children of `Goo` (or any objects) with a **MetaballSource** each, `radius` 3.
3. Animate the children: a tween, a physics body, a script — the surface follows.

## Goo on your hands

```ts
import {HandInputData} from "InteractionKit.lspkg/Providers/HandInputData/HandInputData"
import {MetaballSource} from "Raymarching.lspkg/Scripts/MetaballSource"

@component
export class GooFinger extends BaseScriptComponent {
  @input ball: MetaballSource

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      const hand = HandInputData.getInstance().getHand("right")
      this.createEvent("UpdateEvent").bind(() => {
        this.ball.radius = hand.isTracked() ? 1.6 : 0
        if (hand.isTracked()) this.ball.getTransform().setWorldPosition(hand.indexTip.position)
      })
    })
  }
}
```

`Example/HandGoo` does this for three fingertips and the palm of both hands (8 balls, one field).

## A field from code

```ts
const o = global.scene.createSceneObject("RuntimeGoo")
const field = o.createComponent(MetaballField.getTypeName()) as MetaballField
field.configure(this.metaballMaterial, this.unitSphere, "Lava")
```

## Change the look at runtime

```ts
field.setPreset("Liquid Chrome")
field.smoothness = 0.6 // gooier
field.wobble = 0.8 // ripples
field.intensity = 1.4 // brighter / more solid on SPECS
field.setColors(new vec3(0.2, 1, 0.6), new vec3(0.1, 0.4, 1), new vec3(1, 1, 1))
```

## Grab and squash

`Example/PinchMerge` gives each ball a sphere collider, a SIK `Interactable` and an `InteractableManipulation` (move only). Create the collider before the `Interactable`, and create SIK components in OnStart or later.
