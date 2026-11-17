// AnnotationTypes — wire format for the remote-assistance drawing channel.
//
// The helper's phone draws on the POV video it is watching and posts drawing
// messages onto the SAME transport as the WebRTC signaling (the Snap Cloud
// `rtc_signals` DB mailbox — see RtcMailbox): rows with kind "draw",
// sender "phoneB". Two message types, discriminated by the row's `t` column:
//
//   t = "stroke" — one stroke create/update. The JSON below rides the row's
//                  `sdp` text column. Each update carries the FULL point list
//                  so far (cumulative — the receiver just rebuilds the stroke);
//                  `done: true` marks the final update.
//   t = "clear"  — remove drawings. `sdp` is optional JSON {"id": "<stroke>"}
//                  to clear one stroke; absent/empty or {"scope":"all"} clears
//                  everything.
//
// Coordinates are NORMALIZED TO THE VIDEO FRAME the annotator is viewing
// (u: 0 left → 1 right, v: 0 top → 1 bottom). If the phone letterboxes the
// video on screen, it must map touch points into frame space before sending.
//
// This file owns parsing only; rendering lives in AnnotationRenderer.ts.

export interface StrokePayload {
    /** Stroke id, unique within the call session (e.g. "s1", "s2"…). */
    id: string
    /** RGB 0..1. Optional — the receiver auto-assigns a palette color. */
    color?: [number, number, number]
    /** Stroke width as a fraction of frame height. Optional. */
    w?: number
    /** Aspect ratio (frame width / height) of the video the annotator saw.
     *  Lets the receiver reconstruct the exact framing. Optional (defaults
     *  to the Glasses camera's 4:3). */
    ar?: number
    /** True on the final update for this stroke. */
    done?: boolean
    /** Flat [u0,v0, u1,v1, …] normalized frame coords (v down). */
    pts: number[]
}

export interface ClearPayload {
    /** Clear one stroke by id; absent = clear all. */
    id?: string
    scope?: "all"
}

/** Parse a stroke JSON string; null (with a log) on malformed input. */
export function parseStrokePayload(json: string | undefined): StrokePayload | null {
    if (!json) return null
    let data: any
    try {
        data = JSON.parse(json)
    } catch (e) {
        print("[AnnotationTypes] Bad stroke JSON: " + json)
        return null
    }
    if (!data || typeof data.id !== "string" || !Array.isArray(data.pts)) return null
    // pts must be an even-length list of finite numbers.
    if (data.pts.length % 2 !== 0) return null
    for (const n of data.pts) {
        if (typeof n !== "number" || !isFinite(n)) return null
    }
    return {
        id: data.id,
        color: Array.isArray(data.color) && data.color.length === 3 ? data.color : undefined,
        w: typeof data.w === "number" ? data.w : undefined,
        ar: typeof data.ar === "number" && data.ar > 0 ? data.ar : undefined,
        done: data.done === true,
        pts: data.pts,
    }
}

/** Parse a clear JSON string (may legitimately be empty = clear all). */
export function parseClearPayload(json: string | undefined): ClearPayload {
    if (!json) return {}
    try {
        const data = JSON.parse(json)
        if (data && typeof data.id === "string") return { id: data.id }
    } catch (e) {
        // Malformed clear payloads still clear everything — safest interpretation.
    }
    return {}
}
