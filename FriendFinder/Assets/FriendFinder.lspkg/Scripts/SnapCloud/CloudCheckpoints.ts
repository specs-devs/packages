// CloudCheckpoints — checkpoint geofence detection + in-app "was here" notes on
// Snap Cloud (Supabase). Part of the productionization layer (position history
// + checkpoints), decoupled entirely from the ephemeral WebRTC media path.
//
// Data model (supabase/migrations/*_create_checkpoints.sql):
//   • checkpoints        — named places (marked from the phone).
//   • checkpoint_visits  — an actor entered a checkpoint radius at entered_at.
//
// Transport is PostgREST POLLING, not the Realtime WebSocket: this Snap Cloud
// project's Realtime channels don't reach SUBSCRIBED on device (see
// Realtime / rtc_signals), so we poll for new visit rows the same way
// RtcMailbox polls signaling. "In-app realtime" here = live while the app
// is open, delivered by a short poll — not APNs push.
//
// Reuses CloudPathLogger's single authenticated client (getClient / isReady),
// so we don't sign in to Snap Cloud twice.

import { CloudPathLogger } from "./CloudPathLogger"
import { haversineMeters } from "../Geolocation/GeoMath"

export interface CheckpointVisitNote {
    who: string          // actor display/device name ("Friend" / "Phone A")
    checkpoint: string   // checkpoint label
    ageS: number         // seconds since entered_at
}

// Entry counts within this radius of a checkpoint.
const GEOFENCE_RADIUS_M = 25
// Don't re-log the same (role, checkpoint) inside this window.
const REVISIT_DEBOUNCE_S = 120
const CHECKPOINT_RELOAD_S = 20
const VISIT_POLL_S = 4

export class CloudCheckpoints {
    private checkpoints: { id: number; name: string; lat: number; lon: number }[] = []
    private lastVisitAt: { [key: string]: number } = {}
    private visitCursor = 0
    // First poll only establishes the baseline id so we don't fire a burst of
    // notifications for visits that predate this app session.
    private primed = false
    private started = false
    private reloadEvt: DelayedCallbackEvent | null = null
    private pollEvt: DelayedCallbackEvent | null = null

    /** Fired for a NEW visit by the OTHER actor (role='friend') — wire to a banner. */
    onVisit: ((note: CheckpointVisitNote) => void) | null = null

    constructor(
        private readonly script: BaseScriptComponent,
        private readonly cloud: CloudPathLogger,
    ) {}

    start(): void {
        if (this.started) return
        this.started = true
        this.scheduleReload(0.5)
        this.schedulePoll(VISIT_POLL_S)
    }

    stop(): void {
        this.started = false
        if (this.reloadEvt) this.reloadEvt.enabled = false
        if (this.pollEvt) this.pollEvt.enabled = false
    }

    /** Feed every fix here; inserts a debounced visit when inside a checkpoint. */
    noteFix(role: "self" | "friend", who: string, lat: number, lon: number): void {
        const client = this.cloud.getClient()
        if (!client || !this.cloud.isReady() || this.checkpoints.length === 0) return
        const now = getTime()
        for (const cp of this.checkpoints) {
            if (haversineMeters(lat, lon, cp.lat, cp.lon) > GEOFENCE_RADIUS_M) continue
            const key = role + "|" + cp.id
            const last = this.lastVisitAt[key]
            if (last !== undefined && now - last < REVISIT_DEBOUNCE_S) continue
            this.lastVisitAt[key] = now
            try {
                client.from("checkpoint_visits").insert({
                    session: this.cloud.getSessionId(),
                    checkpoint_id: cp.id,
                    checkpoint_name: cp.name,
                    role: role,
                    device_name: who,
                    lat: lat,
                    lon: lon,
                }).then(({ error }: any) => {
                    if (error) print("[Checkpoints] visit insert failed: " + (error.message || error))
                    else print("[Checkpoints] " + who + " entered '" + cp.name + "'")
                })
            } catch (e) {
                print("[Checkpoints] visit insert threw: " + e)
            }
        }
    }

    // ── Checkpoint list (periodic reload so newly-marked ones appear) ────────

    private scheduleReload(delayS: number): void {
        if (!this.reloadEvt) {
            this.reloadEvt = this.script.createEvent("DelayedCallbackEvent")
            this.reloadEvt.bind(() => {
                this.loadCheckpoints()
                if (this.started) this.reloadEvt!.reset(CHECKPOINT_RELOAD_S)
            })
        }
        this.reloadEvt.reset(delayS)
    }

    private loadCheckpoints(): void {
        const client = this.cloud.getClient()
        if (!client || !this.cloud.isReady()) return
        try {
            client.from("checkpoints")
                .select("id,name,lat,lon")
                .eq("session", this.cloud.getSessionId())
                .then(({ data, error }: any) => {
                    if (error) { print("[Checkpoints] load failed: " + (error.message || error)); return }
                    if (data) {
                        this.checkpoints = data.map((r: any) => ({
                            id: r.id, name: r.name, lat: r.lat, lon: r.lon,
                        }))
                    }
                })
        } catch (e) {
            print("[Checkpoints] load threw: " + e)
        }
    }

    // ── Visit polling (the "in-app realtime" notification feed) ──────────────

    private schedulePoll(delayS: number): void {
        if (!this.pollEvt) {
            this.pollEvt = this.script.createEvent("DelayedCallbackEvent")
            this.pollEvt.bind(() => {
                this.pollVisits()
                if (this.started) this.pollEvt!.reset(VISIT_POLL_S)
            })
        }
        this.pollEvt.reset(delayS)
    }

    private pollVisits(): void {
        const client = this.cloud.getClient()
        if (!client || !this.cloud.isReady()) return
        try {
            client.from("checkpoint_visits")
                .select("id,checkpoint_name,role,device_name,entered_at")
                .eq("session", this.cloud.getSessionId())
                .eq("role", "friend")   // only notify about the OTHER actor
                .gt("id", this.visitCursor)
                .order("id")
                .then(({ data, error }: any) => {
                    if (error) { print("[Checkpoints] visit poll failed: " + (error.message || error)); return }
                    if (!data || data.length === 0) { this.primed = true; return }
                    for (const row of data) {
                        if (row.id > this.visitCursor) this.visitCursor = row.id
                        // Baseline pass: adopt the newest id but don't notify for
                        // pre-session history.
                        if (!this.primed) continue
                        const ageS = ageSeconds(row.entered_at)
                        if (this.onVisit) {
                            this.onVisit({
                                who: row.device_name || "Friend",
                                checkpoint: row.checkpoint_name,
                                ageS,
                            })
                        }
                    }
                    this.primed = true
                })
        } catch (e) {
            print("[Checkpoints] visit poll threw: " + e)
        }
    }
}

/** Seconds since an ISO timestamptz string (safe: 0 on parse failure). */
function ageSeconds(enteredAt: string): number {
    const t = Date.parse(enteredAt)
    if (isNaN(t)) return 0
    return Math.max(0, (Date.now() - t) / 1000)
}
