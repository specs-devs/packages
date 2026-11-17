import {InteractableManipulation} from "InteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import {SpringAnimate} from "InteractionKit.lspkg/Utils/springAnimate"

/**
 * Makes a row of crystals follow whichever one you drag, in a line behind it.
 *
 * Every crystal is interactive (Interactable + InteractableManipulation). The
 * one you grab leads, and the rest line up behind it in order of distance from
 * it, nearest first.
 *
 * Each crystal hangs on a rope from the crystal in front of it. A rope starts as
 * long as the gap it spans, and as you drag the ropes are reeled in toward
 * `spacing`, nearest the lead first. A crystal only moves when its rope is pulled
 * tight, so crystals join the line one after another and the far ones wait until
 * the rope reaches them. Each crystal springs toward its spot on the rope (IK's
 * SpringAnimate), measured from where the crystal in front is now, so lag builds
 * up along the line.
 */
@component
export class CrystalChain extends BaseScriptComponent {
  // Every crystal's InteractableManipulation. The first one leads at the start.
  @input
  crystals: InteractableManipulation[] = []

  // Distance between crystals once the line has formed, in cm.
  @input
  spacing: number = 6

  // How many cm of rope are reeled in for each cm the lead moves.
  @input
  reelSpeed: number = 2

  // How long each crystal's spring takes to settle, in seconds.
  @input
  springDuration: number = 0.3

  // Crystal indices in line order, the lead first.
  private order: number[] = []
  // Each crystal's spot on its rope, by crystal index. The lead's is where it was last frame.
  private spots: vec3[] = []
  // Length of the rope from the crystal in front, by crystal index.
  private ropes: number[] = []
  private homePositions: vec3[] = []
  private springs: SpringAnimate[] = []

  onAwake(): void {
    this.springs = this.crystals.map(() => SpringAnimate.smooth(this.springDuration))
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    // LateUpdate runs after InteractableManipulation has moved the lead this frame.
    this.createEvent("LateUpdateEvent").bind(() => this.onLateUpdate())
  }

  /** Sends every crystal back to where it started, with the first one leading again. */
  regroup(): void {
    this.crystals.forEach((crystal, i) => this.transformOf(i).setWorldPosition(this.homePositions[i]))
    this.setLead(0)
    this.layOut()
  }

  /** Changes how long each crystal takes to settle into its spot, in seconds. */
  setSpringDuration(duration: number): void {
    this.springDuration = duration
    this.springs.forEach((spring) => spring.setDurationSmooth(duration))
  }

  /** Lines the crystals up exactly `spacing` apart, for example after the spacing changes. */
  layOut(): void {
    this.forEachLink((crystal, front) => {
      this.ropes[crystal] = this.spacing
      this.spots[crystal] = this.onRope(crystal, front)
    })
  }

  private onStart(): void {
    this.homePositions = this.crystals.map((crystal, i) => this.positionOf(i))
    this.setLead(0)

    this.crystals.forEach((crystal, i) => {
      crystal.onManipulationStart.add(() => this.setLead(i))
    })
  }

  // Makes `lead` lead, lines the others up by distance from it, and ties each one to
  // the crystal in front with a rope as long as the gap between them (at least `spacing`).
  private setLead(lead: number): void {
    this.spots = this.crystals.map((crystal, i) => this.positionOf(i))
    this.springs.forEach((spring) => spring.reset())
    const distance = (i: number) => this.spots[i].distance(this.spots[lead])
    this.order = this.crystals.map((crystal, i) => i).sort((a, b) => distance(a) - distance(b))
    this.forEachLink((crystal, front) => {
      this.ropes[crystal] = Math.max(this.spacing, this.spots[crystal].distance(this.spots[front]))
    })
  }

  private onLateUpdate(): void {
    const lead = this.order[0]
    const moved = this.positionOf(lead).distance(this.spots[lead])
    if (moved > 0) {
      this.spots[lead] = this.positionOf(lead)
      this.reelIn(moved * this.reelSpeed)
    }
    this.springCrystals()
  }

  // Reels in `amount` cm of rope, nearest the lead first: each rope shortens down to
  // `spacing` before the next one starts. A crystal whose rope is tight is pulled along it.
  private reelIn(amount: number): void {
    let left = amount
    this.forEachLink((crystal, front) => {
      const reeled = Math.min(left, this.ropes[crystal] - this.spacing)
      this.ropes[crystal] -= reeled
      left -= reeled
      if (this.spots[crystal].distance(this.spots[front]) > this.ropes[crystal]) {
        this.spots[crystal] = this.onRope(crystal, front)
      }
    })
  }

  // Springs each crystal toward its spot, measured from where the crystal in front is
  // now, so each one trails the one ahead. Settled crystals are skipped, because every
  // transform write also updates the crystal's collider.
  private springCrystals(): void {
    this.forEachLink((crystal, front) => {
      const position = this.positionOf(crystal)
      const target = this.positionOf(front).add(this.spots[crystal].sub(this.spots[front]))
      if (this.springs[crystal].isSettled(position, target)) {
        return
      }
      this.transformOf(crystal).setWorldPosition(this.springs[crystal].evaluate(position, target))
    })
  }

  // The point a full rope's length from the crystal in front, toward `crystal`'s spot.
  private onRope(crystal: number, front: number): vec3 {
    const away = this.spots[crystal].sub(this.spots[front])
    // Two crystals in exactly the same spot have no direction between them; pick one.
    const direction = away.length > 0 ? away.normalize() : vec3.up()
    return this.spots[front].add(direction.uniformScale(this.ropes[crystal]))
  }

  // Calls `fn` for every crystal after the lead, with the crystal in front of it.
  private forEachLink(fn: (crystal: number, front: number) => void): void {
    for (let k = 1; k < this.order.length; k++) {
      fn(this.order[k], this.order[k - 1])
    }
  }

  private positionOf(index: number): vec3 {
    return this.transformOf(index).getWorldPosition()
  }

  private transformOf(index: number): Transform {
    return this.crystals[index].getSceneObject().getTransform()
  }
}
