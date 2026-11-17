/**
 * Agnostic3DButton — one soft-press 3D button that works with ANY finger.
 *
 * Give it SceneObjects to treat as fingers (SIK index tips are added automatically when
 * `useSIKIndexTips` is on; a grabbed ball, a controller tip or any object with a transform works
 * too). Every frame each finger is moved into the button's local space and tested against a made-up
 * geometric volume (box or cylinder, see ButtonVolume.ts): no physics colliders, no helper vertices.
 * The deepest engaged finger drives `pressValue` (0..1); thresholds with hysteresis turn it into
 * press / release / click / toggle events. Inspired by the Essentials soft-press example.
 *
 * The visual is separate (Agnostic3DButtonVisual): this component never renders anything except
 * the optional debug wireframe.
 */
import Event from "InteractionKit.lspkg/Utils/Event"
import {HandInputData} from "InteractionKit.lspkg/Providers/HandInputData/HandInputData"
import {ButtonShape, isAboveTop, isInsideFootprint, isInVolume, pressAmount, VolumeSpec} from "./ButtonVolume"
import {buildVolumeWireframe} from "./ButtonMeshes"

/** A source of finger positions in world space; returns null while unavailable (e.g. hand not tracked). */
export type FingerSource = () => vec3 | null

@component
export class Agnostic3DButton extends BaseScriptComponent {
  @ui.label('<span style="color: #77CBC2;">Agnostic3DButton – soft press for any finger</span><br/><span style="color: #94A3B8; font-size: 11px;">Top face = local y 0, press direction = local -Y. Sizes in local units (cm at scale 1).</span>')
  @ui.separator
  @input
  @hint("Objects that can press the button (fingertips, a grabbed ball, a controller tip, …)")
  fingers: SceneObject[] = []

  @input
  @hint("Also use both SIK index fingertips (added at OnStart)")
  useSIKIndexTips: boolean = true

  @ui.separator
  @input
  @widget(new ComboBoxWidget([new ComboBoxItem("Box", 0), new ComboBoxItem("Cylinder", 1)]))
  @hint("Shape of the made-up volume")
  shape: number = ButtonShape.Cylinder

  @input
  @hint("Box: width (x) and depth (z). Cylinder: x = diameter")
  size: vec2 = new vec2(8, 8)

  @input
  @hint("How far the top can be pushed in (local -Y)")
  travel: number = 1.5

  @input
  @hint("Height above the top face where a finger counts as hovering")
  hoverHeight: number = 3

  @input
  @hint("Only start a press when the finger came in from above (no pressing from the side or below)")
  enterFromTopOnly: boolean = true

  @ui.separator
  @input
  @widget(new SliderWidget(0.05, 1, 0.01))
  @hint("Press value that fires onPressed")
  pressThreshold: number = 0.7

  @input
  @widget(new SliderWidget(0, 0.95, 0.01))
  @hint("Press value that fires onReleased / onClick (lower than pressThreshold = hysteresis)")
  releaseThreshold: number = 0.4

  @input
  @hint("How fast the button springs back when the finger leaves (1/s)")
  returnSpeed: number = 28

  @ui.separator
  @input
  @widget(new SliderWidget(0, 5, 0.1))
  @hint("While a pressing finger is below the top plane it stays engaged up to this far outside the footprint (and down to travel × 3)")
  holdMargin: number = 1.0

  @input
  @widget(new SliderWidget(0, 1, 0.01))
  @hint("After the pressing finger lifts off (comes back above releaseHeight), the press value holds this long (s) before it springs back. A lost or slid-off finger releases at once")
  releaseDelay: number = 0.12

  @input
  @widget(new SliderWidget(0, 2, 0.05))
  @hint("How far above the top plane a pressing finger must come back to count as gone (local units)")
  releaseHeight: number = 0.3

  @input
  @widget(new SliderWidget(0.1, 2, 0.05))
  @hint("Failsafe: with no finger driving the press for this long (s), the button springs back whatever else happens")
  maxHoldWithoutFinger: number = 0.5

  @input
  @hint("Latching toggle: every click flips isOn")
  toggle: boolean = false

  @input
  @hint("Disable to ignore every finger (the button springs back)")
  interactable: boolean = true

  @input
  @hint("Draw the volume as a wireframe (debug)")
  debugDraw: boolean = false

  @input
  @allowUndefined
  @hint("Material for the debug wireframe (unlit)")
  debugMaterial: Material

  /** Fired when a finger enters / leaves the hover band (or the press, if it never hovered). */
  readonly onHoverEnter = new Event<void>()
  readonly onHoverExit = new Event<void>()
  /** Fired when the press value leaves 0. */
  readonly onPressStart = new Event<void>()
  /** Fired every frame the press value changes, with the new value 0..1. */
  readonly onPressValue = new Event<number>()
  /** Fired when the press value crosses pressThreshold. */
  readonly onPressed = new Event<void>()
  /** Fired when the press value falls back under releaseThreshold after a press. */
  readonly onReleased = new Event<void>()
  /** Fired once per completed press (press then release). */
  readonly onClick = new Event<void>()
  /** Toggle mode only: fired with the new isOn value on every click. */
  readonly onToggle = new Event<boolean>()

  private sources: {key: SceneObject | null; get: FingerSource; engaged: boolean}[] = []
  private _pressValue = 0
  private _isPressed = false
  private _isHovered = false
  private _isOn = false
  private started = false
  private simulateUntil = -1
  private wasPressing = false
  // When the pressing finger lifted off (-1: none), and when a finger last drove the press.
  private liftedAt = -1
  private drivenAt = -1

  get pressValue(): number {
    return this._pressValue
  }
  get isPressed(): boolean {
    return this._isPressed
  }
  get isHovered(): boolean {
    return this._isHovered
  }
  get isOn(): boolean {
    return this._isOn
  }

  /** Current volume description (read by the visual). */
  get volume(): VolumeSpec {
    return {shape: this.shape as ButtonShape, size: this.size, travel: this.travel, hoverHeight: this.hoverHeight}
  }

  onAwake(): void {
    // Undefined on a button created with createComponent (inputs aren't serialized yet).
    for (const f of this.fingers ?? []) this.addFinger(f)
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.update())
  }

  private onStart(): void {
    if (this.started) return
    this.started = true
    if (this.useSIKIndexTips) this.addSIKIndexTips()
    if (this.debugDraw) buildVolumeWireframe(this.sceneObject, this.volume, this.debugMaterial)
  }

  /** Add any SceneObject as a finger. */
  addFinger(finger: SceneObject): void {
    if (!finger || this.sources.some((s) => s.key === finger)) return
    this.sources.push({
      key: finger,
      get: () => (isNull(finger) || !finger.isEnabledInHierarchy ? null : finger.getTransform().getWorldPosition()),
      engaged: false,
    })
  }

  removeFinger(finger: SceneObject): void {
    this.sources = this.sources.filter((s) => s.key !== finger)
  }

  /** Add a custom finger position source (world space). */
  addFingerSource(get: FingerSource): void {
    this.sources.push({key: null, get, engaged: false})
  }

  /**
   * The finger nearest the top face (the deepest one) that is inside the footprint (+ `margin`) and at
   * most `maxHeight` above the top, in the button's local space; null when there is none. Read-only
   * (for visuals such as the finger shadow); it doesn't change the press.
   */
  closestFinger(maxHeight: number, margin: number = 0): vec3 | null {
    const inverse = this.sceneObject.getTransform().getInvertedWorldTransform()
    const spec = this.volume
    let best: vec3 | null = null
    for (const s of this.sources) {
      const world = s.get()
      if (!world) continue
      const local = inverse.multiplyPoint(world)
      if (local.y > maxHeight || local.y < -spec.travel * 3) continue
      if (!isInsideFootprint(spec, local, margin)) continue
      if (!best || local.y < best.y) best = local
    }
    return best
  }

  /** Set the toggle state without a click (fires onToggle when it changes). */
  setOn(on: boolean): void {
    if (this._isOn === on) return
    this._isOn = on
    this.onToggle.invoke(on)
  }

  /** Simulate a full press and release (editor, tests, keyboard shortcuts). */
  simulatePress(seconds: number = 0.18): void {
    this.simulateUntil = getTime() + seconds
  }

  private addSIKIndexTips(): void {
    const data = HandInputData.getInstance()
    for (const side of ["left", "right"] as const) {
      const hand = data.getHand(side)
      this.addFingerSource(() => (hand.isTracked() && hand.indexTip ? hand.indexTip.position : null))
    }
  }

  private update(): void {
    // Buttons created from code after the scene started may miss OnStart: start on the first update.
    if (!this.started) this.onStart()
    const target = this.interactable ? this.measure() : {depth: 0, hover: false, pressing: false, near: false, lost: false}
    let depth = target.depth
    const now = getTime()
    // Stay down a little longer, never stuck: the value holds while the pressing finger is just above the
    // top (within releaseHeight) and for releaseDelay after it lifts off, but never longer than
    // maxHoldWithoutFinger after a finger last pushed it. A lost or slid-off finger releases at once.
    if (target.pressing) {
      this.drivenAt = now
      this.liftedAt = -1
    } else if (target.near) {
      this.liftedAt = -1
    } else if (this.wasPressing) {
      this.liftedAt = target.lost ? -1 : now
    }
    this.wasPressing = target.pressing || target.near
    const lifting = this.liftedAt >= 0 && now - this.liftedAt < this.releaseDelay
    const holding = (target.near || lifting) && now - this.drivenAt < this.maxHoldWithoutFinger
    if (holding) depth = Math.max(depth, this._pressValue)
    if (now < this.simulateUntil) depth = 1

    const dt = Math.max(getDeltaTime(), 0)
    const previous = this._pressValue
    if (depth >= this._pressValue) {
      // The finger pushes the cap directly, the same frame.
      this._pressValue = depth
    } else {
      // Spring back toward the finger (or the rest position).
      this._pressValue = depth + (this._pressValue - depth) * Math.exp(-this.returnSpeed * dt)
      if (this._pressValue < 0.002) this._pressValue = 0
    }

    const hovered = target.hover || this._pressValue > 0
    if (hovered !== this._isHovered) {
      this._isHovered = hovered
      ;(hovered ? this.onHoverEnter : this.onHoverExit).invoke()
    }
    if (previous === 0 && this._pressValue > 0) this.onPressStart.invoke()
    if (Math.abs(this._pressValue - previous) > 0.0005) this.onPressValue.invoke(this._pressValue)

    if (!this._isPressed && this._pressValue >= this.pressThreshold) {
      this._isPressed = true
      this.onPressed.invoke()
    } else if (this._isPressed && this._pressValue <= Math.min(this.releaseThreshold, this.pressThreshold - 0.01)) {
      this._isPressed = false
      this.onReleased.invoke()
      this.onClick.invoke()
      if (this.toggle) this.setOn(!this._isOn)
    }
  }

  /**
   * Deepest press of any engaged finger, whether any finger hovers, whether a finger is pressing
   * (engaged, below the top), near (just above the top, within releaseHeight, while pressed), and whether an engaged finger was lost this frame (untracked,
   * invalid, or out of the hold region) rather than lifted off.
   */
  private measure(): {depth: number; hover: boolean; pressing: boolean; near: boolean; lost: boolean} {
    const inverse = this.sceneObject.getTransform().getInvertedWorldTransform()
    const spec = this.volume
    let depth = 0
    let hover = false
    let pressing = false
    let near = false
    let lost = false
    for (const s of this.sources) {
      const world = s.get()
      if (!world || isNaN(world.x) || isNaN(world.y) || isNaN(world.z)) {
        if (s.engaged) lost = true
        s.engaged = false
        continue
      }
      const local = inverse.multiplyPoint(world)
      // An engaged finger that hasn't come back above releaseHeight keeps the press even if it drifts
      // sideways (holdMargin) or deeper than the volume (down to travel × 3).
      const held =
        s.engaged &&
        local.y < this.releaseHeight &&
        local.y >= -spec.travel * 3 &&
        isInsideFootprint(spec, local, this.holdMargin)
      if (!held && !isInVolume(spec, local)) {
        if (s.engaged) lost = true
        s.engaged = false
        continue
      }
      if (!s.engaged) {
        // A finger engages when it enters from above (or anywhere, if enterFromTopOnly is off).
        if (this.enterFromTopOnly && !isAboveTop(spec, local)) continue
        s.engaged = true
      }
      if (local.y >= 0) hover = true
      if (local.y < 0) pressing = true
      else if (local.y < this.releaseHeight && this._pressValue > 0) near = true
      depth = Math.max(depth, pressAmount(spec, local))
    }
    return {depth, hover, pressing, near, lost}
  }
}
