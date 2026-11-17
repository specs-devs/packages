// Pure geo helpers for the AR people finder.

const EARTH_RADIUS_METERS = 6371000;

// All math stays metric (GPS is meters); only display strings use feet/miles,
// matching the iOS app's road-style units.
export const FEET_PER_METER = 3.28084;
export const FEET_PER_MILE = 5280;

/** "618 ft" below 1000 ft, "1.24 mi" above — mirrors the phone app. */
export function formatFeetMiles(meters: number): string {
    const feet = meters * FEET_PER_METER;
    if (feet < 1000) {
        return feet.toFixed(0) + " ft";
    }
    return (feet / FEET_PER_MILE).toFixed(2) + " mi";
}

export function toRad(deg: number): number {
    return (deg * Math.PI) / 180;
}

export function toDeg(rad: number): number {
    return (rad * 180) / Math.PI;
}

/**
 * Haversine distance in meters between two lat/lon points.
 */
export function haversineMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_METERS * c;
}

/**
 * Initial bearing from (lat1, lon1) to (lat2, lon2) in degrees, clockwise from true north.
 */
export function initialBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const y =
        Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
    const x =
        Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
        Math.sin(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.cos(toRad(lon2 - lon1));
    let bearing = toDeg(Math.atan2(y, x));
    bearing = (bearing + 360) % 360;
    return bearing;
}

/**
 * Convert a target bearing (clockwise from north) and the user's current heading
 * (clockwise from north) into a world-space direction vector.
 *
 * Lens world coordinates: +X right, +Y up, -Z forward.
 * Heading 0 means facing north, so forward (-Z) maps to north.
 */
export function directionFromHeading(
    targetBearingDeg: number,
    userHeadingDeg: number
): vec3 {
    const relativeDeg = targetBearingDeg - userHeadingDeg;
    const rad = toRad(relativeDeg);
    // north => -Z, east => +X
    const x = Math.sin(rad);
    const z = -Math.cos(rad);
    return new vec3(x, 0, z).normalize();
}

/**
 * Signed shortest angular difference (b - a) wrapped to [-180, 180] degrees.
 */
export function shortestAngleDeg(aDeg: number, bDeg: number): number {
    let d = (bDeg - aDeg) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
}

/**
 * Frame-rate-independent exponential smoothing factor for lerp-style filters:
 * value += (target - value) * smoothFactor(rate, dt)
 */
export function smoothFactor(ratePerSecond: number, dt: number): number {
    return 1 - Math.exp(-ratePerSecond * dt);
}
