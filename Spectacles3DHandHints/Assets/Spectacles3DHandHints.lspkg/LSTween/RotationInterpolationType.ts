/**
 * Specs Inc. 2026
 * Rotation interpolation type enum for quaternion animation. Defines LERP (linear interpolation)
 * for faster but non-spherical rotation, and SLERP (spherical linear interpolation) for smooth
 * constant-velocity rotation along the shortest arc between quaternions.
 */
export enum RotationInterpolationType {
  LERP = 0,
  SLERP = 1,
}
