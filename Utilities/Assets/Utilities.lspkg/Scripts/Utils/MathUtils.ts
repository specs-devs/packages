/**
 * Specs Inc. 2026
 * Math and calculation utilities including interpolation, vector operations, quaternion conversions,
 * angle normalization, geographical calculations (Haversine distance, bearing), and easing functions.
 * Provides common mathematical operations used across Spectacles packages.
 */

/**
 * Geographic coordinate type for location-based calculations
 */
export interface GeoCoordinate {
  longitude: number;
  latitude: number;
  altitude: number;
}

/**
 * Utility class for mathematical operations and calculations
 */
export class MathUtils {
  // Small value for floating-point comparisons
  static readonly EPSILON: number = 0.000001;

  // Degrees to radians conversion constant
  static readonly DegToRad: number = Math.PI / 180;

  /**
   * Linear interpolation between two values
   * @param start - Starting value
   * @param end - Ending value
   * @param scalar - Interpolation factor (0-1)
   * @returns Interpolated value
   */
  static lerp(start: number, end: number, scalar: number): number {
    return start + (end - start) * scalar;
  }

  /**
   * Modulo operation (wraps negative values correctly)
   * @param n - Number to mod
   * @param m - Modulo value
   * @returns Modulo result
   */
  static mod(n: number, m: number): number {
    return ((n % m) + m) % m;
  }

  /**
   * Normalize angle to [-π, π] range
   * @param angle - Angle in radians
   * @returns Normalized angle
   */
  static normalizeAngle(angle: number): number {
    angle = angle % (Math.PI * 2);
    if (angle > Math.PI) {
      angle -= Math.PI * 2;
    } else if (angle < -Math.PI) {
      angle += Math.PI * 2;
    }
    return angle;
  }

  /**
   * Convert quaternion to roll angle
   * @param quaternion - Input quaternion
   * @returns Roll angle in radians
   */
  static quaternionToRoll(quaternion: quat): number {
    const sinRoll = 2.0 * (quaternion.w * quaternion.z + quaternion.x * quaternion.y);
    const cosRoll = 1.0 - 2.0 * (quaternion.y * quaternion.y + quaternion.z * quaternion.z);
    return Math.atan2(sinRoll, cosRoll);
  }

  /**
   * Convert quaternion to pitch angle
   * @param quaternion - Input quaternion
   * @returns Pitch angle in radians
   */
  static quaternionToPitch(quaternion: quat): number {
    const roll = MathUtils.quaternionToRoll(quaternion);
    const inverseRollQuaternion = quat.fromEulerVec(new vec3(0, 0, -roll));
    quaternion = quaternion.multiply(inverseRollQuaternion);

    let sinPitch = 2.0 * (quaternion.w * quaternion.x - quaternion.y * quaternion.z);
    // Clamp sinPitch between -1 and 1 to prevent NaN results from asin
    sinPitch = Math.max(-1.0, Math.min(1.0, sinPitch));

    return Math.asin(sinPitch);
  }

  /**
   * Convert quaternion to Euler angles (pitch, yaw, roll)
   * Handles singularities at north and south poles
   * @param quaternion - Input quaternion
   * @returns vec3 with pitch, yaw, roll in radians
   */
  static quaternionToEuler(quaternion: quat): vec3 {
    const singularityTestValue = 0.4999;
    const sqw: number = quaternion.w * quaternion.w;
    const sqx: number = quaternion.x * quaternion.x;
    const sqy: number = quaternion.y * quaternion.y;
    const sqz: number = quaternion.z * quaternion.z;

    const unit: number = sqx + sqy + sqz + sqw;
    const test: number = quaternion.x * quaternion.y + quaternion.z * quaternion.w;

    let yaw: number, pitch: number, roll: number;

    // singularity at north pole
    if (test > singularityTestValue * unit) {
      yaw = 2 * Math.atan2(quaternion.x, quaternion.w);
      pitch = Math.PI / 2;
      roll = 0;
    }
    // singularity at south pole
    else if (test < -singularityTestValue * unit) {
      yaw = -2 * Math.atan2(quaternion.x, quaternion.w);
      pitch = -Math.PI / 2;
      roll = 0;
    } else {
      yaw = Math.atan2(2 * quaternion.y * quaternion.w - 2 * quaternion.x * quaternion.z, sqx - sqy - sqz + sqw);
      pitch = Math.asin((2 * test) / unit);
      roll = Math.atan2(2 * quaternion.x * quaternion.w - 2 * quaternion.y * quaternion.z, -sqx + sqy - sqz + sqw);
    }

    return new vec3(
      pitch < 0 ? pitch + Math.PI * 2 : pitch,
      yaw < 0 ? yaw + Math.PI * 2 : yaw,
      roll < 0 ? roll + Math.PI * 2 : roll
    );
  }

  /**
   * Interpolate between two rotations using spherical linear interpolation
   * @param startRotation - Starting rotation quaternion
   * @param endRotation - Ending rotation quaternion
   * @param peakVelocity - Velocity of interpolation
   * @returns Interpolated quaternion
   */
  static interpolateRotation(startRotation: quat, endRotation: quat, peakVelocity: number): quat {
    const step = peakVelocity * getDeltaTime();
    return quat.slerp(startRotation, endRotation, step);
  }

  /**
   * Elastic ease-out easing function
   * @param x - Progress value (0-1)
   * @returns Eased value
   */
  static easeOutElastic(x: number): number {
    const constant = (2 * Math.PI) / 3;
    return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * constant) + 1;
  }

  /**
   * Set vec2 values from source vector
   * @param v - Target vector to modify
   * @param source - Source vector to copy from
   */
  static setVec2(v: vec2, source: vec2): void {
    v.x = source.x;
    v.y = source.y;
  }

  /**
   * Calculate Haversine distance between two geographic coordinates
   * Returns distance in meters using Earth's radius
   * @param location1 - First geographic coordinate
   * @param location2 - Second geographic coordinate
   * @returns Distance in meters
   */
  static haversineDistance(location1: GeoCoordinate, location2: GeoCoordinate): number {
    const long1 = location1.longitude * MathUtils.DegToRad;
    const lat1 = location1.latitude * MathUtils.DegToRad;
    const long2 = location2.longitude * MathUtils.DegToRad;
    const lat2 = location2.latitude * MathUtils.DegToRad;
    const r = 6371 * 1000; // Earth's radius in meters

    const a = Math.sin((lat2 - lat1) / 2);
    const b = Math.cos(lat1);
    const c = Math.cos(lat2);
    const d = Math.sin((long2 - long1) / 2);
    const e = a * a + b * c * d * d;
    const sqrt_e = Math.sqrt(e);
    const distance = 2 * r * Math.asin(sqrt_e);
    return distance;
  }

  /**
   * Calculate bearing between two geographic coordinates
   * @param start - Starting geographic coordinate
   * @param end - Ending geographic coordinate
   * @returns Bearing in radians
   */
  static calculateBearing(start: GeoCoordinate, end: GeoCoordinate): number {
    const startLat = start.latitude * MathUtils.DegToRad;
    const startLng = start.longitude * MathUtils.DegToRad;
    const endLat = end.latitude * MathUtils.DegToRad;
    const endLng = end.longitude * MathUtils.DegToRad;

    const dLng = endLng - startLng;

    const y = Math.sin(dLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

    const bearing = Math.atan2(y, x);

    return bearing;
  }
}
