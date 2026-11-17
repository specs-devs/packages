/**
 * Example only: a ring of orbs you can Pinch, drag and squash into each other — they melt where they touch.
 * Each orb is a SIK Interactable + InteractableManipulation (move only) with a sphere collider and a
 * MetaballSource. Hovered orbs swell a little; released orbs bob in place and, after `returnDelay`
 * seconds, drift back home on a soft spring.
 */
import {Interactable} from "InteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractableManipulation} from "InteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import {MetaballField} from "../../Scripts/MetaballField"
import {MetaballSource} from "../../Scripts/MetaballSource"

type Orb = {
  object: SceneObject
  transform: Transform
  source: MetaballSource
  home: vec3
  grabbed: boolean
  hovered: boolean
  releasedAt: number
  velocity: vec3
  phase: number
}

@component
export class PinchMerge extends BaseScriptComponent {
  @input
  @hint("Field the orbs belong to")
  field: MetaballField

  @input
  @hint("Number of orbs (max 8 per field)")
  @widget(new SliderWidget(1, 8, 1))
  count: number = 5

  @input
  @hint("Orb radius (cm)")
  radius: number = 3.2

  @input
  @hint("Radius of the ring the orbs start on (cm)")
  ringRadius: number = 9

  @input
  @hint("Seconds after release before an orb drifts back home (0 = never)")
  returnDelay: number = 2.5

  private orbs: Orb[] = []

  onAwake(): void {
    // SIK components must be created after OnStart.
    this.createEvent("OnStartEvent").bind(() => this.build())
    this.createEvent("UpdateEvent").bind(() => this.update())
  }

  /** Send every orb home now. */
  resetOrbs(): void {
    for (const orb of this.orbs) {
      orb.grabbed = false
      orb.releasedAt = -1e9
      orb.transform.setLocalPosition(orb.home)
      orb.velocity = vec3.zero()
    }
  }

  private build(): void {
    const n = Math.max(1, Math.min(8, Math.round(this.count)))
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / 2
      const home = new vec3(Math.cos(a) * this.ringRadius, Math.sin(a) * this.ringRadius * 0.6, 0)
      this.orbs.push(this.createOrb("Orb" + i, home, i))
    }
  }

  private createOrb(name: string, home: vec3, index: number): Orb {
    const object = global.scene.createSceneObject(name)
    object.setParent(this.sceneObject)
    const transform = object.getTransform()
    transform.setLocalPosition(home)

    // The collider must exist before the Interactable is created.
    const collider = object.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createSphereShape()
    shape.radius = this.radius * 1.15
    collider.shape = shape
    collider.fitVisual = false
    const interactable = object.createComponent(Interactable.getTypeName()) as Interactable
    const manipulation = object.createComponent(InteractableManipulation.getTypeName()) as InteractableManipulation
    manipulation.setCanRotate(false)
    manipulation.setCanScale(false)

    const source = object.createComponent(MetaballSource.getTypeName()) as MetaballSource
    source.field = this.field
    source.radius = this.radius

    const orb: Orb = {object, transform, source, home, grabbed: false, hovered: false, releasedAt: -1e9, velocity: vec3.zero(), phase: index * 1.7}
    interactable.onHoverEnter.add(() => (orb.hovered = true))
    interactable.onHoverExit.add(() => (orb.hovered = false))
    manipulation.onManipulationStart.add(() => {
      orb.grabbed = true
      orb.velocity = vec3.zero()
    })
    manipulation.onManipulationEnd.add(() => {
      orb.grabbed = false
      orb.releasedAt = getTime()
    })
    return orb
  }

  private update(): void {
    const t = getTime()
    const dt = Math.min(getDeltaTime(), 0.05)
    for (const orb of this.orbs) {
      const target = orb.hovered || orb.grabbed ? this.radius * 1.12 : this.radius
      orb.source.radius = MathUtils.lerp(orb.source.radius, target, Math.min(1, dt * 10))
      if (orb.grabbed) {
        continue
      }
      const sinceRelease = t - orb.releasedAt
      const pos = orb.transform.getLocalPosition()
      if (this.returnDelay > 0 && sinceRelease > this.returnDelay) {
        // Critically damped spring towards home (with a gentle bob).
        const bob = new vec3(0, Math.sin(t * 1.4 + orb.phase) * 0.6, 0)
        const toHome = orb.home.add(bob).sub(pos)
        const stiffness = 6
        orb.velocity = orb.velocity.add(toHome.uniformScale(stiffness * stiffness * dt)).uniformScale(Math.max(0, 1 - 2 * stiffness * dt))
        orb.transform.setLocalPosition(pos.add(orb.velocity.uniformScale(dt)))
      } else {
        // Freshly released: bob where it was dropped.
        orb.transform.setLocalPosition(pos.add(new vec3(0, Math.cos(t * 1.4 + orb.phase) * 0.6 * 1.4 * dt, 0)))
      }
    }
  }
}
