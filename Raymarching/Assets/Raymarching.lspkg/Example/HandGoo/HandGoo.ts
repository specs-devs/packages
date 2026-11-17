/**
 * Example only: your hands become goo. Thumb, index and middle fingertips plus the palm of each hand are
 * MetaballSources of one field, so fingers melt together when they touch and both hands merge when they
 * meet. Untracked hands drop out; with no hand tracked (e.g. the Lens Studio preview without hand
 * simulation) three idle balls orbit in front of this object so the step is never empty.
 */
import {HandInputData} from "InteractionKit.lspkg/Providers/HandInputData/HandInputData"
import TrackedHand from "InteractionKit.lspkg/Providers/HandInputData/TrackedHand"
import {MetaballField} from "../../Scripts/MetaballField"
import {MetaballSource} from "../../Scripts/MetaballSource"

type HandBalls = {hand: TrackedHand; thumb: MetaballSource; index: MetaballSource; middle: MetaballSource; palm: MetaballSource}

@component
export class HandGoo extends BaseScriptComponent {
  @input
  @hint("Field the hand balls belong to")
  field: MetaballField

  @input
  @hint("Fingertip ball radius (cm)")
  tipRadius: number = 1.6

  @input
  @hint("Palm ball radius (cm)")
  palmRadius: number = 3.4

  @input
  @hint("Radius of the idle balls shown when no hand is tracked (cm)")
  idleRadius: number = 3

  private hands: HandBalls[] = []
  private idle: MetaballSource[] = []
  private handsReady = false

  onAwake(): void {
    // SIK hand data must be read after OnStart.
    this.createEvent("OnStartEvent").bind(() => this.setup())
    this.createEvent("UpdateEvent").bind(() => this.update())
  }

  private setup(): void {
    const data = HandInputData.getInstance()
    for (const side of ["left", "right"] as const) {
      const hand = data.getHand(side)
      this.hands.push({
        hand,
        thumb: this.createBall(side + "Thumb", this.tipRadius),
        index: this.createBall(side + "Index", this.tipRadius),
        middle: this.createBall(side + "Middle", this.tipRadius),
        palm: this.createBall(side + "Palm", this.palmRadius)
      })
    }
    // The field holds 8 balls: the idle balls reuse the right hand's, so nothing is ever dropped.
    const right = this.hands[1]
    this.idle = [right.palm, right.index, right.middle]
    this.handsReady = true
  }

  private createBall(name: string, radius: number): MetaballSource {
    const o = global.scene.createSceneObject(name)
    o.setParent(this.sceneObject)
    const source = o.createComponent(MetaballSource.getTypeName()) as MetaballSource
    source.field = this.field
    source.radius = radius
    return source
  }

  private update(): void {
    if (!this.handsReady) {
      return
    }
    let anyTracked = false
    for (const h of this.hands) {
      if (h.hand.isTracked()) {
        anyTracked = true
        this.place(h.thumb, h.hand.thumbTip.position, this.tipRadius)
        this.place(h.index, h.hand.indexTip.position, this.tipRadius)
        this.place(h.middle, h.hand.middleTip.position, this.tipRadius)
        // Palm centre: between the wrist and the middle knuckle.
        this.place(h.palm, h.hand.wrist.position.add(h.hand.middleKnuckle.position).uniformScale(0.5), this.palmRadius)
      } else {
        h.thumb.radius = h.index.radius = h.middle.radius = h.palm.radius = 0
      }
    }
    if (!anyTracked) {
      this.idleOrbit()
    }
  }

  private place(source: MetaballSource, position: vec3, radius: number): void {
    source.getTransform().setWorldPosition(position)
    source.radius = radius
  }

  private idleOrbit(): void {
    const t = getTime()
    const origin = this.getTransform().getWorldPosition()
    for (let i = 0; i < this.idle.length; i++) {
      const a = t * 0.6 + (i * Math.PI * 2) / this.idle.length
      const offset = new vec3(Math.cos(a) * 5.5, Math.sin(a * 1.3 + i) * 2.5, Math.sin(a) * 3)
      this.place(this.idle[i], origin.add(offset), this.idleRadius * (1 + 0.15 * Math.sin(t * 1.7 + i * 2)))
    }
  }
}
