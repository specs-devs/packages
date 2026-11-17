/**
 * SPECS Inc. 2027
 * Marks a SceneObject as streamed to ARKit Spectator phones and describes how the phone draws it:
 * a downloaded glTF/GLB model, or a coloured placeholder primitive. Optional custom JSON travels
 * with the pose for your own spectator logic.
 */
import {SpectatorClip, SpectatorPrimitive} from "./SpectatorProtocol"

@component
export class SpectatorEntity extends BaseScriptComponent {
  /** Every enabled SpectatorEntity in the Lens, in registration order. Read by ARKitSpectator. */
  static readonly all: SpectatorEntity[] = []

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Identity</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">How this object is named in the room. Leave empty to use the SceneObject name.</span>')
  @input
  @hint("Stable id, unique in the room (max 80 characters). Empty = SceneObject name")
  entityId: string = ""

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Appearance on the phone</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">A glTF/GLB URL, or a Snap Cloud Storage path such as models/robot.glb (public bucket). Without a model the phone draws the primitive.</span>')
  @input
  @hint("https://… .glb/.gltf URL, or <public bucket>/<path> in your Snap Cloud Storage")
  assetUrl: string = ""

  @input
  @hint("Placeholder shape when there is no model")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Box", "box"),
      new ComboBoxItem("Sphere", "sphere"),
      new ComboBoxItem("Cylinder", "cylinder"),
      new ComboBoxItem("Plane", "plane"),
      new ComboBoxItem("None", "none")
    ])
  )
  primitive: string = "box"

  @input
  @hint("Placeholder colour")
  @widget(new ColorWidget())
  color: vec4 = new vec4(0.55, 0.82, 0.78, 1)

  @input
  @hint("glTF animation clip to loop on the phone (empty = the model's default)")
  loopClip: string = ""

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Custom data</span>')
  @input
  @hint("Optional JSON object sent with this entity (max 2 KB). Change it at runtime with setData()")
  customJson: string = ""

  private customData: unknown = undefined
  private clip: SpectatorClip | undefined = undefined
  private clipCounter = 0

  onAwake(): void {
    if (this.customJson.trim().length > 0) {
      try {
        this.customData = JSON.parse(this.customJson)
      } catch (e) {
        print("SpectatorEntity (" + this.sceneObject.name + "): Custom Json is not valid JSON, ignored")
      }
    }
    if (this.loopClip.length > 0) this.clip = {name: this.loopClip, loop: true}
    // Disabled objects stay registered and are published as hidden (visible: false).
    this.createEvent("OnDestroyEvent").bind(() => this.unregister())
    this.register()
  }

  /** Id published for this entity. */
  get id(): string {
    return (this.entityId.length > 0 ? this.entityId : this.sceneObject.name).substring(0, 80)
  }

  /** Replaces the custom JSON published with this entity. */
  setData(data: unknown): void {
    this.customData = data
  }

  getData(): unknown {
    return this.customData
  }

  /** Plays a glTF clip on the phone. One-shot clips can be re-triggered by calling again. */
  playClip(name: string, loop: boolean = false): void {
    this.clipCounter++
    this.clip = loop ? {name, loop: true} : {name, loop: false, id: String(this.clipCounter)}
  }

  getClip(): SpectatorClip | undefined {
    return this.clip
  }

  getCustomData(): unknown {
    return this.customData
  }

  getPrimitive(): SpectatorPrimitive {
    return (["box", "sphere", "cylinder", "plane", "none"].indexOf(this.primitive) >= 0 ? this.primitive : "box") as SpectatorPrimitive
  }

  /** Colour as #RRGGBB, or #RRGGBBAA when not opaque. */
  getColorHex(): string {
    const hex = (v: number) => {
      const s = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16)
      return s.length === 1 ? "0" + s : s
    }
    const c = this.color
    return "#" + hex(c.r) + hex(c.g) + hex(c.b) + (c.a < 0.999 ? hex(c.a) : "")
  }

  private register(): void {
    if (SpectatorEntity.all.indexOf(this) < 0) SpectatorEntity.all.push(this)
  }

  private unregister(): void {
    const index = SpectatorEntity.all.indexOf(this)
    if (index >= 0) SpectatorEntity.all.splice(index, 1)
  }
}
