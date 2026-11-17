/**
 * One ball of a MetaballField. Put it on any SceneObject: the ball follows the object's world position, and
 * its radius is `radius` (cm), times the object's world scale when `scaleWithObject` is on. Disable the
 * component or the object to remove the ball; set `radius` to 0 to hide it without unregistering.
 */
import {MetaballField} from "./MetaballField"

@component
export class MetaballSource extends BaseScriptComponent {
  @input
  @allowUndefined
  @hint("Field this ball belongs to. Empty: the nearest MetaballField up the hierarchy, else the first field in the scene")
  field: MetaballField

  @input
  @hint("Ball radius in cm")
  @widget(new SliderWidget(0, 30, 0.1))
  radius: number = 3

  @input
  @hint("Multiply the radius by this object's world scale (x)")
  scaleWithObject: boolean = false

  private registeredWith: MetaballField | null = null
  private transform: Transform = this.getTransform()

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.register())
    this.createEvent("OnEnableEvent").bind(() => this.register())
    this.createEvent("OnDisableEvent").bind(() => this.unregister())
    this.createEvent("OnDestroyEvent").bind(() => this.unregister())
  }

  /** World-space centre of the ball. */
  getWorldPosition(): vec3 {
    return this.transform.getWorldPosition()
  }

  /** World-space radius of the ball in cm (0 = hidden). */
  getWorldRadius(): number {
    if (!this.enabled || !this.sceneObject.isEnabledInHierarchy) {
      return 0
    }
    return this.scaleWithObject ? this.radius * Math.abs(this.transform.getWorldScale().x) : this.radius
  }

  /** The field this ball is registered with, if any. */
  getField(): MetaballField | null {
    return this.registeredWith
  }

  /** Move this ball to another field at runtime. */
  setField(field: MetaballField | null): void {
    this.unregister()
    this.field = field
    this.register()
  }

  private register(): void {
    if (this.registeredWith) {
      return
    }
    const target = this.field ?? MetaballField.findFor(this.sceneObject)
    if (target) {
      target.addSource(this)
      this.registeredWith = target
    }
  }

  private unregister(): void {
    if (this.registeredWith) {
      this.registeredWith.removeSource(this)
      this.registeredWith = null
    }
  }
}
