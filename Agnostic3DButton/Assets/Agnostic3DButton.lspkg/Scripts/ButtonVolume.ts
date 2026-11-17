/**
 * The made-up geometric volume of an Agnostic3DButton, in the button's local space.
 *
 * The top face of the button is the plane y = 0 and the press direction is local -Y:
 *   - hover band: 0 < y <= hoverHeight
 *   - press band: -travel <= y <= 0 (depth = -y)
 * Laterally the volume is a box (|x| <= size.x / 2, |z| <= size.y / 2) or a cylinder
 * (x² + z² <= (size.x / 2)²). Everything is in the button's local units (cm at scale 1),
 * so scaling the button scales its volume. No physics is involved.
 */

export enum ButtonShape {
  Box = 0,
  Cylinder = 1,
}

export interface VolumeSpec {
  shape: ButtonShape
  /** Box: width (x) / depth (z). Cylinder: x = diameter (y unused). */
  size: vec2
  /** Press depth along local -Y from the top face. */
  travel: number
  /** Height above the top face where the finger counts as hovering. */
  hoverHeight: number
}

/** Extra depth below `travel` where an engaged finger still holds the button fully pressed. */
export const OVERSHOOT_FACTOR = 1.5

export function isInsideFootprint(spec: VolumeSpec, local: vec3, margin: number = 0): boolean {
  if (spec.shape === ButtonShape.Cylinder) {
    const r = spec.size.x / 2 + margin
    return local.x * local.x + local.z * local.z <= r * r
  }
  return Math.abs(local.x) <= spec.size.x / 2 + margin && Math.abs(local.z) <= spec.size.y / 2 + margin
}

/** True when the point is in the hover band or anywhere above the top face inside the footprint. */
export function isAboveTop(spec: VolumeSpec, local: vec3): boolean {
  return local.y >= 0 && local.y <= spec.hoverHeight && isInsideFootprint(spec, local)
}

/** True when the point is between the top of the hover band and the bottom of the overshoot. */
export function isInVolume(spec: VolumeSpec, local: vec3): boolean {
  return (
    local.y <= spec.hoverHeight &&
    local.y >= -spec.travel * OVERSHOOT_FACTOR &&
    isInsideFootprint(spec, local)
  )
}

/** Press amount 0..1 for a point (0 at or above the top face, 1 at `travel` or deeper). */
export function pressAmount(spec: VolumeSpec, local: vec3): number {
  if (spec.travel <= 0) return local.y < 0 ? 1 : 0
  return MathUtils.clamp(-local.y / spec.travel, 0, 1)
}
