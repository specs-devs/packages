// TypeScript rewrite of physicEngine_v2.2 (physics.js) — optimized.
//
// A chain / soft-body physics solver. For every root SceneObject in
// `mainObject`, it walks the child hierarchy and creates one PhysicPoint per
// child. Each point is "pinned" to its parent point and lags behind it under
// gravity, damping, tension and optional collider forces, producing the jelly
// dangling motion.
//
// Performance notes (vs. the original JS):
//   * Collider world transforms (position + scale) are read ONCE per frame into
//     a shared cache instead of once per point per collider — the original did
//     `points * colliders` native engine calls every frame; now it is just
//     `colliders`.
//   * The collider test uses squared distance and only does the sqrt / divide
//     when a joint is actually inside a collider.
//   * The hottest inner math (collider + tension + integration) runs in-place
//     on reusable buffers, so the per-frame allocation churn is greatly reduced.
//   * `getDeltaTime()`, the gravity vector and the combined external force are
//     computed once per frame and shared across all points.
//
// Expanded controls (all default to the original behaviour / off):
//   * Advanced:  colliderRadiusScale, enableColliders, gravityScale, maxSpeed.
//   * Wind:      directional wind with time-based turbulence.
//   * Performance: updateInterval (frame-skip LOD), useDirectRotation.
//
// The bespoke math library (MathLib.vec3 / MathLib.quat) is preserved as the
// MVec3 / MQuat classes; the Lens core types `vec3` / `quat` / `mat4` are still
// used for engine interop via the toCore / fromCore helpers.

// ---------------------------------------------------------------------------
// Math library (ported from global.MathLib)
// ---------------------------------------------------------------------------

class MVec3 {
  x: number
  y: number
  z: number

  constructor(x: number, y: number, z: number) {
    this.x = x
    this.y = y
    this.z = z
  }

  add(v: MVec3): MVec3 {
    return new MVec3(this.x + v.x, this.y + v.y, this.z + v.z)
  }
  sub(v: MVec3): MVec3 {
    return new MVec3(this.x - v.x, this.y - v.y, this.z - v.z)
  }
  mult(v: MVec3): MVec3 {
    return new MVec3(this.x * v.x, this.y * v.y, this.z * v.z)
  }
  scale(v: MVec3): MVec3 {
    return new MVec3(this.x * v.x, this.y * v.y, this.z * v.z)
  }
  div(v: MVec3): MVec3 {
    return new MVec3(this.x / v.x, this.y / v.y, this.z / v.z)
  }
  uniformScale(s: number): MVec3 {
    return new MVec3(this.x * s, this.y * s, this.z * s)
  }
  equal(v: MVec3): boolean {
    return this.x === v.x && this.y === v.y && this.z === v.z
  }
  getLength(): number {
    const x = this.x
    const y = this.y
    const z = this.z
    return Math.sqrt(x * x + y * y + z * z)
  }
  clampLength(maxLength: number): MVec3 {
    const curLength = this.length
    const scale = curLength > maxLength ? maxLength / curLength : 1.0
    return new MVec3(this.x * scale, this.y * scale, this.z * scale)
  }
  getLengthSquared(): number {
    const x = this.x
    const y = this.y
    const z = this.z
    return x * x + y * y + z * z
  }
  normalize(): MVec3 {
    const x = this.x
    const y = this.y
    const z = this.z
    const invLength = 1.0 / Math.sqrt(x * x + y * y + z * z)
    return new MVec3(x * invLength, y * invLength, z * invLength)
  }
  angleTo(v: MVec3): number {
    return Math.acos((this.x * v.x + this.y * v.y + this.z * v.z) / (this.length * v.length))
  }
  distance(v: MVec3): number {
    return v.sub(this).length
  }
  dot(v: MVec3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z
  }
  moveTowards(v: MVec3, step: number): MVec3 {
    step = Math.min(1.0, step / this.distance(v))
    const x = this.x
    const y = this.y
    const z = this.z
    return new MVec3(x + step * (v.x - x), y + step * (v.y - y), z + step * (v.z - z))
  }
  project(v: MVec3): MVec3 {
    const vx = v.x
    const vy = v.y
    const vz = v.z
    return v.uniformScale((this.x * vx + this.y * vy + this.z * vz) / (vx * vx + vy * vy + vz * vz))
  }
  projectOnPlane(v: MVec3): MVec3 {
    const res = this.project(v)
    res.x = this.x - res.x
    res.y = this.y - res.y
    res.z = this.z - res.z
    return res
  }
  reflect(v: MVec3): MVec3 {
    const x = this.x
    const y = this.y
    const z = this.z
    const res = v.uniformScale((x * v.x + y * v.y + z * v.z) * 2)
    res.x = x - res.x
    res.y = y - res.y
    res.z = z - res.z
    return res
  }
  toString(): string {
    return "{x: " + this.x + ", y: " + this.y + ", z: " + this.z + "}"
  }
  cross(v: MVec3): MVec3 {
    const thisx = this.x
    const thisy = this.y
    const thisz = this.z

    const vx = v.x
    const vy = v.y
    const vz = v.z
    return new MVec3(thisy * vz - thisz * vy, thisz * vx - thisx * vz, thisx * vy - thisy * vx)
  }
  rotateTowards(v: MVec3, step: number): MVec3 {
    const len = this.length
    let vecNormalized = this.uniformScale(1.0 / len)
    const targetNormalized = v.normalize()

    if (
      step >
      Math.acos(
        vecNormalized.x * targetNormalized.x +
          vecNormalized.y * targetNormalized.y +
          vecNormalized.z * targetNormalized.z
      )
    ) {
      return targetNormalized.iUniformScale(len)
    }

    // vecNormalized becomes the rotation axis
    vecNormalized = vecNormalized.cross(targetNormalized).iNormalize()

    const s = Math.sin(step)
    const c = Math.cos(step)
    const temp = vecNormalized.uniformScale(1.0 - c)

    const thisx = this.x
    const tempx = temp.x
    const vecNormalizedx = vecNormalized.x
    const thisy = this.y
    const tempy = temp.y
    const vecNormalizedy = vecNormalized.y
    const thisz = this.z
    const tempz = temp.z
    const vecNormalizedz = vecNormalized.z
    // Multiplying a vector by a rotation matrix
    return new MVec3(
      thisx * (c + tempx * vecNormalizedx) +
        thisy * (tempy * vecNormalizedx - s * vecNormalizedz) +
        thisz * (tempz * vecNormalizedx + s * vecNormalizedy),

      thisx * (tempx * vecNormalizedy + s * vecNormalizedz) +
        thisy * (c + tempy * vecNormalizedy) +
        thisz * (tempz * vecNormalizedy - s * vecNormalizedx),

      thisx * (tempx * vecNormalizedz - s * vecNormalizedy) +
        thisy * (tempy * vecNormalizedz + s * vecNormalizedx) +
        thisz * (c + tempz * vecNormalizedz)
    )
  }

  // in-place helpers used for optimization
  iUniformScale(s: number): MVec3 {
    this.x *= s
    this.y *= s
    this.z *= s
    return this
  }
  iNormalize(): MVec3 {
    const x = this.x
    const y = this.y
    const z = this.z
    const invLength = 1.0 / Math.sqrt(x * x + y * y + z * z)
    this.x *= invLength
    this.y *= invLength
    this.z *= invLength
    return this
  }
  iAdd(v: MVec3): MVec3 {
    this.x += v.x
    this.y += v.y
    this.z += v.z
    return this
  }
  iSub(v: MVec3): MVec3 {
    this.x -= v.x
    this.y -= v.y
    this.z -= v.z
    return this
  }
  iCopy(v: MVec3): MVec3 {
    this.x = v.x
    this.y = v.y
    this.z = v.z
    return this
  }
  iSet(x: number, y: number, z: number): MVec3 {
    this.x = x
    this.y = y
    this.z = z
    return this
  }
  setFromCore(v: vec3): MVec3 {
    this.x = v.x
    this.y = v.y
    this.z = v.z
    return this
  }

  // color-style aliases
  get r(): number {
    return this.x
  }
  set r(x: number) {
    this.x = x
  }
  get g(): number {
    return this.y
  }
  set g(y: number) {
    this.y = y
  }
  get b(): number {
    return this.z
  }
  set b(z: number) {
    this.z = z
  }

  get length(): number {
    return this.getLength()
  }
  get lengthSquared(): number {
    return this.getLengthSquared()
  }

  static orthonormalize(x: MVec3, y: MVec3): void {
    x.iNormalize()
    y.iNormalize()
    y.iSub(x.uniformScale(y.x * x.x + y.y * x.y + y.z * x.z))
    y.iNormalize()
  }
  static max(x: MVec3, y: MVec3): MVec3 {
    return new MVec3(Math.max(x.x, y.x), Math.max(x.y, y.y), Math.max(x.z, y.z))
  }
  static min(x: MVec3, y: MVec3): MVec3 {
    return new MVec3(Math.min(x.x, y.x), Math.min(x.y, y.y), Math.min(x.z, y.z))
  }
  static lerp(x: MVec3, y: MVec3, step: number): MVec3 {
    const xx = x.x
    const xy = x.y
    const xz = x.z
    return new MVec3(xx + step * (y.x - xx), xy + step * (y.y - xy), xz + step * (y.z - xz))
  }
  static slerp(x: MVec3, y: MVec3, step: number): MVec3 {
    const xLength = x.length
    const yLength = y.length

    x = x.normalize()
    y = y.normalize()

    const alpha = Math.acos(x.x * y.x + x.y * y.y + x.z * y.z)
    const invSinAlpha = 1.0 / Math.sin(alpha)

    return x
      .iUniformScale(Math.sin((1 - step) * alpha) * invSinAlpha)
      .iAdd(y.iUniformScale(Math.sin(step * alpha) * invSinAlpha))
      .iUniformScale(xLength + step * (yLength - xLength))
  }
  static one(): MVec3 {
    return new MVec3(1.0, 1.0, 1.0)
  }
  static zero(): MVec3 {
    return new MVec3(0.0, 0.0, 0.0)
  }
  static up(): MVec3 {
    return new MVec3(0.0, 1.0, 0.0)
  }
  static down(): MVec3 {
    return new MVec3(0.0, -1.0, 0.0)
  }
  static left(): MVec3 {
    return new MVec3(-1.0, 0.0, 0.0)
  }
  static right(): MVec3 {
    return new MVec3(1.0, 0.0, 0.0)
  }
  static back(): MVec3 {
    return new MVec3(0.0, 0.0, -1.0)
  }
  static forward(): MVec3 {
    return new MVec3(0.0, 0.0, 1.0)
  }

  // interop with Lens core vec3
  toCore(): vec3 {
    return new vec3(this.x, this.y, this.z)
  }
  static toCore(v: MVec3): vec3 {
    return new vec3(v.x, v.y, v.z)
  }
  static fromCore(v: vec3): MVec3 {
    return new MVec3(v.x, v.y, v.z)
  }
}

class MQuat {
  w: number
  x: number
  y: number
  z: number

  constructor(w: number, x: number, y: number, z: number) {
    this.w = w
    this.x = x
    this.y = y
    this.z = z
  }

  invert(): MQuat {
    return new MQuat(this.w, -this.x, -this.y, -this.z)
  }
  normalize(): MQuat {
    const x = this.x,
      y = this.y,
      z = this.z,
      w = this.w
    let len = Math.sqrt(w * w + x * x + y * y + z * z)
    if (len <= 0) return new MQuat(1.0, 0.0, 0.0, 0.0)

    len = 1.0 / len
    return new MQuat(w * len, x * len, y * len, z * len)
  }
  toString(): string {
    return "{x: " + this.x + ", y: " + this.y + ", z: " + this.z + ", w: " + this.w + "}"
  }
  toEulerAngles(): MVec3 {
    const singularityTestValue = 0.4999

    const x = this.x,
      y = this.y,
      z = this.z,
      w = this.w

    const sqw = w * w
    const sqx = x * x
    const sqy = y * y
    const sqz = z * z

    const unit = sqx + sqy + sqz + sqw
    const test = (x * z - y * w) / unit

    let xEul: number, yEul: number, zEul: number

    // singularity at north pole
    if (test > singularityTestValue * unit) {
      xEul = 2.0 * Math.atan2(x, w)
      yEul = Math.PI * 0.5
      zEul = 0.0
    }
    // singularity at south pole
    else if (test < -singularityTestValue * unit) {
      xEul = -2.0 * Math.atan2(x, w)
      yEul = -Math.PI * 0.5
      zEul = 0.0
    } else {
      xEul = Math.atan2(2.0 * (y * z + x * w), -sqx - sqy + sqz + sqw)
      yEul = Math.asin(-2.0 * test)
      zEul = Math.atan2(2.0 * (x * y + z * w), sqx - sqy - sqz + sqw)
    }

    if (xEul < 0.0) xEul += Math.PI * 2.0
    if (yEul < 0.0) yEul += Math.PI * 2.0
    if (zEul < 0.0) zEul += Math.PI * 2.0

    return new MVec3(xEul, yEul, zEul)
  }
  getAngle(): number {
    return Math.acos(this.w) * 2.0
  }
  getAxis(): MVec3 {
    let tmp = 1.0 - this.w * this.w
    if (tmp <= 0.0) {
      return new MVec3(0.0, 0.0, 1.0)
    }
    tmp = 1.0 / Math.sqrt(tmp)
    return new MVec3(this.x * tmp, this.y * tmp, this.z * tmp)
  }
  dot(q: MQuat): number {
    return this.w * q.w + this.x * q.x + this.y * q.y + this.z * q.z
  }
  multiply(q: MQuat): MQuat {
    const x = this.x,
      y = this.y,
      z = this.z,
      w = this.w
    const qx = q.x,
      qy = q.y,
      qz = q.z,
      qw = q.w

    return new MQuat(
      w * qw - x * qx - y * qy - z * qz,
      w * qx + x * qw + y * qz - z * qy,
      w * qy + y * qw + z * qx - x * qz,
      w * qz + z * qw + x * qy - y * qx
    )
  }
  equal(q: MQuat): boolean {
    return this.w === q.w && this.x === q.x && this.y === q.y && this.z === q.z
  }
  // helpers used to simplify the implementation of other functions
  uniformScale(s: number): MQuat {
    return new MQuat(this.w * s, this.x * s, this.y * s, this.z * s)
  }
  add(q: MQuat): MQuat {
    return new MQuat(this.w + q.w, this.x + q.x, this.y + q.y, this.z + q.z)
  }
  iUniformScale(s: number): MQuat {
    this.w *= s
    this.x *= s
    this.y *= s
    this.z *= s
    return this
  }
  iNormalize(): MQuat {
    let len = Math.sqrt(this.w * this.w + this.x * this.x + this.y * this.y + this.z * this.z)
    if (len <= 0) {
      this.w = 1.0
      this.x = 0.0
      this.y = 0.0
      this.z = 0.0
    } else {
      len = 1.0 / len
      this.w *= len
      this.x *= len
      this.y *= len
      this.z *= len
    }
    return this
  }
  iAdd(q: MQuat): MQuat {
    this.w += q.w
    this.x += q.x
    this.y += q.y
    this.z += q.z
    return this
  }

  static angleBetween(x: MQuat, y: MQuat): number {
    const xw = x.w,
      xx = x.x,
      xy = x.y,
      xz = x.z
    const invSqr = 1.0 / (xw * xw + xx * xx + xy * xy + xz * xz)
    const tmp = new MQuat(xw * invSqr, -xx * invSqr, -xy * invSqr, -xz * invSqr)

    const angle = Math.acos(tmp.multiply(y).w) * 2.0
    return angle > 180.0 ? 360.0 - angle : angle
  }
  static angleAxis(a: number, v: MVec3): MQuat {
    const s = Math.sin(a * 0.5)
    return new MQuat(Math.cos(a * 0.5), v.x * s, v.y * s, v.z * s)
  }
  static fromEulerAngles(x: number, y: number, z: number): MQuat {
    x *= 0.5
    y *= 0.5
    z *= 0.5

    const cx = Math.cos(x),
      cy = Math.cos(y),
      cz = Math.cos(z)
    const sx = Math.sin(x),
      sy = Math.sin(y),
      sz = Math.sin(z)

    const sxsy = sx * sy,
      cxcy = cx * cy,
      sxcy = sx * cy,
      cxsy = cx * sy

    return new MQuat(cxcy * cz + sxsy * sz, sxcy * cz - cxsy * sz, cxsy * cz + sxcy * sz, cxcy * sz - sxsy * cz)
  }
  static fromEulerVec(v: MVec3): MQuat {
    return MQuat.fromEulerAngles(v.x, v.y, v.z)
  }
  static rotationFromTo(from: MVec3, to: MVec3): MQuat {
    const angle = from.angleTo(to)
    let axis = from.cross(to)

    if (axis.dot(axis) == 0.0) axis = new MVec3(1.0, 0.0, 0.0)

    return MQuat.angleAxis(angle, axis.normalize())
  }
  static lookAt(forward: MVec3, up: MVec3): MQuat {
    MVec3.orthonormalize(forward, up)
    const right = up.cross(forward).iNormalize()

    return MQuat.fromMat3([right.x, right.y, right.z, up.x, up.y, up.z, forward.x, forward.y, forward.z])
  }
  static lerp(x: MQuat, y: MQuat, a: number): MQuat {
    const cosTheta = x.dot(y)

    // Perform a linear interpolation when cosTheta is close to 1 to avoid the
    // side effect of sin(angle) becoming a zero denominator.
    if (cosTheta > 1.0) {
      const xw = x.w,
        xx = x.x,
        xy = x.y,
        xz = x.z
      return new MQuat(xw + a * (y.w - xw), xx + a * (y.x - xx), xy + a * (y.y - xy), xz + a * (y.z - xz))
    } else {
      // Essential Mathematics, page 467
      const angle = Math.acos(cosTheta)
      return x
        .uniformScale(Math.sin((1.0 - a) * angle))
        .iAdd(y.uniformScale(Math.sin(a * angle)))
        .iUniformScale(1.0 / Math.sin(angle))
    }
  }
  static slerp(x: MQuat, y: MQuat, a: number): MQuat {
    let cosTheta = x.dot(y)

    // If cosTheta < 0, the interpolation will take the long way around the
    // sphere. To fix this, one quat must be negated.
    if (cosTheta < 0.0) {
      y = new MQuat(-y.w, -y.x, -y.y, -y.z)
      cosTheta = -cosTheta
    }

    // Perform a linear interpolation when cosTheta is close to 1 to avoid the
    // side effect of sin(angle) becoming a zero denominator.
    if (cosTheta > 1.0) {
      const xw = x.w,
        xx = x.x,
        xy = x.y,
        xz = x.z
      return new MQuat(xw + a * (y.w - xw), xx + a * (y.x - xx), xy + a * (y.y - xy), xz + a * (y.z - xz))
    } else {
      // Essential Mathematics, page 467
      const angle = Math.acos(cosTheta)
      return x
        .uniformScale(Math.sin((1.0 - a) * angle))
        .iAdd(y.uniformScale(Math.sin(a * angle)))
        .iUniformScale(1.0 / Math.sin(angle))
    }
  }
  static quatIdentity(): MQuat {
    return new MQuat(1.0, 0.0, 0.0, 0.0)
  }
  static fromMat3(m: number[]): MQuat {
    const fourXSquaredMinus1 = m[0] - m[4] - m[8]
    const fourYSquaredMinus1 = m[4] - m[0] - m[8]
    const fourZSquaredMinus1 = m[8] - m[0] - m[4]

    let biggestIndex = 0
    let fourBiggestSquaredMinus1 = m[0] + m[4] + m[8]
    if (fourXSquaredMinus1 > fourBiggestSquaredMinus1) {
      fourBiggestSquaredMinus1 = fourXSquaredMinus1
      biggestIndex = 1
    }
    if (fourYSquaredMinus1 > fourBiggestSquaredMinus1) {
      fourBiggestSquaredMinus1 = fourYSquaredMinus1
      biggestIndex = 2
    }
    if (fourZSquaredMinus1 > fourBiggestSquaredMinus1) {
      fourBiggestSquaredMinus1 = fourZSquaredMinus1
      biggestIndex = 3
    }

    const biggestVal = Math.sqrt(fourBiggestSquaredMinus1 + 1.0) * 0.5
    const mult = 0.25 / biggestVal

    const result = new MQuat(1.0, 0.0, 0.0, 0.0)
    switch (biggestIndex) {
      case 0:
        result.w = biggestVal
        result.x = (m[5] - m[7]) * mult
        result.y = (m[6] - m[2]) * mult
        result.z = (m[1] - m[3]) * mult
        break
      case 1:
        result.w = (m[5] - m[7]) * mult
        result.x = biggestVal
        result.y = (m[1] + m[3]) * mult
        result.z = (m[6] + m[2]) * mult
        break
      case 2:
        result.w = (m[6] - m[2]) * mult
        result.x = (m[1] + m[3]) * mult
        result.y = biggestVal
        result.z = (m[5] + m[7]) * mult
        break
      case 3:
        result.w = (m[1] - m[3]) * mult
        result.x = (m[6] + m[2]) * mult
        result.y = (m[5] + m[7]) * mult
        result.z = biggestVal
        break
    }
    return result
  }

  // interop with Lens core quat
  toCore(): quat {
    return new quat(this.w, this.x, this.y, this.z)
  }
  static toCore(q: MQuat): quat {
    return new quat(q.w, q.x, q.y, q.z)
  }
  static fromCore(q: quat): MQuat {
    return new MQuat(q.w, q.x, q.y, q.z)
  }
}

// ---------------------------------------------------------------------------
// Free helpers (ported verbatim)
// ---------------------------------------------------------------------------

function vecOnEulersAngles(vec: MVec3, x: number, y: number, z: number): MVec3 {
  let newVec = new MVec3(vec.x, vec.y, vec.z)
  newVec = new MVec3(
    newVec.x,
    newVec.y * Math.cos(x) - newVec.z * Math.sin(x),
    newVec.y * Math.sin(x) + newVec.z * Math.cos(x)
  )
  newVec = new MVec3(
    newVec.x * Math.cos(y) + newVec.z * Math.sin(y),
    newVec.y,
    newVec.z * Math.cos(y) - newVec.x * Math.sin(y)
  )
  newVec = new MVec3(
    newVec.x * Math.cos(z) - newVec.y * Math.sin(z),
    newVec.x * Math.sin(z) + newVec.y * Math.cos(z),
    newVec.z
  )
  return newVec
}

const EPS = 0.000001

// ---------------------------------------------------------------------------
// PhysicPoint — one simulated joint pinned to its parent
// ---------------------------------------------------------------------------

interface PointConfig {
  pinObject: SceneObject
  simulateObject: SceneObject
  physicStep: number
  dampingCoef: number
  tension: number
  scaleLength: number
  forceFadeCoef: number
  lockPosOffset: vec3
  rootClass: PhysicPoint | null
  lockLocalRotate: boolean
  lockLocalPosition: boolean
  deepNumber: number
  mainPoint: SceneObject
  owner: Physics
}

class PhysicPoint {
  private config: PointConfig
  private owner: Physics

  private pinObjectTransform: Transform
  private simulateObjectTransform: Transform

  private vecDown: MVec3
  private negVecDown: MVec3
  private vecDownCore: vec3

  private pinObjectPosition: MVec3
  private pinObjectRotation: MQuat

  currSimulateObjectPosition: MVec3
  currSimulateObjectRotation: MQuat

  private startPinObjectRotation: MQuat
  private startSimulateObjectRotation: quat

  private length: number
  // World scale of the pin when `length` was measured. Lengths are world-space, so
  // they are rescaled by the pin's current scale to survive the object being resized.
  private startPinScale: number
  private force: MVec3
  private snapPending: boolean = false

  // reusable scratch buffers (this solver is never re-entrant)
  private _balanced: MVec3 = new MVec3(0, 0, 0)
  private _want: MVec3 = new MVec3(0, 0, 0)
  private _dir: MVec3 = new MVec3(0, 0, 0)

  constructor(config: PointConfig) {
    this.config = config
    this.owner = config.owner

    this.pinObjectTransform = config.pinObject.getTransform()
    this.simulateObjectTransform = config.simulateObject.getTransform()

    const pinPos = MVec3.fromCore(this.pinObjectTransform.getWorldPosition())
    const simPos = MVec3.fromCore(this.simulateObjectTransform.getWorldPosition())

    this.vecDown = pinPos.sub(simPos).normalize()
    this.negVecDown = this.vecDown.uniformScale(-1)
    this.vecDownCore = this.vecDown.toCore()

    this.pinObjectPosition = pinPos
    this.pinObjectRotation = MQuat.fromCore(this.pinObjectTransform.getWorldRotation())

    this.currSimulateObjectPosition = simPos
    this.currSimulateObjectRotation = MQuat.fromCore(this.simulateObjectTransform.getWorldRotation())

    this.startPinObjectRotation = MQuat.fromCore(this.pinObjectTransform.getWorldRotation().invert())
    this.startSimulateObjectRotation = this.simulateObjectTransform.getWorldRotation()

    this.length = simPos.distance(pinPos) * config.scaleLength
    this.startPinScale = Math.max(this.pinObjectTransform.getWorldScale().x, EPS)

    this.force = new MVec3(0.0, 0.0, 0.0)
  }

  /** Settles this joint at its rest position on the next update, with no leftover motion. */
  snapToRest(): void {
    this.snapPending = true
  }

  update(): void {
    const config = this.config
    const owner = this.owner
    const curr = this.currSimulateObjectPosition
    const force = this.force

    // --- resolve the pin (parent) transform ------------------------------
    if (config.rootClass) {
      // Parent joint was already simulated this frame; reuse its result.
      this.pinObjectPosition = config.rootClass.currSimulateObjectPosition
      this.pinObjectRotation = config.rootClass.currSimulateObjectRotation
    } else {
      this.pinObjectPosition = MVec3.fromCore(this.pinObjectTransform.getWorldPosition())
      this.pinObjectRotation = MQuat.fromCore(this.pinObjectTransform.getWorldRotation()).multiply(
        this.startPinObjectRotation
      )
    }
    const pin = this.pinObjectPosition
    const length = this.length * (this.pinObjectTransform.getWorldScale().x / this.startPinScale)

    // --- rest position of this joint (rotate vecDown by the pin) ----------
    if (owner.useDirectRotation) {
      // Direct quaternion rotation: cheaper (no euler round-trip / trig).
      const rotated = mat4.fromRotation(this.pinObjectRotation.toCore()).multiplyDirection(this.vecDownCore)
      this._want.setFromCore(rotated).iNormalize().iUniformScale(length)
    } else {
      // Faithful euler path (original behaviour).
      const eulerAngles = this.pinObjectRotation.toEulerAngles()
      const nvd = vecOnEulersAngles(this.vecDown, eulerAngles.x, eulerAngles.y, eulerAngles.z)
        .normalize()
        .uniformScale(length)
      this._want.iCopy(nvd)
    }
    // this._want currently holds the rotated "down" vector; turn it into the
    // world-space wanted position: wantPosition = pin - rotatedDown
    this._want.iSet(pin.x - this._want.x, pin.y - this._want.y, pin.z - this._want.z)
    const want = this._want

    // After the rig jumps, the joint is still at its old position. Restarting from rest
    // keeps the tentacles from whipping across to catch up.
    if (this.snapPending) {
      this.snapPending = false
      curr.iCopy(want)
      force.iSet(0.0, 0.0, 0.0)
    }

    // --- integrate the spring/damper force --------------------------------
    // balanced = (curr - want) * (physicStep * dt * damping)
    this._balanced
      .iCopy(curr)
      .iSub(want)
      .iUniformScale(config.physicStep * owner.deltaTime * config.dampingCoef)
    // force = (force - balanced + externalForce) * forceFade
    force.iSub(this._balanced).iAdd(owner.externalForce).iUniformScale(config.forceFadeCoef)

    // --- collider response (uses the shared per-frame collider cache) -----
    const colliderCount = owner.activeColliderCount
    if (colliderCount > 0) {
      const px = curr.x + force.x
      const py = curr.y + force.y
      const pz = curr.z + force.z
      const centers = owner.colliderCenters
      const radii = owner.colliderRadii
      let fx = 0.0,
        fy = 0.0,
        fz = 0.0
      for (let i = 0; i < colliderCount; i++) {
        const c = centers[i]
        const r = radii[i]
        const dx = px - c.x
        const dy = py - c.y
        const dz = pz - c.z
        const distSq = dx * dx + dy * dy + dz * dz
        if (distSq < r * r && distSq > EPS) {
          const dist = Math.sqrt(distSq)
          const coef = (r - dist) / dist // (r - dist) * (1 / dist)
          fx += dx * coef
          fy += dy * coef
          fz += dz * coef
        }
      }
      force.x += fx
      force.y += fy
      force.z += fz
    }

    // --- tension: pull the joint back to its rest length ------------------
    {
      const tx = curr.x + force.x
      const ty = curr.y + force.y
      const tz = curr.z + force.z
      const dxp = tx - pin.x
      const dyp = ty - pin.y
      const dzp = tz - pin.z
      const distP = Math.sqrt(dxp * dxp + dyp * dyp + dzp * dzp)
      if (distP > EPS) {
        const offsetToPin = (length - distP) * config.tension
        const coef = offsetToPin / distP
        force.x += dxp * coef
        force.y += dyp * coef
        force.z += dzp * coef
      }
    }

    // --- optional velocity clamp for stability ----------------------------
    if (owner.maxSpeed > 0.0) {
      const spd2 = force.x * force.x + force.y * force.y + force.z * force.z
      const max2 = owner.maxSpeed * owner.maxSpeed
      if (spd2 > max2) {
        force.iUniformScale(owner.maxSpeed / Math.sqrt(spd2))
      }
    }

    // --- integrate position (lerp toward curr + force) --------------------
    const t = owner.lerpPositionsCoef
    curr.x = curr.x + force.x * t
    curr.y = curr.y + force.y * t
    curr.z = curr.z + force.z * t

    // --- positional lock blend --------------------------------------------
    const lock = config.lockPosOffset
    curr.x = curr.x * (1.0 - lock.x) + want.x * lock.x
    curr.y = curr.y * (1.0 - lock.y) + want.y * lock.y
    curr.z = curr.z * (1.0 - lock.z) + want.z * lock.z

    // --- rotation toward the pin ------------------------------------------
    this._dir.iSet(curr.x - pin.x, curr.y - pin.y, curr.z - pin.z)
    const newDirection = this.pinObjectRotation.invert().toCore()
    this._dir.setFromCore(mat4.fromRotation(newDirection).multiplyDirection(this._dir.toCore()))
    let newRotation = MQuat.rotationFromTo(this.negVecDown, this._dir)
    if (isNaN(newRotation.x)) newRotation = MQuat.quatIdentity()
    newRotation = this.pinObjectRotation.multiply(newRotation)
    this.currSimulateObjectRotation = newRotation

    // --- write back to the engine -----------------------------------------
    if (!config.lockLocalPosition && !owner.disableSetPosition) {
      this.simulateObjectTransform.setWorldPosition(curr.toCore())
    } else {
      this.simulateObjectTransform.setWorldPosition(want.toCore())
    }
    if (!config.lockLocalRotate && !owner.disableSetRotation) {
      const newRotate1 = this.currSimulateObjectRotation.toCore().multiply(this.startSimulateObjectRotation)
      this.simulateObjectTransform.setWorldRotation(newRotate1)
    }
  }
}

interface SimParams {
  scaleLength: number
  dampingCoef: number
  physicsStep: number
  forceFadeCoef: number
  tension: number
}

// ---------------------------------------------------------------------------
// Physics component
// ---------------------------------------------------------------------------

@component
export class Physics extends BaseScriptComponent {
  @input
  mainObject: SceneObject[]

  @ui.separator
  @input
  gravityVec: vec3

  @input
  scaleLength: number = 1.0

  @input
  randomLength: boolean

  @input
  @widget(new SliderWidget(0.0, 5.0, 0.001))
  @showIf("randomLength")
  randomRangeLength: number = 0.0

  @ui.separator
  @input
  presets: boolean

  @input("int")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("one", 1),
      new ComboBoxItem("two", 2),
      new ComboBoxItem("three", 3),
      new ComboBoxItem("four", 4)
    ])
  )
  @showIf("presets")
  presetType: number = 1

  @ui.separator
  @ui.group_start("Force_controll")
  @input
  @widget(new SliderWidget(0.0, 10.0, 0.001))
  dampingCoef: number = 1.0

  @input
  randomDamping: boolean

  @input
  @widget(new SliderWidget(0.0, 2.0, 0.001))
  @showIf("randomDamping")
  randomRangeDamping: number = 0.0

  @ui.separator
  @input
  @widget(new SliderWidget(0.0, 2.0, 0.001))
  physicsStep: number = 1.0

  @input
  randomStep: boolean

  @input
  @widget(new SliderWidget(0.0, 2.0, 0.001))
  @showIf("randomStep")
  randomRangeStep: number = 0.0

  @ui.separator
  @input
  @widget(new SliderWidget(0.0, 1.0, 0.001))
  forceFadeCoef: number = 0.9

  @input
  randomFade: boolean

  @input
  @widget(new SliderWidget(0.0, 1.0, 0.001))
  @showIf("randomFade")
  randomRangeFade: number = 0.0

  @ui.separator
  @input
  @widget(new SliderWidget(0.0, 1.0, 0.001))
  tension: number = 1.0

  @input
  randomTension: boolean

  @input
  @widget(new SliderWidget(0.0, 1.0, 0.001))
  @showIf("randomTension")
  randomRangeTension: number = 0.0

  @ui.group_end
  @ui.separator
  @ui.group_start("Lock_controll")
  @input
  @widget(new SliderWidget(0.0, 1.0, 0.001))
  lerpPositionsCoef: number = 0.7

  @input
  @widget(new SliderWidget(0.0, 1.0, 0.001))
  lockX: number = 0.0

  @input
  @widget(new SliderWidget(0.0, 1.0, 0.001))
  lockY: number = 0.0

  @input
  @widget(new SliderWidget(0.0, 1.0, 0.001))
  lockZ: number = 0.0

  @input
  disableSetPosition: boolean

  @input
  disableSetRotation: boolean

  @ui.group_end
  @input
  Colliders: SceneObject[]

  // --- expanded controls ---------------------------------------------------
  @ui.separator
  @ui.group_start("Advanced")
  @input
  @hint("Multiplier applied to a collider's world X scale to get its radius (original hard-coded value was 6.5).")
  @widget(new SliderWidget(0.0, 20.0, 0.01))
  colliderRadiusScale: number = 6.5

  @input
  @hint("Turn collider response on/off without clearing the Colliders list.")
  enableColliders: boolean = true

  @input
  @hint("Scales the gravity vector (1 = unchanged).")
  @widget(new SliderWidget(0.0, 5.0, 0.001))
  gravityScale: number = 1.0

  @input
  @hint("Clamp per-step velocity for stability. 0 = unlimited (original behaviour).")
  @widget(new SliderWidget(0.0, 100.0, 0.01))
  maxSpeed: number = 0.0

  @ui.group_end
  @ui.separator
  @ui.group_start("Wind")
  @input
  enableWind: boolean = false

  @input
  @showIf("enableWind")
  windDirection: vec3

  @input
  @showIf("enableWind")
  @widget(new SliderWidget(0.0, 50.0, 0.01))
  windStrength: number = 0.0

  @input
  @hint("0 = steady wind. Higher values add sinusoidal gusts over time.")
  @showIf("enableWind")
  @widget(new SliderWidget(0.0, 5.0, 0.001))
  windTurbulence: number = 0.0

  @input
  @showIf("enableWind")
  @widget(new SliderWidget(0.1, 10.0, 0.01))
  windFrequency: number = 3.0

  @ui.group_end
  @ui.separator
  @ui.group_start("Performance")
  @input("int")
  @hint("Run the simulation every N frames (1 = every frame). Higher = cheaper but choppier.")
  @widget(new SliderWidget(1, 10, 1))
  updateInterval: number = 1

  @input
  @hint("Use direct quaternion rotation instead of the euler round-trip. Faster; may slightly change the look.")
  useDirectRotation: boolean = false

  @ui.group_end

  // --- shared per-frame state (read by PhysicPoint) ------------------------
  deltaTime: number = 0.0
  externalForce: MVec3 = new MVec3(0.0, 0.0, 0.0)
  colliderCenters: MVec3[] = []
  colliderRadii: number[] = []
  activeColliderCount: number = 0

  private collidersTransform: Transform[] = []
  private points: PhysicPoint[] = []
  private time: number = 0.0
  private frameCounter: number = 0
  private accumDt: number = 0.0

  onAwake(): void {
    this.applyPresets()

    if (this.updateInterval < 1) this.updateInterval = 1

    // Cache collider transforms + pre-allocate the per-frame cache slots.
    const collidersCount = this.Colliders.length
    for (let i = 0; i < collidersCount; i++) {
      this.collidersTransform.push(this.Colliders[i].getTransform())
      this.colliderCenters.push(new MVec3(0.0, 0.0, 0.0))
      this.colliderRadii.push(0.0)
    }

    // Disabled random ranges collapse to zero (mirrors original behaviour).
    if (!this.randomLength) this.randomRangeLength = 0.0
    if (!this.randomDamping) this.randomRangeDamping = 0.0
    if (!this.randomStep) this.randomRangeStep = 0.0
    if (!this.randomFade) this.randomRangeFade = 0.0
    if (!this.randomTension) this.randomRangeTension = 0.0

    const delayInit = this.createEvent("DelayedCallbackEvent")
    delayInit.bind(() => this.init())
    delayInit.reset(0.1)

    const onEnableEvent = this.createEvent("OnEnableEvent")
    onEnableEvent.bind(() => this.init())

    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  /** Settles every joint at rest. Call it after moving the rig in one jump. */
  reset(): void {
    this.points.forEach((point) => point.snapToRest())
  }

  private onUpdate(): void {
    const dt = getDeltaTime()
    this.time += dt
    this.accumDt += dt
    this.frameCounter++

    // Frame-skip LOD: only step the simulation every `updateInterval` frames.
    if (this.frameCounter < this.updateInterval) return
    this.deltaTime = this.accumDt
    this.frameCounter = 0
    this.accumDt = 0.0

    this.updateExternalForce()
    this.updateColliderCache()

    const points = this.points
    for (let i = 0; i < points.length; i++) {
      points[i].update()
    }
  }

  // Combine gravity + wind once per frame instead of per point.
  private updateExternalForce(): void {
    let ex = this.gravityVec.x * this.gravityScale
    let ey = this.gravityVec.y * this.gravityScale
    let ez = this.gravityVec.z * this.gravityScale

    if (this.enableWind) {
      const turb = 1.0 + this.windTurbulence * Math.sin(this.time * this.windFrequency)
      const w = this.windStrength * turb
      ex += this.windDirection.x * w
      ey += this.windDirection.y * w
      ez += this.windDirection.z * w
    }

    this.externalForce.iSet(ex, ey, ez)
  }

  // Read every collider's world position + radius ONCE per frame.
  private updateColliderCache(): void {
    if (!this.enableColliders) {
      this.activeColliderCount = 0
      return
    }
    const ct = this.collidersTransform
    const n = ct.length
    for (let i = 0; i < n; i++) {
      this.colliderCenters[i].setFromCore(ct[i].getWorldPosition())
      this.colliderRadii[i] = ct[i].getWorldScale().x * this.colliderRadiusScale
    }
    this.activeColliderCount = n
  }

  private applyPresets(): void {
    if (!this.presets) return

    if (this.presetType == 1) {
      this.dampingCoef = 1.479
      this.physicsStep = 1.635
      this.forceFadeCoef = 0.568
      this.tension = 1.0
      this.lerpPositionsCoef = 0.68
      this.lockX = 0.146
      this.lockY = 0.214
      this.lockZ = 0.229
    }

    if (this.presetType == 2) {
      this.dampingCoef = 1.01
      this.physicsStep = 1.281
      this.forceFadeCoef = 0.724
      this.tension = 1.0
      this.lerpPositionsCoef = 0.68
      this.lockX = 0.005
      this.lockY = 0.068
      this.lockZ = 0.052
    }

    if (this.presetType == 3) {
      this.dampingCoef = 1.792
      this.physicsStep = 1.458
      this.forceFadeCoef = 0.734
      this.tension = 1.0
      this.lerpPositionsCoef = 0.68
      this.lockX = 0.005
      this.lockY = 0.0
      this.lockZ = 0.0
    }

    if (this.presetType == 4) {
      this.dampingCoef = 1.417
      this.physicsStep = 1.104
      this.forceFadeCoef = 0.568
      this.tension = 0.146
      this.lerpPositionsCoef = 0.68
      this.lockX = 0.005
      this.lockY = 0.0
      this.lockZ = 0.0
    }
  }

  private init(): void {
    // Build the chain once. Both the delayed init and OnEnableEvent call
    // this; when the object is enabled from code they both fire, and the
    // second pass would run on the hierarchy buildHierarchy() already
    // flattened, producing a duplicate set of points pinned straight to
    // the root that overrides the real chain every frame.
    if (this.points.length > 0) return
    for (let i = 0; i < this.mainObject.length; i++) {
      if (this.mainObject[i]) {
        let lengthRandomCoef = Math.random() * (this.randomRangeLength * 2.0) - this.randomRangeLength

        if (lengthRandomCoef < 0) lengthRandomCoef = 1.0 / (Math.abs(lengthRandomCoef) + 1.0)
        else if (lengthRandomCoef > 0) lengthRandomCoef += 1.0
        else lengthRandomCoef = 1.0

        const sim: SimParams = {
          scaleLength: this.scaleLength * lengthRandomCoef,
          dampingCoef:
            50.0 * (this.dampingCoef + (Math.random() * (this.randomRangeDamping * 2.0) - this.randomRangeDamping)),
          physicsStep: 0.1 * (this.physicsStep + (Math.random() * (this.randomRangeStep * 2.0) - this.randomRangeStep)),
          forceFadeCoef: this.forceFadeCoef + (Math.random() * (this.randomRangeFade * 2.0) - this.randomRangeFade),
          tension: this.tension + (Math.random() * (this.randomRangeTension * 2.0) - this.randomRangeTension)
        }

        this.buildHierarchy(this.mainObject[i], null, 1.0, this.mainObject[i], sim)
      }
    }
  }

  private buildHierarchy(
    mainObject: SceneObject,
    rootObject: PhysicPoint | null,
    deepNumber: number,
    mainPoint: SceneObject,
    sim: SimParams
  ): void {
    const childCount = mainObject.getChildrenCount()
    for (let i = 0; i < childCount; i++) {
      const nextObject = mainObject.getChild(i)
      const scriptComponentCount = nextObject.getComponentCount("Component.ScriptComponent")
      let cLockX = this.lockX
      let cLockY = this.lockY
      let cLockZ = this.lockZ
      let lockLocalRotate = false
      let lockLocalPosition = false
      for (let j = 0; j < scriptComponentCount; j++) {
        const scriptC: any = nextObject.getComponentByIndex("Component.ScriptComponent", j)
        if (scriptC.locker) {
          cLockX = Math.max(scriptC.lockX, cLockX)
          cLockY = Math.max(scriptC.lockY, cLockY)
          cLockZ = Math.max(scriptC.lockZ, cLockZ)
          lockLocalRotate = scriptC.lockLocalRotate
          lockLocalPosition = scriptC.lockLocalPosition
        }
      }
      const config: PointConfig = {
        pinObject: mainObject,
        simulateObject: nextObject,
        physicStep: sim.physicsStep,
        dampingCoef: sim.dampingCoef,
        tension: sim.tension,
        scaleLength: sim.scaleLength,
        forceFadeCoef: sim.forceFadeCoef,
        lockPosOffset: new vec3(cLockX, cLockY, cLockZ),
        rootClass: rootObject,
        lockLocalRotate: lockLocalRotate,
        lockLocalPosition: lockLocalPosition,
        deepNumber: deepNumber,
        mainPoint: mainPoint,
        owner: this
      }
      const point = new PhysicPoint(config)
      this.points.push(point)
      this.buildHierarchy(nextObject, point, deepNumber + 1.0, mainPoint, sim)
    }
    if (!mainPoint.isSame(mainObject)) {
      mainObject.setParent(mainPoint)
    }
  }
}
