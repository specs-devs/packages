/**
 * SPECS Inc. 2027
 * Marks a SceneObject for Web Capture and says how the portal should draw it. Optional: the
 * WebCapture component can also capture plain SceneObjects (Tracked Objects) or every descendant of
 * a root, and then guesses the shape from the object's mesh or Text.
 */
import {
  CaptureObject,
  CaptureParams,
  clampString,
  MAX_NAME_LENGTH,
  MAX_TEXT_LENGTH,
  Primitive,
  PRIMITIVES,
  round
} from "./WebCaptureProtocol"

@component
export class WebCaptureTarget extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Identity</span>')
  @ui.label(
    '<span style="color: #94A3B8; font-size: 11px;">How this object is named in the portal. Leave empty to use the SceneObject name.</span>'
  )
  @input
  @hint("Stable id, unique in the capture (max 80 characters). Empty = SceneObject name")
  targetId: string = ""

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Appearance in the portal</span>')
  @input
  @hint("Shape the portal draws. Auto: the mesh bounds, a text label or an empty marker")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Auto", "auto"),
      new ComboBoxItem("Box", "box"),
      new ComboBoxItem("Sphere", "sphere"),
      new ComboBoxItem("Cylinder", "cylinder"),
      new ComboBoxItem("Plane", "plane"),
      new ComboBoxItem("Text", "text"),
      new ComboBoxItem("Empty", "empty")
    ])
  )
  primitive: string = "auto"

  @input
  @widget(new ColorWidget())
  @hint("Colour in the portal. Read from the material when Use Material Color is on")
  color: vec4 = new vec4(0.55, 0.82, 0.78, 1)

  @input
  @hint("Read the colour from this object's material (mainPass.baseColor) every sample")
  useMaterialColor: boolean = true

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">What to record</span>')
  @input
  @hint("Record when the object is enabled or disabled")
  recordVisibility: boolean = true

  @input
  @hint("Record Text changes (when the object has a Text component)")
  recordText: boolean = true

  /** Every WebCaptureTarget in the scene, in creation order. */
  static readonly all: WebCaptureTarget[] = []

  onAwake(): void {
    WebCaptureTarget.all.push(this)
    this.createEvent("OnDestroyEvent").bind(() => {
      const i = WebCaptureTarget.all.indexOf(this)
      if (i >= 0) WebCaptureTarget.all.splice(i, 1)
    })
  }

  /** Id used in snapshots and recordings. */
  get captureId(): string {
    const id = this.targetId && this.targetId.trim().length > 0 ? this.targetId.trim() : this.getSceneObject().name
    return clampString(id, MAX_NAME_LENGTH)
  }

  describe(parent: string | null): CaptureObject {
    return describeObject(
      this.getSceneObject(),
      this.captureId,
      parent,
      this.primitive,
      this.color,
      this.useMaterialColor
    )
  }

  readParams(): CaptureParams {
    return readParams(this.getSceneObject(), this.useMaterialColor, this.recordVisibility, this.recordText)
  }
}

function colorOf(obj: SceneObject): number[] | null {
  const visual = obj.getComponent("Component.RenderMeshVisual")
  if (!visual) return null
  try {
    const material = visual.mainMaterial
    if (!material) return null
    const c = material.mainPass.baseColor as vec4
    if (!c) return null
    return [round(c.r, 3), round(c.g, 3), round(c.b, 3), round(c.a, 3)]
  } catch {
    return null // the material has no baseColor
  }
}

/** Builds the static description of an object. `primitive` "auto" guesses from the components. */
export function describeObject(
  obj: SceneObject,
  id: string,
  parent: string | null,
  primitive: string,
  fallbackColor: vec4,
  useMaterialColor: boolean = true
): CaptureObject {
  const visual = obj.getComponent("Component.RenderMeshVisual")
  const text = obj.getComponent("Component.Text")
  let shape: Primitive = "empty"
  if (primitive && primitive !== "auto" && PRIMITIVES.indexOf(primitive as Primitive) >= 0) {
    shape = primitive as Primitive
  } else if (visual && visual.mesh) {
    shape = "mesh"
  } else if (text) {
    shape = "text"
  }
  const desc: CaptureObject = {
    id: id,
    name: clampString(obj.name, MAX_NAME_LENGTH),
    parent: parent,
    primitive: shape,
    color: (useMaterialColor ? colorOf(obj) : null) || [
      round(fallbackColor.r, 3),
      round(fallbackColor.g, 3),
      round(fallbackColor.b, 3),
      round(fallbackColor.a, 3)
    ]
  }
  if (shape === "text" && text) desc.textSize = text.size
  if (visual && visual.mesh) {
    try {
      const min = visual.mesh.aabbMin
      const max = visual.mesh.aabbMax
      desc.bounds = [
        round(min.x, 3),
        round(min.y, 3),
        round(min.z, 3),
        round(max.x, 3),
        round(max.y, 3),
        round(max.z, 3)
      ]
      desc.mesh = clampString(visual.mesh.name, MAX_NAME_LENGTH)
    } catch {
      // some procedural meshes have no bounds yet
    }
  }
  if (text) desc.text = clampString(text.text, MAX_TEXT_LENGTH)
  return desc
}

export function readParams(
  obj: SceneObject,
  useMaterialColor: boolean,
  visibility: boolean,
  recordText: boolean
): CaptureParams {
  const params: CaptureParams = {}
  if (visibility) params.visible = obj.isEnabledInHierarchy
  if (useMaterialColor) {
    const c = colorOf(obj)
    if (c) params.color = c
  }
  if (recordText) {
    const text = obj.getComponent("Component.Text")
    if (text) params.text = clampString(text.text, MAX_TEXT_LENGTH)
  }
  return params
}
