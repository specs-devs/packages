// Preload ThemeService before any UIKit visual to break a circular-import init-order
// crash in the package (Visual.ts imports ThemeService before defining COLORS, and the
// theme chain reads COLORS at module-load). Entering the import cycle via ThemeService
// lets Visual.ts finish defining COLORS first. Must remain the FIRST import.
import "SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService"
/**
 * InteractionModesManager
 *
 * 4 rectangle buttons toggle modes independently — any combination is allowed:
 *   – Scale with Pinch
 *   – Scale with Hand Distance
 *   – Rotate with Pinch
 *   – Rotate with Hand Distance
 *
 * Cubes are hidden until at least one mode is active; disabled again when all
 * modes are deselected.
 *
 * INPUT CHANNELS
 * ─────────────
 * Pinch channel  (0 = open, 1 = closed):
 *   Production → thumb-tip to index-tip distance on the selected hand (via SIK).
 *                Normalised with distancePinchMin / distancePinchMax:
 *                  distance ≤ min → 1 (fully pinched)
 *                  distance ≥ max → 0 (fully open)
 *   Test       → Y-axis separation of mockPinchA / mockPinchB, same normalisation.
 *
 * Hand-distance channel (0 = close, 1 = far):
 *   Production → wrist-to-wrist distance of both tracked hands (via SIK).
 *                Normalised with distanceHandMin / distanceHandMax.
 *   Test       → X-axis separation of mockHandA / mockHandB, same normalisation.
 *
 * TEST MODE — two independent mock pairs
 * ───────────────────────────────────────
 *   mockHandA / mockHandB   → simulate left and right hands.
 *                              Animate ONLY on the X-axis (horizontal).
 *                              Input = raw 0-1 wave (not derived from world positions).
 *                              Mock movement is visual only; amplitude = testHandAmplitude.
 *   mockPinchA / mockPinchB → simulate thumb tip and index tip.
 *                              Animate ONLY on the Y-axis (vertical).
 *                              Input = raw 0-1 wave. Mock movement is visual only.
 *                              Objects spread when pinch = 0 (open), together when pinch = 1.
 *
 * IMPORTANT: Disable testMode before building to device.
 */

import { SIK } from "SpectaclesInteractionKit.lspkg/SIK"
import { RectangleButton } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/RectangleButton"
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger"
import { bindStartEvent, bindUpdateEvent } from "SnapDecorators.lspkg/decorators"

// ── Mode identifiers ──────────────────────────────────────────────────────────
enum InteractionMode {
  ScaleWithPinch     = "ScaleWithPinch",
  ScaleWithHandDist  = "ScaleWithHandDist",
  RotateWithPinch    = "RotateWithPinch",
  RotateWithHandDist = "RotateWithHandDist",
}

const MODE_LABELS: Record<InteractionMode, string> = {
  [InteractionMode.ScaleWithPinch]:     "Scale × Pinch",
  [InteractionMode.ScaleWithHandDist]:  "Scale × Hand Dist",
  [InteractionMode.RotateWithPinch]:    "Rotate × Pinch",
  [InteractionMode.RotateWithHandDist]: "Rotate × Hand Dist",
}

const MODE_ORDER: InteractionMode[] = [
  InteractionMode.ScaleWithPinch,
  InteractionMode.ScaleWithHandDist,
  InteractionMode.RotateWithPinch,
  InteractionMode.RotateWithHandDist,
]

function vec3Dist(a: vec3, b: vec3): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function avg(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length
}

@component
export class InteractionModesManager extends BaseScriptComponent {

  @ui.label('<span style="color: #60A5FA;">InteractionModesManager</span><br/><span style="color: #94A3B8; font-size: 11px;">Buttons toggle modes — any combination is allowed. Cubes appear only when a mode is active. In production hands are resolved via SIK automatically. Disable testMode before building to device.</span>')
  @ui.separator

  // ── Status text ───────────────────────────────────────────────────────────
  @ui.group_start("Status")
  @input
  @hint("Text component that displays active modes and live channel values")
  @allowUndefined
  statusText: Text | null = null
  @ui.group_end

  // ── Test mode: global toggle ──────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Test Mode")
  @input
  @hint("Enable editor simulation with mock objects. Disable before building to device.")
  testMode: boolean = true
  @ui.group_end

  // ── Test mode: hand simulation ────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Test Mode: Hands  (simulate left / right wrist separation, X-axis only)")
  @input
  @hint("Simulates the left hand. Animates LEFT along its X-axis.")
  @allowUndefined
  mockHandA: SceneObject | null = null

  @input
  @hint("Simulates the right hand. Animates RIGHT along its X-axis.")
  @allowUndefined
  mockHandB: SceneObject | null = null

  @input("number", "0.35")
  @hint("Oscillation frequency (cycles/sec) for the hand mock")
  testHandSpeed: number = 0.35

  @input("number", "2.5")
  @hint("Visual half-amplitude (cm) each hand mock travels. Purely cosmetic — the actual input is always a 0-1 wave and is NOT derived from world positions, so this does not need to match distanceHandMin/Max.")
  testHandAmplitude: number = 2.5
  @ui.group_end

  // ── Test mode: pinch simulation ───────────────────────────────────────────
  @ui.separator
  @ui.group_start("Test Mode: Pinch  (simulate thumb / index tip separation, Y-axis only)")
  @input
  @hint("Simulates the thumb tip. Spreads DOWN (away from mockPinchB) when pinch = 0 (open).")
  @allowUndefined
  mockPinchA: SceneObject | null = null

  @input
  @hint("Simulates the index tip. Spreads UP (away from mockPinchA) when pinch = 0 (open). Both return to rest when pinch = 1 (closed).")
  @allowUndefined
  mockPinchB: SceneObject | null = null

  @input("number", "0.5")
  @hint("Oscillation frequency (cycles/sec) for the pinch mock")
  testPinchSpeed: number = 0.5

  @input("number", "2.5")
  @hint("Visual half-amplitude (cm) each pinch mock travels. Purely cosmetic — actual input is always 0-1.")
  testPinchAmplitude: number = 2.5
  @ui.group_end

  // ── Pinch channel settings ────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Pinch Channel")
  @input
  @hint("Use right hand for pinch (false = left hand)")
  usePinchRightHand: boolean = true

  @input("number", "0.5")
  @hint("Thumb-to-index distance (cm) → pinch = 1 (fully closed). Distances ≤ this clamp to 1.")
  distancePinchMin: number = 0.5

  @input("number", "5.0")
  @hint("Thumb-to-index distance (cm) → pinch = 0 (fully open). Distances ≥ this clamp to 0.")
  distancePinchMax: number = 5.0
  @ui.group_end

  // ── Hand-distance channel settings ───────────────────────────────────────
  @ui.separator
  @ui.group_start("Hand Distance Channel")
  @input("number", "10.0")
  @hint("Wrist-to-wrist distance (cm) mapped to hand-dist = 0 (hands close)")
  distanceHandMin: number = 10.0

  @input("number", "60.0")
  @hint("Wrist-to-wrist distance (cm) mapped to hand-dist = 1 (hands far apart)")
  distanceHandMax: number = 60.0
  @ui.group_end

  // ── Mode buttons ──────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Mode Buttons — each toggles on/off independently")
  @input
  @hint("Toggle Scale with Pinch")
  @allowUndefined
  scalePinchButton: RectangleButton | null = null

  @input
  @hint("Toggle Scale with Hand Distance")
  @allowUndefined
  scaleHandDistButton: RectangleButton | null = null

  @input
  @hint("Toggle Rotate with Pinch")
  @allowUndefined
  rotatePinchButton: RectangleButton | null = null

  @input
  @hint("Toggle Rotate with Hand Distance")
  @allowUndefined
  rotateHandDistButton: RectangleButton | null = null
  @ui.group_end

  // ── Cube spawning ─────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Cubes")
  @input
  @hint("Prefab to instantiate. Cubes start hidden and appear when a mode is activated.")
  @allowUndefined
  cubePrefab: ObjectPrefab | null = null

  @input("number", "5")
  @hint("Number of cubes in the row")
  cubeCount: number = 5

  @input("number", "7.0")
  @hint("Centre-to-centre spacing (cm)")
  cubeSpacing: number = 7.0
  @ui.group_end

  // ── Effect parameters ─────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Scale Effect")
  @input("number", "0.4")
  @hint("Scale value at input = 0 (shared by both scale modes)")
  scaleAtZero: number = 0.4

  @input("number", "2.0")
  @hint("Scale value at input = 1 (shared by both scale modes)")
  scaleAtOne: number = 2.0

  @input("vec3", "{0.0, 1.0, 0.0}")
  @hint("Which axes the Pinch scale affects. (0,1,0) = Y only, (1,1,1) = uniform. Each component is a 0-1 weight.")
  scalePinchAxes: vec3 = new vec3(0, 1, 0)

  @input("vec3", "{1.0, 0.0, 0.0}")
  @hint("Which axes the Hand Distance scale affects. (1,0,0) = X only, (1,1,1) = uniform.")
  scaleHandDistAxes: vec3 = new vec3(1, 0, 0)
  @ui.group_end

  @ui.group_start("Rotation Effect")
  @input("number", "0")
  @hint("Rotation (degrees) at input = 0 (shared by both rotation modes)")
  rotationAtZero: number = 0

  @input("number", "360")
  @hint("Rotation (degrees) at input = 1 (shared by both rotation modes)")
  rotationAtOne: number = 360

  @input("vec3", "{1.0, 0.0, 0.0}")
  @hint("World axis the Pinch rotation spins around. Default (1,0,0) = X (tilt forward/back).")
  rotatePinchAxis: vec3 = new vec3(1, 0, 0)

  @input("vec3", "{0.0, 1.0, 0.0}")
  @hint("World axis the Hand Distance rotation spins around. Default (0,1,0) = Y (spin left/right).")
  rotateHandDistAxis: vec3 = new vec3(0, 1, 0)
  @ui.group_end

  @ui.group_start("Smoothing")
  @input("number", "7.0")
  @hint("How fast cubes follow input — higher = snappier")
  smoothSpeed: number = 7.0
  @ui.group_end

  // ── Logging ───────────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Logging")
  @input
  enableLogging: boolean = false
  @ui.group_end

  // ── Private state ─────────────────────────────────────────────────────────
  private activeModes: Set<InteractionMode> = new Set()
  private cubeInstances: SceneObject[] = []

  private smoothedPinch: number    = 0
  private smoothedHandDist: number = 0

  private elapsedTime: number = 0

  // Captured rest positions for each mock pair
  private restHandA: vec3  = vec3.zero()
  private restHandB: vec3  = vec3.zero()
  private restPinchA: vec3 = vec3.zero()
  private restPinchB: vec3 = vec3.zero()

  // SIK hand references (set once on start)
  private leftTrackedHand:  any = null
  private rightTrackedHand: any = null

  private logger: Logger

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onAwake(): void {
    this.logger = new Logger("InteractionModesManager", this.enableLogging, true)
  }

  @bindStartEvent
  onStart(): void {
    this.spawnCubes()
    this.wireButtons()
    this.captureRestPositions()
    this.applyTestModeVisibility()
    if (!this.testMode) this.setupHandTracking()
    this.refreshStatusText()
  }

  @bindUpdateEvent
  onUpdate(): void {
    const dt = getDeltaTime()
    this.elapsedTime += dt

    if (this.testMode) {
      this.animateHandMocks()
      this.animatePinchMocks()
    }

    const rawPinch    = this.testMode ? this.sampleTestPinch()    : this.sampleProductionPinch()
    const rawHandDist = this.testMode ? this.sampleTestHandDist() : this.sampleProductionHandDist()

    const alpha = Math.min(1.0, this.smoothSpeed * dt)
    this.smoothedPinch    += (rawPinch    - this.smoothedPinch)    * alpha
    this.smoothedHandDist += (rawHandDist - this.smoothedHandDist) * alpha

    if (this.activeModes.size > 0) {
      this.applyToCubes(this.smoothedPinch, this.smoothedHandDist)
    }

    this.refreshStatusText()
  }

  // ── Setup ─────────────────────────────────────────────────────────────────

  private spawnCubes(): void {
    if (!this.cubePrefab) { this.logger.debug("cubePrefab not assigned"); return }
    const half = (this.cubeCount - 1) * 0.5 * this.cubeSpacing
    for (let i = 0; i < this.cubeCount; i++) {
      const inst = this.cubePrefab.instantiate(this.sceneObject)
      inst.getTransform().setLocalPosition(new vec3(-half + i * this.cubeSpacing, 0, 0))
      inst.enabled = false   // hidden until a mode is activated
      this.cubeInstances.push(inst)
    }
    this.logger.debug("Spawned " + this.cubeInstances.length + " cubes (hidden)")
  }

  private wireButtons(): void {
    if (this.scalePinchButton)     this.scalePinchButton.onTriggerUp.add(()     => this.toggleMode(InteractionMode.ScaleWithPinch))
    if (this.scaleHandDistButton)  this.scaleHandDistButton.onTriggerUp.add(()  => this.toggleMode(InteractionMode.ScaleWithHandDist))
    if (this.rotatePinchButton)    this.rotatePinchButton.onTriggerUp.add(()    => this.toggleMode(InteractionMode.RotateWithPinch))
    if (this.rotateHandDistButton) this.rotateHandDistButton.onTriggerUp.add(() => this.toggleMode(InteractionMode.RotateWithHandDist))
  }

  private captureRestPositions(): void {
    if (this.mockHandA)  { const p = this.mockHandA.getTransform().getLocalPosition();  this.restHandA  = new vec3(p.x, p.y, p.z) }
    if (this.mockHandB)  { const p = this.mockHandB.getTransform().getLocalPosition();  this.restHandB  = new vec3(p.x, p.y, p.z) }
    if (this.mockPinchA) { const p = this.mockPinchA.getTransform().getLocalPosition(); this.restPinchA = new vec3(p.x, p.y, p.z) }
    if (this.mockPinchB) { const p = this.mockPinchB.getTransform().getLocalPosition(); this.restPinchB = new vec3(p.x, p.y, p.z) }
  }

  private applyTestModeVisibility(): void {
    const mocks = [this.mockHandA, this.mockHandB, this.mockPinchA, this.mockPinchB]
    for (const obj of mocks) {
      if (obj) obj.enabled = this.testMode
    }
  }

  private setupHandTracking(): void {
    try {
      const handInputData = SIK.HandInputData
      this.leftTrackedHand  = handInputData.getHand("left")
      this.rightTrackedHand = handInputData.getHand("right")
      this.logger.debug("SIK.HandInputData wired")
    } catch (e) {
      this.logger.debug("SIK.HandInputData unavailable: " + e)
    }
  }

  // ── Mode toggling ─────────────────────────────────────────────────────────

  private toggleMode(mode: InteractionMode): void {
    if (this.activeModes.has(mode)) {
      this.activeModes.delete(mode)
      this.logger.debug("OFF: " + mode)
    } else {
      this.activeModes.add(mode)
      this.logger.debug("ON:  " + mode)
    }
    this.setCubesVisible(this.activeModes.size > 0)
    this.refreshStatusText()
  }

  // ── Cube visibility ───────────────────────────────────────────────────────

  private setCubesVisible(visible: boolean): void {
    for (const cube of this.cubeInstances) cube.enabled = visible
  }

  // ── Status text ───────────────────────────────────────────────────────────

  private refreshStatusText(): void {
    if (!this.statusText) return
    if (this.activeModes.size === 0) {
      this.statusText.text = "No modes active\nTap a button to start"
      return
    }
    const lines: string[] = []
    for (const mode of MODE_ORDER) {
      if (!this.activeModes.has(mode)) continue
      const isPinch = mode === InteractionMode.ScaleWithPinch || mode === InteractionMode.RotateWithPinch
      const val = isPinch ? this.smoothedPinch : this.smoothedHandDist
      lines.push("• " + MODE_LABELS[mode] + "  [" + Math.round(val * 100) + "%]")
    }
    this.statusText.text = lines.join("\n")
  }

  // ── Mock animation ────────────────────────────────────────────────────────

  /**
   * Hand mocks: slide APART on X as wave → 1 (hands far), together as wave → 0.
   * Visual only — input is the same wave read directly, not from these positions.
   */
  private animateHandMocks(): void {
    if (!this.mockHandA || !this.mockHandB) return
    const dispX = this.absWave(this.testHandSpeed, 0) * this.testHandAmplitude
    this.mockHandA.getTransform().setLocalPosition(new vec3(this.restHandA.x - dispX,  this.restHandA.y,  this.restHandA.z))
    this.mockHandB.getTransform().setLocalPosition(new vec3(this.restHandB.x + dispX,  this.restHandB.y,  this.restHandB.z))
  }

  /**
   * Pinch mocks: spread APART on Y as wave → 0 (open), together at rest as wave → 1 (closed).
   * Inverted so the visual matches the semantic: resting = pinched, spread = open.
   * Visual only — input is the same wave read directly, not from these positions.
   */
  private animatePinchMocks(): void {
    if (!this.mockPinchA || !this.mockPinchB) return
    const wave = this.absWave(this.testPinchSpeed, 0)
    const dispY = (1 - wave) * this.testPinchAmplitude   // 0 when pinched (1), max when open (0)
    this.mockPinchA.getTransform().setLocalPosition(new vec3(this.restPinchA.x, this.restPinchA.y - dispY, this.restPinchA.z))
    this.mockPinchB.getTransform().setLocalPosition(new vec3(this.restPinchB.x, this.restPinchB.y + dispY, this.restPinchB.z))
  }

  /** abs(sin) — smooth 0→1→0 oscillation without sign changes. */
  private absWave(freq: number, phaseRad: number): number {
    return Math.abs(Math.sin(this.elapsedTime * freq * Math.PI + phaseRad))
  }

  // ── Input sampling: pinch channel ─────────────────────────────────────────

  private sampleTestPinch(): number {
    // Input = raw wave, always 0-1. Mock positions are visual only (not read back).
    return this.absWave(this.testPinchSpeed, 0)
  }

  private sampleProductionPinch(): number {
    const hand = this.usePinchRightHand ? this.rightTrackedHand : this.leftTrackedHand
    if (!hand || !hand.isTracked()) return 0
    const thumbPos = hand.thumbTip?.position  as vec3 | null
    const indexPos = hand.indexTip?.position  as vec3 | null
    if (!thumbPos || !indexPos) return 0
    return this.normalisePinch(vec3Dist(thumbPos, indexPos))
  }

  /** Close = 1, open = 0. Inverts the normalised distance. */
  private normalisePinch(dist: number): number {
    const range = Math.max(0.001, this.distancePinchMax - this.distancePinchMin)
    return clamp01(1 - (dist - this.distancePinchMin) / range)
  }

  // ── Input sampling: hand-distance channel ─────────────────────────────────

  private sampleTestHandDist(): number {
    // Input = raw wave, always 0-1. Mock positions are visual only (not read back).
    return this.absWave(this.testHandSpeed, 0)
  }

  private sampleProductionHandDist(): number {
    if (!this.leftTrackedHand || !this.rightTrackedHand) return 0
    if (!this.leftTrackedHand.isTracked() || !this.rightTrackedHand.isTracked()) return 0
    const leftPos  = this.leftTrackedHand.wrist?.position  as vec3 | null
    const rightPos = this.rightTrackedHand.wrist?.position as vec3 | null
    if (!leftPos || !rightPos) return 0
    return this.normaliseHandDist(vec3Dist(leftPos, rightPos))
  }

  /** Close = 0, far = 1. */
  private normaliseHandDist(dist: number): number {
    const range = Math.max(0.001, this.distanceHandMax - this.distanceHandMin)
    return clamp01((dist - this.distanceHandMin) / range)
  }

  // ── Cube effect ───────────────────────────────────────────────────────────

  /**
   * Scale: each active mode contributes multiplicatively to its own axes.
   *   e.g. Pinch → Y, HandDist → X  →  finalScale = (sHand, sPinch, 1)
   * Rotation: each active mode rotates around its own axis; rotations are composed.
   *   e.g. Pinch → X-axis spin, HandDist → Y-axis spin  →  both applied simultaneously.
   */
  private applyToCubes(pinchT: number, handDistT: number): void {
    const DEG = Math.PI / 180.0

    const hasPinchScale    = this.activeModes.has(InteractionMode.ScaleWithPinch)
    const hasHandDistScale = this.activeModes.has(InteractionMode.ScaleWithHandDist)
    const hasPinchRot      = this.activeModes.has(InteractionMode.RotateWithPinch)
    const hasHandDistRot   = this.activeModes.has(InteractionMode.RotateWithHandDist)

    const sPinch    = this.scaleAtZero + (this.scaleAtOne - this.scaleAtZero) * pinchT
    const sHandDist = this.scaleAtZero + (this.scaleAtOne - this.scaleAtZero) * handDistT
    const rPinch    = (this.rotationAtZero + (this.rotationAtOne - this.rotationAtZero) * pinchT)    * DEG
    const rHandDist = (this.rotationAtZero + (this.rotationAtOne - this.rotationAtZero) * handDistT) * DEG

    for (const cube of this.cubeInstances) {
      const tx = cube.getTransform()

      // ── Scale ──────────────────────────────────────────────────────────────
      if (hasPinchScale || hasHandDistScale) {
        const pinchC    = hasPinchScale    ? this.scaleContrib(sPinch,    this.scalePinchAxes)    : new vec3(1, 1, 1)
        const handDistC = hasHandDistScale ? this.scaleContrib(sHandDist, this.scaleHandDistAxes) : new vec3(1, 1, 1)
        tx.setLocalScale(new vec3(
          pinchC.x * handDistC.x,
          pinchC.y * handDistC.y,
          pinchC.z * handDistC.z
        ))
      }

      // ── Rotation ───────────────────────────────────────────────────────────
      if (hasPinchRot || hasHandDistRot) {
        let rot = quat.quatIdentity()
        if (hasPinchRot)    rot = rot.multiply(quat.angleAxis(rPinch,    this.safeNorm(this.rotatePinchAxis)))
        if (hasHandDistRot) rot = rot.multiply(quat.angleAxis(rHandDist, this.safeNorm(this.rotateHandDistAxis)))
        tx.setLocalRotation(rot)
      }
    }
  }

  /** Per-component scale contribution: 1 where axis weight = 0, s where axis weight = 1. */
  private scaleContrib(s: number, axes: vec3): vec3 {
    return new vec3(
      1 + (s - 1) * axes.x,
      1 + (s - 1) * axes.y,
      1 + (s - 1) * axes.z
    )
  }

  /** Normalise a vec3; falls back to vec3.up() if near-zero. */
  private safeNorm(v: vec3): vec3 {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
    return len > 0.0001 ? new vec3(v.x / len, v.y / len, v.z / len) : vec3.up()
  }
}
