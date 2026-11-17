/**
 * SPECS Inc. 2027
 * The real color camera of the glasses: focal length, principal point, resolution, and where the camera sits
 * and points relative to the device center. The portal draws the virtual scene through this camera model
 * (not the Lens camera's field of view), so virtual objects land exactly where the camera sees them.
 * Only available on Specs; the Lens Studio editor has no physical camera, so this returns null there.
 */
export interface CameraCalibration {
  /** Focal length in pixels at `resolution`. */
  focal: number[]
  /** Principal point in pixels at `resolution`, origin at the top-left. */
  principal: number[]
  /** Pixels (width, height) the focal length and principal point refer to. */
  resolution: number[]
  /** Camera position in the device reference space (the Lens camera's space), cm. */
  p: number[]
  /** Camera rotation in the device reference space, quaternion [x, y, z, w]; the camera looks along -Z. */
  q: number[]
}

function r(v: number, digits: number): number {
  const f = Math.pow(10, digits)
  return Math.round(v * f) / f
}

function sub(a: vec3, b: vec3): vec3 {
  return new vec3(a.x - b.x, a.y - b.y, a.z - b.z)
}

function unit(a: vec3): vec3 {
  const l = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z) || 1
  return new vec3(a.x / l, a.y / l, a.z / l)
}

function cross(a: vec3, b: vec3): vec3 {
  return new vec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
}

/** Quaternion [x, y, z, w] of the rotation whose columns are the axes x, y, z. */
function quaternionFromAxes(x: vec3, y: vec3, z: vec3): number[] {
  const m00 = x.x, m01 = y.x, m02 = z.x
  const m10 = x.y, m11 = y.y, m12 = z.y
  const m20 = x.z, m21 = y.z, m22 = z.z
  const trace = m00 + m11 + m22
  let qx: number, qy: number, qz: number, qw: number
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2
    qw = 0.25 * s
    qx = (m21 - m12) / s
    qy = (m02 - m20) / s
    qz = (m10 - m01) / s
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2
    qw = (m21 - m12) / s
    qx = 0.25 * s
    qy = (m01 + m10) / s
    qz = (m02 + m20) / s
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2
    qw = (m02 - m20) / s
    qx = (m01 + m10) / s
    qy = 0.25 * s
    qz = (m12 + m21) / s
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2
    qw = (m10 - m01) / s
    qx = (m02 + m20) / s
    qy = (m12 + m21) / s
    qz = 0.25 * s
  }
  return [r(qx, 6), r(qy, 6), r(qz, 6), r(qw, 6)]
}

/** The calibration of the default color camera, or null when there is no physical camera (the editor). */
export function readCameraCalibration(log: (message: string) => void): CameraCalibration | null {
  try {
    if (global.deviceInfoSystem.isEditor()) return null
    const camera = global.deviceInfoSystem.getTrackingCameraForId(CameraModule.CameraId.Default_Color)
    if (!camera) return null
    // Two points on the optical axis give the camera's position and forward direction; one step right and one step
    // up from the image center give its other two axes (normalized screen space has its origin at the top-left).
    const center = new vec2(0.5, 0.5)
    const d1 = 10
    const d2 = 20
    const c1 = camera.unproject(center, d1)
    const c2 = camera.unproject(center, d2)
    const forward = unit(sub(c2, c1))
    const origin = new vec3(c1.x - forward.x * d1, c1.y - forward.y * d1, c1.z - forward.z * d1)
    const right = unit(sub(camera.unproject(new vec2(1, 0.5), d1), c1))
    const up = unit(sub(camera.unproject(new vec2(0.5, 0), d1), c1))
    // The camera looks along -Z, so +Z is behind it. Rebuild a clean right-handed basis from right and up.
    const back = unit(cross(right, up))
    const cleanUp = unit(cross(back, right))
    const out: CameraCalibration = {
      focal: [r(camera.focalLength.x, 2), r(camera.focalLength.y, 2)],
      principal: [r(camera.principalPoint.x, 2), r(camera.principalPoint.y, 2)],
      resolution: [camera.resolution.x, camera.resolution.y],
      p: [r(origin.x, 3), r(origin.y, 3), r(origin.z, 3)],
      q: quaternionFromAxes(right, cleanUp, back)
    }
    log(
      "Camera calibration: " +
        out.resolution[0] + "x" + out.resolution[1] +
        " focal " + out.focal[0] + "," + out.focal[1] +
        " offset " + out.p[0] + "," + out.p[1] + "," + out.p[2]
    )
    return out
  } catch (e) {
    log("No camera calibration: " + e)
    return null
  }
}
