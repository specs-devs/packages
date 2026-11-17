// FriendPositionEstimator — "most probable position" of the friend when the live
// link degrades. This is the resilience layer the design calls for: media is
// best-effort live (WebRTC, no buffering), but POSITION stays useful through a
// dropout by extrapolating from the recently-logged track.
//
// Model (the "heading extrapolation" option chosen in design):
//   • fresh  (newest fix younger than STALE_AFTER_S)  → report it as-is.
//   • stale  → project the last-known fix forward along the recent velocity/
//     heading (derived from the last two fixes), capped at MAX_EXTRAPOLATE_S so
//     a long outage doesn't fling the marker across the map. Beyond the cap we
//     just hold last-known.
//
// Speeds are clamped to a human ceiling and near-stationary tracks don't drift,
// so GPS jitter can't manufacture motion. Snap Cloud history can seed this on a
// cold start (see CloudPathLogger) — the in-memory ring covers the live dropout.

import { haversineMeters, initialBearing, toRad, toDeg } from "./GeoMath"

const EARTH_RADIUS_METERS = 6371000
// Newest fix older than this ⇒ treat as stale and start estimating.
const STALE_AFTER_S = 4
// Never project motion past this age — hold last-known beyond it.
const MAX_EXTRAPOLATE_S = 30
// Reject GPS-noise "teleports": cap projected speed at a fast run (~8 m/s).
const MAX_SPEED_MPS = 8
// Below this speed the friend is effectively standing still — don't drift.
const MIN_MOVING_MPS = 0.2
const MAX_HISTORY = 8

export interface PositionEstimate {
    lat: number
    lon: number
    /** Seconds since the last real fix. */
    ageS: number
    /** True when the position is extrapolated/held rather than a live fix. */
    estimated: boolean
    accuracyM: number | null
}

export class FriendPositionEstimator {
    private history: { t: number; lat: number; lon: number }[] = []
    private lastAccuracy: number | null = null

    /** Record a real fix (called from every friend GPS update). */
    addFix(lat: number, lon: number, accuracyM: number | null): void {
        this.history.push({ t: getTime(), lat, lon })
        if (this.history.length > MAX_HISTORY) this.history.shift()
        this.lastAccuracy = accuracyM
    }

    /** Seed from a Snap Cloud last-known row on cold start (no live fixes yet). */
    seed(lat: number, lon: number, accuracyM: number | null, ageS: number): void {
        if (this.history.length > 0) return // live data wins
        this.history.push({ t: getTime() - Math.max(0, ageS), lat, lon })
        this.lastAccuracy = accuracyM
    }

    hasData(): boolean {
        return this.history.length > 0
    }

    /** Best estimate of where the friend is NOW; null until the first fix. */
    estimate(): PositionEstimate | null {
        if (this.history.length === 0) return null
        const last = this.history[this.history.length - 1]
        const ageS = getTime() - last.t
        if (ageS <= STALE_AFTER_S) {
            return { lat: last.lat, lon: last.lon, ageS, estimated: false, accuracyM: this.lastAccuracy }
        }
        const vel = this.recentVelocity()
        if (!vel) {
            // No usable motion — hold last-known, flagged as estimated.
            return { lat: last.lat, lon: last.lon, ageS, estimated: true, accuracyM: this.lastAccuracy }
        }
        const projectS = Math.min(ageS, MAX_EXTRAPOLATE_S)
        const distM = Math.min(vel.speedMps, MAX_SPEED_MPS) * projectS
        const p = offsetMeters(last.lat, last.lon, vel.courseDeg, distM)
        return { lat: p.lat, lon: p.lon, ageS, estimated: true, accuracyM: this.lastAccuracy }
    }

    reset(): void {
        this.history = []
        this.lastAccuracy = null
    }

    /** Velocity from the last two fixes; null if too few / too old / stationary. */
    private recentVelocity(): { speedMps: number; courseDeg: number } | null {
        if (this.history.length < 2) return null
        const b = this.history[this.history.length - 1]
        const a = this.history[this.history.length - 2]
        const dt = b.t - a.t
        if (dt <= 0.01) return null
        const speed = haversineMeters(a.lat, a.lon, b.lat, b.lon) / dt
        if (speed < MIN_MOVING_MPS) return null
        return { speedMps: speed, courseDeg: initialBearing(a.lat, a.lon, b.lat, b.lon) }
    }
}

/** Offset a lat/lon by distanceM along bearingDeg (equirectangular — exact
 *  enough for the <100 m projections that matter here). */
function offsetMeters(
    lat: number,
    lon: number,
    bearingDeg: number,
    distanceM: number
): { lat: number; lon: number } {
    const br = toRad(bearingDeg)
    const dLat = toDeg((distanceM * Math.cos(br)) / EARTH_RADIUS_METERS)
    const dLon = toDeg((distanceM * Math.sin(br)) / (EARTH_RADIUS_METERS * Math.cos(toRad(lat))))
    return { lat: lat + dLat, lon: lon + dLon }
}
