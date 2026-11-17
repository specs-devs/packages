// Shared helpers for the Utilities demo examples (project only, not part of the package).

export const PANEL_COLOR = new vec4(0.08, 0.09, 0.12, 0.9)
export const ACCENT_COLOR = new vec4(0.45, 0.75, 1, 1)
export const WARM_COLOR = new vec4(1, 0.65, 0.3, 1)
export const GREEN_COLOR = new vec4(0.45, 0.9, 0.55, 1)

/** Creates a child SceneObject at a local position. */
export function createChild(parent: SceneObject, name: string, position: vec3): SceneObject {
  const child = global.scene.createSceneObject(name)
  child.setParent(parent)
  child.getTransform().setLocalPosition(position)
  return child
}

/** Creates a left-aligned, wrapping Text on a dark rounded background, `width` x `height` cm. */
export function createPanelText(
  parent: SceneObject,
  name: string,
  position: vec3,
  size: number,
  width: number,
  height: number
): Text {
  const text = createChild(parent, name, position).createComponent("Component.Text")
  text.size = size
  text.textFill.color = new vec4(1, 1, 1, 1)
  text.horizontalAlignment = HorizontalAlignment.Left
  text.verticalAlignment = VerticalAlignment.Top
  text.horizontalOverflow = HorizontalOverflow.Wrap
  text.verticalOverflow = VerticalOverflow.Shrink
  text.layoutRect = Rect.create(-width / 2, width / 2, -height / 2, height / 2)
  text.backgroundSettings.enabled = true
  text.backgroundSettings.fill.color = PANEL_COLOR
  text.backgroundSettings.cornerRadius = 1
  text.backgroundSettings.margins = Rect.create(1, 1, 1, 1)
  return text
}

/** Formats a number with a fixed number of decimals. */
export function fmt(value: number, decimals: number = 2): string {
  return value.toFixed(decimals)
}
