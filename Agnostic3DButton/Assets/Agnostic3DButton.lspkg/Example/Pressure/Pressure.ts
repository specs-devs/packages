/**
 * Example 4 — Pressure: a deep, pressure-sensitive button. onPressValue drives a lamp
 * continuously: the deeper you push, the brighter and bigger it glows. No thresholds needed.
 */
import {ButtonShape} from "../../Scripts/ButtonVolume"
import {buildSlab} from "../../Scripts/ButtonMeshes"
import {createButton, createConsole} from "../Shared/ButtonFactory"
import {BODY_SIZE, createText, TITLE_SIZE} from "../Shared/DemoUI"

@component
export class Pressure extends BaseScriptComponent {
  @input capMaterial: Material
  @input glowMaterial: Material

  @input
  @hint("Lamp colour at full pressure")
  lampColor: vec3 = new vec3(1.0, 0.78, 0.35)

  private lamp: SceneObject
  private lampPass: Pass
  private level = 0
  private target = 0
  private readout: Text

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.build())
    this.createEvent("UpdateEvent").bind(() => this.animate())
  }

  private build(): void {
    const root = this.sceneObject
    createText(root, "Title", new vec3(0, 12, 0), TITLE_SIZE, 30, 4, "Pressure")
    // Beside the lamp: below the tilted console it would be hidden by the plate when seen from above.
    this.readout = createText(root, "Readout", new vec3(9, 5.5, 0), BODY_SIZE, 10, 3, "0 %")

    this.lamp = global.scene.createSceneObject("Lamp")
    this.lamp.setParent(root)
    this.lamp.getTransform().setLocalPosition(new vec3(0, 5.5, 0))
    this.lamp.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI / 2, 0, 0))
    const v = this.lamp.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    v.mesh = buildSlab(ButtonShape.Cylinder, new vec2(5, 5), 2.5, 1.2, 0)
    v.mainMaterial = this.glowMaterial.clone()
    this.lampPass = v.mainMaterial.mainPass
    this.lampPass.blendMode = BlendMode.Add
    this.lampPass.twoSided = true

    const deck = createConsole(root, "Console", new vec3(0, -4, 0))
    const made = createButton(deck, "PressureButton", vec3.zero(), this.capMaterial, this.glowMaterial, {
      shape: ButtonShape.Cylinder,
      size: new vec2(8, 8),
      travel: 3.0,
      capHeight: 2.2,
      label: "PUSH",
      theme: "Metal",
    })
    made.button.returnSpeed = 12
    made.button.onPressValue.add((p: number) => {
      this.target = p
      this.readout.text = Math.round(p * 100) + " %"
    })
  }

  private animate(): void {
    if (!this.lampPass) return
    this.level += (this.target - this.level) * (1 - Math.exp(-14 * getDeltaTime()))
    const l = 0.06 + this.level * 1.1
    const c = this.lampColor
    this.lampPass.baseColor = new vec4(c.x * l, c.y * l, c.z * l, 1)
    const s = 0.85 + this.level * 0.5
    this.lamp.getTransform().setLocalScale(new vec3(s, s, s))
  }
}
