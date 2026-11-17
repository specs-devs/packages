/**
 * Example 2 — Keypad: twelve rounded-square keys (1–9, C, 0, OK) on one console, all pressed by the
 * same SIK fingertips. Digits appear on the display; C clears; OK flashes the code.
 */
import {ButtonShape} from "../../Scripts/ButtonVolume"
import {createButton, createConsole} from "../Shared/ButtonFactory"
import {BODY_SIZE, createText, TITLE_SIZE} from "../Shared/DemoUI"

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"]
// Key 3.4 + clearance 0.15 + bezel 0.5 on each side = 4.7; the 0.5 gap left between neighbours' bezels
// is wider than the glow ring (0.3), so no two keys' surfaces touch.
const KEY_SIZE = 3.4
const BEZEL = 0.5
const PITCH = 5.2
const MAX_DIGITS = 8

@component
export class Keypad extends BaseScriptComponent {
  @input capMaterial: Material
  @input glowMaterial: Material

  @input
  @widget(new ComboBoxWidget([new ComboBoxItem("Specs Glass", 0), new ComboBoxItem("Neon", 1), new ComboBoxItem("Candy", 2), new ComboBoxItem("Metal", 3)]))
  theme: number = 1

  private code = ""
  private display: Text
  private status: Text
  private statusUntil = 0

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.build())
    this.createEvent("UpdateEvent").bind(() => {
      if (this.status && this.statusUntil > 0 && getTime() > this.statusUntil) {
        this.status.text = "Type a code, then OK"
        this.statusUntil = 0
      }
    })
  }

  private build(): void {
    const root = this.sceneObject
    createText(root, "Title", new vec3(0, 13, 0), TITLE_SIZE, 30, 4, "Keypad")
    this.display = createText(root, "Display", new vec3(0, 9.5, 0), TITLE_SIZE, 30, 4, "_")
    this.status = createText(root, "Status", new vec3(0, 6.5, 0), BODY_SIZE, 30, 3, "Type a code, then OK")

    // Low enough that the top row stays below the status text (no key reaches the display's plane).
    const deck = createConsole(root, "Keys", new vec3(0, -5.5, 0))
    KEYS.forEach((key, i) => {
      const col = i % 3
      const row = Math.floor(i / 3)
      const pos = new vec3((col - 1) * PITCH, 0, (row - 1.5) * PITCH)
      const made = createButton(deck, "Key " + key, pos, this.capMaterial, this.glowMaterial, {
        shape: ButtonShape.Box,
        size: new vec2(KEY_SIZE, KEY_SIZE),
        bezelWidth: BEZEL,
        travel: 1.0,
        capHeight: 1.0,
        label: key,
        labelSize: 56,
        theme: key === "OK" ? 0 : key === "C" ? 2 : this.theme,
      })
      made.button.onClick.add(() => this.onKey(key))
    })
  }

  private onKey(key: string): void {
    if (key === "C") {
      this.code = ""
    } else if (key === "OK") {
      this.status.text = this.code.length ? "Code " + this.code + " sent" : "Nothing to send"
      this.statusUntil = getTime() + 2
      this.code = ""
    } else if (this.code.length < MAX_DIGITS) {
      this.code += key
    }
    this.display.text = this.code.length ? this.code : "_"
  }
}
