/**
 * Example 6 — UIKit look: Agnostic3DButtons styled like UIKit's System 3.0 buttons
 * (style UIKit + the UIKit themes). A row of Primary / Secondary / Ghost rectangle buttons, a round
 * icon button and a pill toggle. No UIKit components: the package's own meshes and materials, pressed
 * softly by the finger like every other example.
 */
import {ButtonStyle} from "../../Scripts/Agnostic3DButtonVisual"
import {ButtonShape} from "../../Scripts/ButtonVolume"
import {createButton, createConsole, MadeButton} from "../Shared/ButtonFactory"
import {BODY_SIZE, createText, TITLE_SIZE} from "../Shared/DemoUI"

// UIKit's button is 9 × 3.75 cm; a little narrower here so three fit side by side in view.
const BUTTON_SIZE = new vec2(8, 3.5)
// Bezel 0.35 + clearance 0.15 per side: 9 cm per button, 0.5 cm between neighbours.
const PITCH = 9.5
const ROW_Z = 2.5
const BEZEL = 0.35
const TRAVEL = 0.8
const ICON_PIXELS = 64

@component
export class UIKitLook extends BaseScriptComponent {
  @input capMaterial: Material
  @input glowMaterial: Material

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.build())
  }

  private build(): void {
    const root = this.sceneObject
    createText(root, "Title", new vec3(0, 9, 0), TITLE_SIZE, 34, 4, "UIKit look")
    const info = createText(root, "Info", new vec3(0, 5.8, 0), BODY_SIZE, 34, 3, "Primary · Secondary · Ghost · Round · Pill")

    const deck = createConsole(root, "Console", new vec3(0, -3, 0))
    const make = (name: string, x: number, z: number, theme: string, extra: object): MadeButton => {
      const made = createButton(deck, name, new vec3(x, 0, z), this.capMaterial, this.glowMaterial, {
        shape: ButtonShape.Box,
        size: BUTTON_SIZE,
        travel: TRAVEL,
        labelSize: 48,
        theme,
        style: ButtonStyle.UIKit,
        bezelWidth: BEZEL,
        ...extra,
      })
      made.button.onClick.add(() => {
        if (!made.button.toggle) info.text = name + " clicked"
      })
      return made
    }
    make("Primary", -PITCH, -ROW_Z, "UIKit Primary", {label: "Primary"})
    make("Secondary", 0, -ROW_Z, "UIKit Secondary", {label: "Secondary"})
    make("Ghost", PITCH, -ROW_Z, "UIKit Ghost", {label: "Ghost"})
    make("Round", -PITCH / 2, ROW_Z, "UIKit Secondary", {shape: ButtonShape.Cylinder, size: new vec2(3.75, 3.75), icon: this.playIcon(), iconSize: 1.6})
    const pill = make("Pill", PITCH / 2, ROW_Z, "UIKit Primary", {label: "Toggle", pill: true, toggle: true, size: new vec2(9, 3.5)})
    pill.button.onToggle.add((on: boolean) => (info.text = on ? "Pill toggled on" : "Pill toggled off"))
  }

  /** A white "play" triangle on a transparent background, drawn in code so the example needs no texture asset. */
  private playIcon(): Texture {
    const texture = ProceduralTextureProvider.createWithFormat(ICON_PIXELS, ICON_PIXELS, TextureFormat.RGBA8Unorm)
    const data = new Uint8Array(ICON_PIXELS * ICON_PIXELS * 4)
    const s = ICON_PIXELS
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        // Triangle pointing right: x from 0.3 to 0.75 of the width, narrowing toward the tip.
        const u = x / s
        const v = Math.abs(y / s - 0.5)
        const inside = u > 0.3 && u < 0.75 && v < (0.75 - u) * 0.62
        const i = (y * s + x) * 4
        data[i] = 255
        data[i + 1] = 255
        data[i + 2] = 255
        data[i + 3] = inside ? 255 : 0
      }
    }
    ;(texture.control as ProceduralTextureProvider).setPixels(0, 0, s, s, data)
    return texture
  }
}
