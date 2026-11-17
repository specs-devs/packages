// RtcMailbox — call handshake + WebRTC signaling over the Snap Cloud Postgres REST API.
//
// Implements RtcSignalTransport by exchanging small messages as rows in the
// `rtc_signals` table (supabase/migrations/…_create_rtc_signals.sql): each peer
// INSERTs its outbound rows and POLLs for the other peer's rows via PostgREST
// over HTTPS. The DB REST API is the one Snap Cloud service that demonstrably
// works on device for this (the Realtime WebSocket never reached SUBSCRIBED
// there), and the traffic is tiny — a handful of SDP/ICE rows per call plus the
// ring / accept / decline / busy / bye handshake. The media itself never touches
// the cloud: it is peer-to-peer WebRTC.
//
// Two mailboxes exist per Glasses: a long-lived INBOX on its own pairing code
// (polled slowly while idle — this is how an incoming ring is noticed) and,
// while calling out, a mailbox on the friend's code. Rows are read from the
// newest id present at connect, so nothing from an earlier call is replayed.

import { createClient, SupabaseClient } from "SupabaseClient.lspkg/supabase-snapcloud"
import { RtcKind, RtcSignalPayload, RtcSignalTransport } from "../App/Types"
import { SupabaseRequirements } from "./SupabaseRequirements"

const TABLE = "rtc_signals"
/** Poll cadence while a call is being set up / live: sub-second keeps ICE snappy. */
export const POLL_ACTIVE_S = 0.4
/** Poll cadence while idle, waiting for someone to ring this code. */
export const POLL_IDLE_S = 1.5

/**
 * Home-screen status when the Snap Cloud project has no `rtc_signals` table:
 * the migration in supabase/migrations was never applied to it. Every insert
 * and poll fails with PostgREST's "not in the schema cache" until it is.
 */
export const SCHEMA_MISSING_HINT =
    "Snap Cloud schema missing (rtc_signals) — open the project in Lens Studio to apply it, or run: supabase db push"

/** PostgREST's "table not in schema cache" (PGRST205): the migration never ran here. */
function isMissingTableError(error: any): boolean {
    const code = String((error && error.code) || "")
    const msg = String((error && error.message) || "")
    return code === "PGRST205" || /could not find the table/i.test(msg)
}

export class RtcMailbox implements RtcSignalTransport {
    private client: SupabaseClient | null = null
    private ready = false
    // Only rows with id greater than this are new to us.
    private readCursor = 0
    private polling = false
    private pollEvt: DelayedCallbackEvent | null = null
    private pollInterval = POLL_ACTIVE_S
    private handlers = new Map<RtcKind, (p: RtcSignalPayload, from: string) => void>()
    private _onReady: (() => void) | null = null
    private _onSchemaMissing: (() => void) | null = null
    /** True once the project answered "no such table" — see SCHEMA_MISSING_HINT. */
    schemaMissing = false

    constructor(
        private readonly script: BaseScriptComponent,
        /** The shared session id (callSessionId of the callee's code). */
        readonly session: string,
        /** Our own pairing code — we read rows NOT from us. */
        readonly me: string,
        pollInterval: number = POLL_ACTIVE_S
    ) {
        this.pollInterval = pollInterval
    }

    get isConnected(): boolean {
        return this.ready
    }

    /** Fired once, after auth + cursor seeding, when rows can be sent/received. */
    set onReady(cb: (() => void) | null) {
        this._onReady = cb
        if (cb && this.ready) cb()
    }

    /** Fired once when the project has no `rtc_signals` table (SCHEMA_MISSING_HINT). */
    set onSchemaMissing(cb: (() => void) | null) {
        this._onSchemaMissing = cb
        if (cb && this.schemaMissing) cb()
    }

    /** Switch between the idle and the in-call poll cadence. */
    setPollInterval(seconds: number): void {
        this.pollInterval = seconds
        if (this.pollEvt && this.ready && !this.polling) this.pollEvt.reset(seconds)
    }

    /** Fire-and-forget connect: auth, seed the cursor, start polling. */
    start(): void {
        this.connect().catch((e) => print("[RtcMailbox] init failed: " + e))
    }

    private async connect(): Promise<void> {
        const project = SupabaseRequirements.getProject("RtcMailbox")
        if (!project) {
            print("[RtcMailbox] SupabaseProject not configured — signaling disabled.")
            return
        }
        // DB REST API only — no realtime channel is ever opened here.
        this.client = createClient(project.url, project.publicToken)
        // Snapchat id-token FIRST: on device the Snap Cloud client supplies the
        // wearer's identity for this provider and it is the sign-in that works.
        // Anonymous is the Lens Studio preview fallback (enable it in the Snap
        // Cloud dashboard → Authentication → Providers).
        const { error } = await this.client.auth.signInWithIdToken({
            provider: "snapchat", token: "",
        })
        if (error) {
            const anon = await this.client.auth.signInAnonymously()
            if (anon.error) {
                print("[RtcMailbox] Auth failed — signaling disabled: " + JSON.stringify(anon.error))
                return
            }
            print("[RtcMailbox] Auth OK (anonymous).")
        } else {
            print("[RtcMailbox] Auth OK (snapchat id-token).")
        }
        // Seed the cursor to the newest row that already exists for this session:
        // whatever happened before we joined (an earlier call on the same code,
        // a stale bye) is history, not a message for us.
        try {
            const { data: newest, error: seedError } = await this.client.from(TABLE)
                .select("id")
                .eq("session", this.session)
                .order("id", { ascending: false })
                .limit(1)
            if (seedError && isMissingTableError(seedError)) {
                this.flagSchemaMissing()
                return
            }
            this.readCursor = (newest && newest[0] && typeof newest[0].id === "number")
                ? newest[0].id : 0
        } catch (e) {
            this.readCursor = 0
        }
        if (!this.client) return // stopped while authenticating
        this.ready = true
        this.startPolling()
        print("[RtcMailbox] Ready — session " + this.session + " as " + this.me +
            " (cursor " + this.readCursor + ").")
        if (this._onReady) this._onReady()
    }

    onRtcSignal(kind: RtcKind, cb: (p: RtcSignalPayload, from: string) => void): void {
        this.handlers.set(kind, cb)
    }

    offRtcSignal(kind: RtcKind): void {
        this.handlers.delete(kind)
    }

    sendRtcSignal(kind: RtcKind, payload: RtcSignalPayload): boolean {
        if (!this.ready || !this.client) return false
        const row = {
            session: this.session,
            kind,
            sender: this.me,
            t: payload.t,
            sdp: payload.sdp ?? null,
            cand: payload.cand ?? null,
            mid: payload.mid ?? null,
        }
        try {
            this.client.from(TABLE).insert(row).then(({ error }: any) => {
                if (error) {
                    print("[RtcMailbox] insert failed: " + String((error && error.message) || error))
                    if (isMissingTableError(error)) this.flagSchemaMissing()
                }
            })
        } catch (e) {
            print("[RtcMailbox] insert threw: " + e)
            return false
        }
        return true
    }

    /**
     * Diagnostic snapshot row (kind "diag", JSON in the `sdp` column, NO IPs).
     * The peer has no "diag" handler so it is ignored; read it back with a
     * `kind=eq.diag` REST query to see a stuck call's state without a USB tether.
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
        this.pollEvt.reset(this.pollInterval)
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
                    if (error && isMissingTableError(error)) {
                        this.flagSchemaMissing()
                        return
                    }
                    if (!error && data) {
                        for (const r of data) {
                            if (typeof r.id === "number" && r.id > this.readCursor) {
                                this.readCursor = r.id
                            }
                            const handler = this.handlers.get(r.kind as RtcKind)
                            if (handler) {
                                handler({
                                    t: r.t,
                                    sdp: r.sdp ?? undefined,
                                    cand: r.cand ?? undefined,
                                    mid: r.mid ?? undefined,
                                }, String(r.sender ?? ""))
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
        if (this.pollEvt && this.ready) this.pollEvt.reset(this.pollInterval)
    }

    /** Stop everything and tell the owner once: no row can be exchanged until the
     *  migration runs, so ringing (and waiting 45 s for an answer) is pointless. */
    private flagSchemaMissing(): void {
        const first = !this.schemaMissing
        this.schemaMissing = true
        this.ready = false
        if (this.pollEvt) this.pollEvt.enabled = false
        if (first) {
            print("[RtcMailbox] " + SCHEMA_MISSING_HINT + " (session " + this.session +
                " — supabase/migrations/20260721000000_create_rtc_signals.sql)")
            if (this._onSchemaMissing) this._onSchemaMissing()
        }
    }

    stop(): void {
        this.ready = false
        if (this.pollEvt) this.pollEvt.enabled = false
        this.pollEvt = null
        this.client = null
        this.handlers.clear()
        this._onReady = null
        this._onSchemaMissing = null
    }
}
