/**
 * Example 1 — Hero Button: one big round button. Press it softly with your index finger: the cap
 * follows your finger, the depth bar and readout show pressValue, and a click fires once per press.
 */
import {ButtonShape} from "../../Scripts/ButtonVolume"
import {buildSlab} from "../../Scripts/ButtonMeshes"
import {createButton, createConsole} from "../Shared/ButtonFactory"
import {BODY_SIZE, createText, TITLE_SIZE} from "../Shared/DemoUI"

@component
export class HeroButton extends BaseScriptComponent {
  @input capMaterial: Material
  @input glowMaterial: Material

  @input
  @widget(new ComboBoxWidget([new ComboBoxItem("Specs Glass", 0), new ComboBoxItem("Neon", 1), new ComboBoxItem("Candy", 2), new ComboBoxItem("Metal", 3)]))
  theme: number = 0

  private clicks = 0

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.build())
  }

  private build(): void {
    const root = this.sceneObject
    createText(root, "Title", new vec3(0, 9, 0), TITLE_SIZE, 30, 4, "Press softly")
    const readout = createText(root, "Readout", new vec3(0, 5.5, 0), BODY_SIZE, 30, 3, "press 0.00   clicks 0")

    // Depth bar: a rounded track with a blue fill that grows with the press value. The fill mesh is
    // rebuilt at its new length (never stretched), so its round ends keep their shape.
    const BAR_WIDTH = 16
    const BAR_HEIGHT = 0.9
    const barRoot = global.scene.createSceneObject("DepthBar")
    barRoot.setParent(root)
    barRoot.getTransform().setLocalPosition(new vec3(0, 3.2, 0))
    barRoot.getTransform().setLocalRotation(quat.fromEulerAngles(Math.PI / 2, 0, 0))
    const track = global.scene.createSceneObject("Track")
    track.setParent(barRoot)
    const trackVisual = track.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    trackVisual.mesh = buildSlab(ButtonShape.Box, new vec2(BAR_WIDTH, BAR_HEIGHT), 0.2, 0, BAR_HEIGHT / 2)
    trackVisual.mainMaterial = this.capMaterial.clone()
    trackVisual.mainPass.baseColor = new vec4(0.16, 0.2, 0.28, 1)
    const fill = global.scene.createSceneObject("Fill")
    fill.setParent(barRoot)
    fill.getTransform().setLocalPosition(new vec3(0, 0.12, 0))
    const fillVisual = fill.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    fillVisual.mainMaterial = this.glowMaterial.clone()
    fillVisual.mainPass.baseColor = new vec4(0.2, 0.52, 1.0, 1)
    fillVisual.setRenderOrder(trackVisual.getRenderOrder() + 1)
    const inner = BAR_HEIGHT - 0.2
    let shownLength = -1
    const setFill = (p: number) => {
      // Below one bar-height the pill can't keep round ends, so it only shows once there is room for them.
      const length = inner + (BAR_WIDTH - 0.2 - inner) * p
      const quantized = Math.round(length * 20) / 20
      if (quantized === shownLength) return
      shownLength = quantized
      fill.enabled = p > 0.001
      if (!fill.enabled) return
      fillVisual.mesh = buildSlab(ButtonShape.Box, new vec2(quantized, inner), 0.2, 0, inner / 2)
      fill.getTransform().setLocalPosition(new vec3(-(BAR_WIDTH - 0.2) / 2 + quantized / 2, 0.12, 0))
    }

    const deck = createConsole(root, "Console", new vec3(0, -4, 0))
    const hero = createButton(deck, "HeroButton", vec3.zero(), this.capMaterial, this.glowMaterial, {
      shape: ButtonShape.Cylinder,
      size: new vec2(11, 11),
      travel: 1.8,
      capHeight: 1.6,
      label: "PRESS",
      labelSize: 64,
      theme: this.theme,
    })

    const show = () => {
      const p = hero.button.pressValue
      readout.text = "press " + p.toFixed(2) + "   clicks " + this.clicks
      setFill(p)
    }
    hero.button.onPressValue.add(show)
    hero.button.onClick.add(() => {
      this.clicks++
      show()
    })
    show()
  }
}
