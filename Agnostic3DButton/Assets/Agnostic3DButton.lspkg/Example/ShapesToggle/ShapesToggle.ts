/**
 * Example 3 — Shapes & Toggle: the same component as a round, a square and a pill button (all
 * momentary), plus a latching toggle that switches an on-light. Each button uses a different theme.
 */
import {ButtonShape} from "../../Scripts/ButtonVolume"
import {buildSlab} from "../../Scripts/ButtonMeshes"
import {createButton, createConsole} from "../Shared/ButtonFactory"
import {BODY_SIZE, createText, TITLE_SIZE} from "../Shared/DemoUI"

@component
export class ShapesToggle extends BaseScriptComponent {
  @input capMaterial: Material
  @input glowMaterial: Material

  private light: Pass
  private lightOn = false
  private lightLevel = 0

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.build())
    this.createEvent("UpdateEvent").bind(() => this.animateLight())
  }

  private build(): void {
    const root = this.sceneObject
    createText(root, "Title", new vec3(0, 9, 0), TITLE_SIZE, 34, 4, "Shapes & Toggle")
    const info = createText(root, "Info", new vec3(0, 5.8, 0), BODY_SIZE, 34, 3, "Round · Square · Pill · Toggle")

    const deck = createConsole(root, "Console", new vec3(0, -3, 0))
    const round = createButton(deck, "Round", new vec3(-11.2, 0, 0), this.capMaterial, this.glowMaterial, {
      shape: ButtonShape.Cylinder, size: new vec2(5, 5), label: "A", theme: "Candy",
    })
    const square = createButton(deck, "Square", new vec3(-4.4, 0, 0), this.capMaterial, this.glowMaterial, {
      shape: ButtonShape.Box, size: new vec2(5, 5), label: "B", theme: "Metal",
    })
    const pill = createButton(deck, "Pill", new vec3(3.4, 0, 0), this.capMaterial, this.glowMaterial, {
      shape: ButtonShape.Box, size: new vec2(7, 3.6), label: "C", theme: "Neon", cornerRadius: 1.8,
    })
    const toggle = createButton(deck, "Toggle", new vec3(11.2, 0, 0), this.capMaterial, this.glowMaterial, {
      shape: ButtonShape.Cylinder, size: new vec2(5, 5), label: "ON", theme: "Specs Glass", toggle: true,
    })

    for (const [made, name] of [[round, "Round"], [square, "Square"], [pill, "Pill"]] as const) {
      made.button.onClick.add(() => (info.text = name + " clicked"))
    }
    toggle.button.onToggle.add((on: boolean) => {
      this.lightOn = on
      info.text = on ? "Toggle latched ON" : "Toggle OFF"
    })

    // The on-light: a small glowing disc above the toggle.
    const lamp = global.scene.createSceneObject("OnLight")
    lamp.setParent(root)
    lamp.getTransform().setLocalPosition(new vec3(11.2, 2.5, 0))
    lamp.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI / 2, 0, 0))
    const v = lamp.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    v.mesh = buildSlab(ButtonShape.Cylinder, new vec2(1.6, 1.6), 0.4, 0.2, 0)
    v.mainMaterial = this.glowMaterial.clone()
    this.light = v.mainMaterial.mainPass
    this.light.blendMode = BlendMode.Add
  }

  private animateLight(): void {
    if (!this.light) return
    const target = this.lightOn ? 1 : 0.08
    this.lightLevel += (target - this.lightLevel) * (1 - Math.exp(-10 * getDeltaTime()))
    const l = this.lightLevel
    this.light.baseColor = new vec4(0.47 * l, 0.8 * l, 0.76 * l, 1)
  }
}
