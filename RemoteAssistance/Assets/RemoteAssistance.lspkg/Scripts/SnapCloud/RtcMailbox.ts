// RtcMailbox — WebRTC signaling over the Snap Cloud Postgres REST API.
//
// Implements RtcSignalTransport by exchanging SDP/ICE as rows in the
// `rtc_signals` table (migration 20260721000000_create_rtc_signals.sql):
// each side INSERTs its outbound signals and POLLs (~POLL_INTERVAL_S) for the
// other side's rows via PostgREST over HTTPS. This deliberately avoids BOTH
// broken transports — the Snap Cloud Realtime WebSocket (never answers channel
// joins on device) and the BLE phone-relay (too unstable for ICE) — using the
// one Snap Cloud service that demonstrably works on device (the DB, same path
// the app previously used). The media stays peer-to-peer WebRTC.

import { createClient, SupabaseClient } from "SupabaseClient.lspkg/supabase-snapcloud"
import { RtcKind, RtcSignalPayload, RtcSignalTransport, rtcEventName } from "../App/Types"
import { SupabaseRequirements } from "./SupabaseRequirements"

const TABLE = "rtc_signals"
// SDP/ICE are small and infrequent; sub-second polling keeps call setup snappy
// without hammering the DB.
const POLL_INTERVAL_S = 0.4

export class RtcMailbox implements RtcSignalTransport {
    private client: SupabaseClient | null = null
    private ready = false
    // Only rows with id greater than this are new to us (ignores pre-existing
    // rows from before this call started, and rows we've already consumed).
    private readCursor = 0
    // Newest row id that existed when this mailbox connected. Signaling rows
    // below it are still replayed (see connect()), but a "bye" at or below it
    // belongs to a PREVIOUS call in the same session — the session code
    // persists across calls within one lens run, so without this boundary a
    // stale bye ended every subsequent call ~2 s after it started.
    private staleBoundary = 0
    private polling = false
    private pollEvt: DelayedCallbackEvent | null = null
    private handlers = new Map<string, (p: RtcSignalPayload) => void>()

    constructor(
        private readonly script: BaseScriptComponent,
        private readonly session: string,
        /** Our sender id ("glasses") — we read rows NOT from us. */
        private readonly me: string,
        /** Where the SupabaseProject comes from (SnapCloudModule passes its
         *  SnapCloudRequirements). Omitted: the deprecated SupabaseRequirements
         *  singleton is used instead. */
        private readonly projectSource?: () => SupabaseProject | null
    ) {}

    get isConnected(): boolean {
        return this.ready
    }

    /** Fire-and-forget connect: auth, seed the cursor, start polling. */
    start(): void {
        this.connect().catch((e) => print("[RtcMailbox] init failed: " + e))
    }

    private async connect(): Promise<void> {
        const project = this.projectSource
            ? this.projectSource()
            : SupabaseRequirements.getProject("RtcMailbox")
        if (!project) {
            print("[RtcMailbox] SupabaseProject not configured — RTC signaling disabled.")
            return
        }
        // No realtime channel is ever opened here — only the DB REST API — so the
        // broken Realtime WebSocket is irrelevant to this transport.
        this.client = createClient(project.url, project.publicToken)
        // Snapchat id-token FIRST. Do NOT "optimize" this away: on device the
        // Snap Cloud client supplies the wearer's real identity for this
        // provider and it is the sign-in that actually works — skipping
        // straight to anonymous (2026-08-06) killed Glasses signaling entirely
        // (anonymous sign-ins are not enabled on this project).
        const { error } = await this.client.auth.signInWithIdToken({
            provider: "snapchat", token: "",
        })
        if (error) {
            const anon = await this.client.auth.signInAnonymously()
            if (anon.error) {
                print("[RtcMailbox] Auth failed — signaling disabled: " +
                    JSON.stringify(anon.error))
                return
            }
            print("[RtcMailbox] Auth OK (anonymous).")
        } else {
            print("[RtcMailbox] Auth OK (snapchat id-token).")
        }
        // Read from the very first row of this session (cursor 0): the Glasses
        // joins the mailbox AFTER the phone (which offers voice immediately at
        // call start), so seeding to the newest id — as this used to — made the
        // Glasses skip the phone's one-and-only voice offer and voice was never
        // answered (confirmed: glasses diag voice:-1, outVoice:0). BUT the session
        // code persists across calls within one lens run, so the full replay
        // also resurfaces the previous call's "bye" — which ended every new
        // call ~2 s in. Record the newest pre-existing id as the stale
        // boundary: signaling replays, byes at/below it are dropped in poll().
        try {
            const { data: newest } = await this.client.from(TABLE)
                .select("id")
                .eq("session", this.session)
                .order("id", { ascending: false })
                .limit(1)
            this.staleBoundary = (newest && newest[0] && typeof newest[0].id === "number")
                ? newest[0].id : 0
        } catch (e) {
            this.staleBoundary = 0 // no boundary — worst case is the old replay behavior
        }
        this.readCursor = 0
        this.ready = true
        this.startPolling()
        print("[RtcMailbox] Ready — signaling over Snap Cloud DB (session " +
            this.session + ", cursor " + this.readCursor + ").")
    }

    onRtcSignal(kind: RtcKind, from: string, cb: (p: RtcSignalPayload) => void): void {
        this.handlers.set(rtcEventName(kind, from), cb)
    }

    offRtcSignal(kind: RtcKind, from: string): void {
        this.handlers.delete(rtcEventName(kind, from))
    }

    sendRtcSignal(kind: RtcKind, from: string, payload: RtcSignalPayload): boolean {
        if (!this.ready || !this.client) return false
        const row = {
            session: this.session,
            kind,
            sender: from,
            t: payload.t,
            sdp: payload.sdp ?? null,
            cand: payload.cand ?? null,
            mid: payload.mid ?? null,
        }
        try {
            this.client.from(TABLE).insert(row).then(({ error }: any) => {
                if (error) print("[RtcMailbox] insert failed: " +
                    String((error && error.message) || error))
            })
        } catch (e) {
            print("[RtcMailbox] insert threw: " + e)
            return false
        }
        return true
    }

    /**
     * Write a diagnostic snapshot row (kind "diag") — ICE states + candidate
     * counts as JSON in the `sdp` text column, NO IPs. The peer's poller sees
     * it (sender ≠ me) but has no "diag" handler, so it's ignored; we read it
     * back with a `kind=eq.diag` REST query — the tether-free window into a
     * stuck call's Glasses side.
     */
    sendDiag(state: string): void {
        if (!this.ready || !this.client) return
        const row = { session: this.session, kind: "diag", sender: this.me, t: "diag", sdp: state }
        try {
            this.client.from(TABLE).insert(row).then(({ error }: any) => {
                if (error) print("[RtcMailbox] diag insert failed: " +
                    String((error && error.message) || error))
            })
        } catch (e) {
            // Diagnostics are strictly best-effort — never let them break a call.
        }
    }

    private startPolling(): void {
        this.pollEvt = this.script.createEvent("DelayedCallbackEvent")
        this.pollEvt.bind(() => this.poll())
        this.pollEvt.reset(POLL_INTERVAL_S)
    }

    private poll(): void {
        if (!this.client || this.polling) {
            this.reschedule()
            return
        }
        this.polling = true
        this.client.from(TABLE)
            .select("*")
            .eq("session", this.session)
            .neq("sender", this.me)
            .gt("id", this.readCursor)
            .order("id", { ascending: true })
            .limit(50)
            .then(
                ({ data, error }: any) => {
                    this.polling = false
                    if (!error && data) {
                        for (const r of data) {
                            if (typeof r.id === "number" && r.id > this.readCursor) {
                                this.readCursor = r.id
                            }
                            if (r.kind === "bye" && typeof r.id === "number" &&
                                r.id <= this.staleBoundary) {
                                print("[RtcMailbox] Skipping stale bye (row " + r.id +
                                    " predates this call).")
                                continue
                            }
                            const handler = this.handlers.get(rtcEventName(r.kind, r.sender))
                            if (handler) {
                                handler({
                                    t: r.t,
                                    sdp: r.sdp ?? undefined,
                                    cand: r.cand ?? undefined,
                                    mid: r.mid ?? undefined,
                                })
                            }
                        }
                    }
                    this.reschedule()
                },
                (_e: any) => {
                    this.polling = false
                    this.reschedule()
                }
            )
    }

    private reschedule(): void {
        if (this.pollEvt) this.pollEvt.reset(POLL_INTERVAL_S)
    }

    stop(): void {
        this.ready = false
        if (this.pollEvt) this.pollEvt.enabled = false
        this.client = null
        this.handlers.clear()
    }
}
