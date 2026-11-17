/**
 * Example only: build Agnostic3DButton + Agnostic3DButtonVisual pairs from code, all tilted the
 * same way (top face toward the user, like a desk console), so the examples need no authored buttons.
 */
import {Agnostic3DButton} from "../../Scripts/Agnostic3DButton"
import {Agnostic3DButtonVisual} from "../../Scripts/Agnostic3DButtonVisual"
import {ButtonShape} from "../../Scripts/ButtonVolume"

/** Tilt of the console: the top face (+Y) leans this far toward the user (+Z). */
export const CONSOLE_TILT_DEG = 55

export interface ButtonOptions {
  shape?: ButtonShape
  size?: vec2
  travel?: number
  label?: string
  labelSize?: number
  theme?: string | number
  toggle?: boolean
  capHeight?: number
  cornerRadius?: number
  /** Visual style (ButtonStyle: 0 Classic, 1 UIKit). */
  style?: number
  /** UIKit style, box shape: capsule ends. */
  pill?: boolean
  icon?: Texture
  iconSize?: number
  /** Width of the bezel around the hole in the base (keep neighbours' bezels apart). */
  bezelWidth?: number
}

export interface MadeButton {
  object: SceneObject
  button: Agnostic3DButton
  visual: Agnostic3DButtonVisual
}

/** A tilted parent for a group of buttons ("console"), at `position` under `parent`. */
export function createConsole(parent: SceneObject, name: string, position: vec3): SceneObject {
  const o = global.scene.createSceneObject(name)
  o.setParent(parent)
  o.getTransform().setLocalPosition(position)
  o.getTransform().setLocalRotation(quat.fromEulerAngles((CONSOLE_TILT_DEG * Math.PI) / 180, 0, 0))
  return o
}

export function createButton(
  parent: SceneObject,
  name: string,
  position: vec3,
  capMaterial: Material,
  glowMaterial: Material,
  options: ButtonOptions = {}
): MadeButton {
  const o = global.scene.createSceneObject(name)
  o.setParent(parent)
  o.getTransform().setLocalPosition(position)
  const button = o.createComponent(Agnostic3DButton.getTypeName()) as Agnostic3DButton
  button.shape = options.shape ?? ButtonShape.Cylinder
  button.size = options.size ?? new vec2(6, 6)
  button.travel = options.travel ?? 1.2
  button.toggle = options.toggle ?? false
  const visual = o.createComponent(Agnostic3DButtonVisual.getTypeName()) as Agnostic3DButtonVisual
  if (options.capHeight !== undefined) visual.capHeight = options.capHeight
  if (options.labelSize !== undefined) visual.labelSize = options.labelSize
  if (options.cornerRadius !== undefined) visual.cornerRadius = options.cornerRadius
  if (options.style !== undefined) visual.style = options.style
  if (options.pill !== undefined) visual.pill = options.pill
  if (options.icon !== undefined) visual.icon = options.icon
  if (options.iconSize !== undefined) visual.iconSize = options.iconSize
  if (options.bezelWidth !== undefined) visual.bezelWidth = options.bezelWidth
  visual.configure(button, capMaterial, glowMaterial, options.theme ?? 0, options.label ?? "")
  return {object: o, button, visual}
}
