/**
 * DistanceField – gravitational curve field utility.
 *
 * Assign N control points to define a Catmull-Rom "galaxy path".
 * Around each control point a cluster of particle prefab instances is spawned
 * inside an imaginary sphere of radius `clusterRadius`.
 * A reference object (the "spaceship") is projected onto the nearest point on
 * the path each frame. A second prefab (the projection indicator) is placed
 * at that projection point.
 * Particles near the projection point are pushed away with gravitational-field
 * falloff and smoothly return to rest as the spaceship moves on.
 *
 * Inspector controls: clusterRadius, instancesPerCluster, particleScale,
 *                     pushDistance, pushStrength, pushSmoothSpeed.
 */
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger"
import { bindStartEvent, bindUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators"
import { withAlpha } from "SpectaclesInteractionKit.lspkg/Utils/color"
import InteractorLineRenderer from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractorLineVisual/InteractorLineRenderer"

// Per-particle runtime data
type ParticleData = {
  obj: SceneObject
  cpIdx: number       // owning control-point index
  restOffset: vec3    // fixed random offset from control-point (world-space delta at spawn)
  smoothDisplace: vec3
}

function lerpVec3(a: vec3, b: vec3, t: number): vec3 {
  return new vec3(
    a.x + (b.x - a.x) * t,
    a.y + (b.y - a.y) * t,
    a.z + (b.z - a.z) * t
  )
}

function randomInUnitSphere(): vec3 {
  while (true) {
    const x = Math.random() * 2 - 1
    const y = Math.random() * 2 - 1
    const z = Math.random() * 2 - 1
    if (x * x + y * y + z * z <= 1) return new vec3(x, y, z)
  }
}

@component
export class DistanceField extends BaseScriptComponent {

  @ui.label('<span style="color: #60A5FA;">DistanceField – gravitational curve field</span><br/><span style="color: #94A3B8; font-size: 11px;">Control points define a Catmull-Rom path. Particle clusters spawn around each point. The reference object projects onto the path and drives a gravitational repulsion field.</span>')
  @ui.separator

  // ── Curve ─────────────────────────────────────────────────────────────────
  @ui.group_start("Curve")
  @input
  @hint("Scene objects that define the Catmull-Rom galaxy path (minimum 2)")
  controlPoints: SceneObject[]

  @input("number", "20")
  @hint("Interpolation steps between each pair of control points — higher = smoother curve")
  interpolationSteps: number = 20

  @input
  @hint("Close the curve back to the first control point")
  closedLoop: boolean = false
  @ui.group_end

  // ── Particle Clusters ─────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Particle Clusters")
  @input
  @hint("Prefab to instantiate inside each cluster sphere")
  particlePrefab: ObjectPrefab

  @input("number", "8")
  @hint("Number of particle instances spawned per control point")
  instancesPerCluster: number = 8

  @input("number", "5.0")
  @hint("Radius of the imaginary spawn sphere around each control point (cm)")
  clusterRadius: number = 5.0
  @ui.group_end

  // ── Reference Object ──────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Reference Object")
  @input
  @hint("The object whose projection onto the curve drives the field (the spaceship)")
  referenceObject: SceneObject

  @input
  @hint("Prefab placed at the projection point on the curve (optional — the red spaceship indicator)")
  @allowUndefined
  projectionPrefab: ObjectPrefab | null = null
  @ui.group_end

  // ── Gravitational Field ───────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Gravitational Field")
  @input("number", "15.0")
  @hint("Sphere of influence: particles within this distance (cm) are repelled")
  pushDistance: number = 15.0

  @input("number", "8.0")
  @hint("Maximum displacement magnitude when the projection point is at distance 0 (cm)")
  pushStrength: number = 8.0

  @input("number", "6.0")
  @hint("Smoothing speed for particle return to rest (higher = snappier)")
  pushSmoothSpeed: number = 6.0
  @ui.group_end

  // ── Curve Visual ──────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Curve Visual")
  @input
  @hint("Render the Catmull-Rom path as a visible line")
  showCurve: boolean = true

  @input
  @hint("Material used to render the curve line (assign a line/unlit material)")
  @allowUndefined
  lineMaterial: Material | null = null

  @input("vec3", "{0.2, 0.6, 1.0}")
  @widget(new ColorWidget())
  @hint("RGB colour of the curve line")
  lineColor: vec3 = new vec3(0.2, 0.6, 1.0)

  @input("number", "0.4")
  @hint("Width of the curve line (cm)")
  lineWidth: number = 0.4
  @ui.group_end

  // ── Logging ───────────────────────────────────────────────────────────────
  @ui.separator
  @ui.group_start("Logging")
  @input
  @hint("Enable general logging (spawn counts, projection updates)")
  enableLogging: boolean = false

  @input
  @hint("Enable lifecycle logging (onAwake, onStart)")
  enableLoggingLifecycle: boolean = false
  @ui.group_end

  // ── Private state ─────────────────────────────────────────────────────────
  private particles:       ParticleData[] = []
  private projIndicator:   SceneObject | null = null
  private lineRenderer:    InteractorLineRenderer | null = null
  private curveWorldPts:   vec3[] = []
  private lastCPPositions: vec3[] = []
  private prevRefPos:        vec3 | null = null
  private travelForward:     boolean = true
  private logger:          Logger

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onAwake(): void {
    this.logger = new Logger("DistanceField", this.enableLogging || this.enableLoggingLifecycle, true)
    if (this.enableLoggingLifecycle) this.logger.debug("LIFECYCLE: onAwake()")
  }

  @bindStartEvent
  onStart(): void {
    if (this.enableLoggingLifecycle) this.logger.debug("LIFECYCLE: onStart()")

    if (!this.controlPoints || this.controlPoints.length < 2) {
      this.logger.debug("DistanceField requires at least 2 control points.")
      return
    }

    this.buildCurve()
    this.spawnParticles()
    this.createProjectionIndicator()
    if (this.showCurve && this.lineMaterial) this.buildLineRenderer()
  }

  @bindUpdateEvent
  onUpdate(): void {
    if (!this.referenceObject || this.curveWorldPts.length === 0) return

    // Rebuild curve + line if any control point moved
    if (this.haveControlPointsMoved()) {
      this.buildCurve()
      if (this.showCurve && this.lineMaterial) this.buildLineRenderer()
    }

    const refPos = this.referenceObject.getTransform().getWorldPosition()

    // Update travel direction from reference object velocity (stable, no index jitter)
    if (this.prevRefPos !== null) {
      const vx = refPos.x - this.prevRefPos.x
      const vy = refPos.y - this.prevRefPos.y
      const vz = refPos.z - this.prevRefPos.z
      const speed = Math.sqrt(vx * vx + vy * vy + vz * vz)
      if (speed > 0.05) {
        const {idx} = this.closestOnCurve(refPos)
        const tangent = this.curveTangent(idx)
        const dot = vx * tangent.x + vy * tangent.y + vz * tangent.z
        this.travelForward = dot >= 0
      }
    }
    this.prevRefPos = new vec3(refPos.x, refPos.y, refPos.z)

    const {pt: projPt, idx: projIdx} = this.closestOnCurve(refPos)

    if (this.projIndicator) {
      const t = this.projIndicator.getTransform()
      t.setWorldPosition(projPt)
      t.setWorldRotation(this.tangentRotation(projIdx))
    }

    this.updateField(projPt)
  }

  @bindDestroyEvent
  onDestroy(): void {
    if (this.lineRenderer) this.lineRenderer.destroy()
  }

  // ── Curve ─────────────────────────────────────────────────────────────────

  private buildCurve(): void {
    const positions = this.controlPoints.map(cp => cp.getTransform().getWorldPosition())
    this.lastCPPositions = positions.map(p => new vec3(p.x, p.y, p.z))
    this.curveWorldPts = []

    // Pad for Catmull-Rom endpoints
    let pts: vec3[]
    if (this.closedLoop && positions.length > 2) {
      pts = [positions[positions.length - 1], ...positions, positions[0], positions[1]]
    } else {
      pts = [positions[0], ...positions, positions[positions.length - 1]]
    }

    const segCount = this.closedLoop ? positions.length : positions.length - 1
    this.curveWorldPts.push(positions[0])

    for (let i = 0; i < segCount; i++) {
      const p0 = i === 0 && !this.closedLoop ? pts[0] : pts[i]
      const p1 = pts[i + 1]
      const p2 = pts[i + 2]
      const p3 = i === segCount - 1 && !this.closedLoop ? pts[pts.length - 1] : pts[i + 3]
      const steps = i === segCount - 1 ? this.interpolationSteps + 1 : this.interpolationSteps

      for (let j = 1; j <= steps; j++) {
        const t = j / (steps + (i === segCount - 1 ? 0 : 1))
        this.curveWorldPts.push(this.catmullRom(p0, p1, p2, p3, t))
      }
    }

    if (!this.closedLoop) {
      this.curveWorldPts[this.curveWorldPts.length - 1] = positions[positions.length - 1]
    }
  }

  private buildLineRenderer(): void {
    if (this.lineRenderer) {
      this.lineRenderer.destroy()
      this.lineRenderer = null
    }
    if (this.curveWorldPts.length < 2 || !this.lineMaterial) return

    const invWorld = this.sceneObject.getTransform().getInvertedWorldTransform()
    const localPts = this.closedLoop
      ? [...this.curveWorldPts, this.curveWorldPts[0]].map(p => invWorld.multiplyPoint(p))
      : this.curveWorldPts.map(p => invWorld.multiplyPoint(p))

    const c = withAlpha(this.lineColor, 1)
    this.lineRenderer = new InteractorLineRenderer({
      material: this.lineMaterial,
      points: localPts,
      startColor: c,
      endColor: c,
      startWidth: this.lineWidth,
      endWidth: this.lineWidth,
    })
    this.lineRenderer.getSceneObject().setParent(this.sceneObject)
  }

  // ── Particles ─────────────────────────────────────────────────────────────

  private spawnParticles(): void {
    if (!this.particlePrefab) {
      this.logger.debug("particlePrefab not assigned — skipping particle spawn")
      return
    }

    this.particles = []

    for (let ci = 0; ci < this.controlPoints.length; ci++) {
      const cpPos = this.controlPoints[ci].getTransform().getWorldPosition()

      for (let j = 0; j < this.instancesPerCluster; j++) {
        const offset = randomInUnitSphere().uniformScale(this.clusterRadius)
        const worldPos = new vec3(cpPos.x + offset.x, cpPos.y + offset.y, cpPos.z + offset.z)

        const inst = this.particlePrefab.instantiate(this.sceneObject)
        inst.getTransform().setWorldPosition(worldPos)

        this.particles.push({
          obj: inst,
          cpIdx: ci,
          restOffset: new vec3(offset.x, offset.y, offset.z),
          smoothDisplace: vec3.zero(),
        })
      }
    }

    if (this.enableLogging) this.logger.debug(`Spawned ${this.particles.length} particles across ${this.controlPoints.length} clusters`)
  }

  private createProjectionIndicator(): void {
    if (!this.projectionPrefab) return
    this.projIndicator = this.projectionPrefab.instantiate(this.sceneObject)
    if (this.enableLogging) this.logger.debug("Projection indicator created")
  }

  // ── Field update ──────────────────────────────────────────────────────────

  private updateField(projPt: vec3): void {
    const dt = getDeltaTime()
    const smoothT = Math.min(1, this.pushSmoothSpeed * dt)

    for (const p of this.particles) {
      const cpPos = this.controlPoints[p.cpIdx].getTransform().getWorldPosition()
      const restPos = new vec3(
        cpPos.x + p.restOffset.x,
        cpPos.y + p.restOffset.y,
        cpPos.z + p.restOffset.z
      )

      // Direction from projection point to rest position (push away)
      const toParticle = new vec3(restPos.x - projPt.x, restPos.y - projPt.y, restPos.z - projPt.z)
      const dist = toParticle.length

      let target = vec3.zero()
      if (dist < this.pushDistance && this.pushDistance > 0) {
        const factor = 1 - dist / this.pushDistance   // 1 at center, 0 at edge
        const dir = dist > 0.001 ? toParticle.normalize() : vec3.up()
        target = dir.uniformScale(factor * factor * this.pushStrength)
      }

      p.smoothDisplace = lerpVec3(p.smoothDisplace, target, smoothT)

      p.obj.getTransform().setWorldPosition(new vec3(
        restPos.x + p.smoothDisplace.x,
        restPos.y + p.smoothDisplace.y,
        restPos.z + p.smoothDisplace.z
      ))
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private haveControlPointsMoved(): boolean {
    if (this.lastCPPositions.length !== this.controlPoints.length) return true
    for (let i = 0; i < this.controlPoints.length; i++) {
      if (!this.controlPoints[i].getTransform().getWorldPosition().equal(this.lastCPPositions[i])) return true
    }
    return false
  }

  private closestOnCurve(pos: vec3): {pt: vec3, idx: number} {
    let best = this.curveWorldPts[0]
    let bestIdx = 0
    let bestDist2 = Number.MAX_VALUE
    for (let i = 0; i < this.curveWorldPts.length; i++) {
      const pt = this.curveWorldPts[i]
      const dx = pt.x - pos.x, dy = pt.y - pos.y, dz = pt.z - pos.z
      const d2 = dx * dx + dy * dy + dz * dz
      if (d2 < bestDist2) { bestDist2 = d2; best = pt; bestIdx = i }
    }
    return {pt: best, idx: bestIdx}
  }

  // Returns the normalised curve tangent at idx (always pointing in parameterisation order).
  private curveTangent(idx: number): vec3 {
    const pts = this.curveWorldPts
    let tx: number, ty: number, tz: number
    if (idx < pts.length - 1) {
      tx = pts[idx + 1].x - pts[idx].x
      ty = pts[idx + 1].y - pts[idx].y
      tz = pts[idx + 1].z - pts[idx].z
    } else {
      tx = pts[idx].x - pts[idx - 1].x
      ty = pts[idx].y - pts[idx - 1].y
      tz = pts[idx].z - pts[idx - 1].z
    }
    const len = Math.sqrt(tx * tx + ty * ty + tz * tz)
    return len > 0.0001 ? new vec3(tx / len, ty / len, tz / len) : vec3.forward()
  }

  // Orient indicator so its local +Y (cone tip) faces along the travel direction.
  // Uses this.travelForward (updated from reference velocity) to avoid index jitter flipping.
  private tangentRotation(idx: number): quat {
    if (this.curveWorldPts.length < 2) return quat.quatIdentity()
    const tangent = this.curveTangent(idx)
    const dir = this.travelForward ? tangent : tangent.uniformScale(-1)
    return this.rotateYToward(dir)
  }

  // Builds a quaternion that rotates local +Y to point toward dir.
  private rotateYToward(dir: vec3): quat {
    const from = vec3.up()
    const cosA = Math.max(-1, Math.min(1, from.dot(dir)))
    if (cosA > 0.9999) return quat.quatIdentity()
    if (cosA < -0.9999) return quat.angleAxis(Math.PI, new vec3(1, 0, 0))
    return quat.angleAxis(Math.acos(cosA), from.cross(dir).normalize())
  }

  private catmullRom(p0: vec3, p1: vec3, p2: vec3, p3: vec3, t: number): vec3 {
    const t2 = t * t, t3 = t2 * t
    return new vec3(
      this.crComp(p0.x, p1.x, p2.x, p3.x, t, t2, t3),
      this.crComp(p0.y, p1.y, p2.y, p3.y, t, t2, t3),
      this.crComp(p0.z, p1.z, p2.z, p3.z, t, t2, t3)
    )
  }

  private crComp(v0: number, v1: number, v2: number, v3: number, t: number, t2: number, t3: number): number {
    return 0.5 * (2 * v1 + (v2 - v0) * t + (2 * v0 - 5 * v1 + 4 * v2 - v3) * t2 + (-v0 + 3 * v1 - 3 * v2 + v3) * t3)
  }
}
