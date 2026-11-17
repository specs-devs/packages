// Realtime — one Supabase Realtime broadcast channel per VideoCallS2M session.
//
// Push transport for Watch Your Back / Call Friend: every streamer publishes
// `frame:<streamer>` / `audio:<streamer>` events on the session channel
// (povChannelName) and subscribes to the streams it renders. Replaces the v1
// storage-bucket polling, cutting end-to-end latency from seconds to roughly
// wire latency. The iOS companion speaks the same protocol
// (iOS/VideoCallS2M/RealtimeClient.swift).
//
// Snap Cloud alpha limits: 250 KB per Realtime message — oversize sends are
// dropped (logged once) so a fat frame can't wedge the channel.

import { createClient, SupabaseClient, RealtimeChannel } from "SupabaseClient.lspkg/supabase-snapcloud"
import {
    ALL_STREAMERS, FramePayload, AudioPayload, povChannelName,
    RTC_KINDS, RtcKind, RtcSignalPayload, rtcEventName,
} from "../App/Types"
import { SupabaseRequirements } from "./SupabaseRequirements"

// Realtime hard limit is 250 KB per message; leave headroom for the JSON envelope.
const MAX_PAYLOAD_CHARS = 235000
// Congestion control (frames only — voice chunks are small and always sent):
// at most this many frame sends may be inside the socket at once. When the
// uplink can't keep up we drop the frame instead of queueing it — live video
// must drop, never buffer. Mirrors FrameStreamer.swift on the phone.
const MAX_FRAMES_IN_FLIGHT = 2

export class Realtime {
    private client: SupabaseClient | null = null
    private channel: RealtimeChannel | null = null
    private connected = false
    private frameHandlers = new Map<string, (p: FramePayload) => void>()
    private audioHandlers = new Map<string, (p: AudioPayload) => void>()
    private rtcHandlers = new Map<string, (p: RtcSignalPayload) => void>()
    private oversizeLogged = false
    private framesInFlight = 0
    private framesDroppedCongested = 0
    private session = ""
    private reconnectEvt: DelayedCallbackEvent | null = null

    constructor(private readonly script: BaseScriptComponent) {}

    get isConnected(): boolean {
        return this.connected
    }

    // Handlers can be (un)registered at any time — the channel bindings are
    // fixed per streamer and dispatch through these maps.
    onFrame(streamer: string, cb: (p: FramePayload) => void): void {
        this.frameHandlers.set(streamer, cb)
    }

    offFrame(streamer: string): void {
        this.frameHandlers.delete(streamer)
    }

    onAudio(streamer: string, cb: (p: AudioPayload) => void): void {
        this.audioHandlers.set(streamer, cb)
    }

    offAudio(streamer: string): void {
        this.audioHandlers.delete(streamer)
    }

    /** WebRTC signaling sent BY `from` (SDP offers/answers + ICE candidates). */
    onRtcSignal(kind: RtcKind, from: string, cb: (p: RtcSignalPayload) => void): void {
        this.rtcHandlers.set(rtcEventName(kind, from), cb)
    }

    offRtcSignal(kind: RtcKind, from: string): void {
        this.rtcHandlers.delete(rtcEventName(kind, from))
    }

    async connect(session: string): Promise<void> {
        this.session = session
        const project = SupabaseRequirements.getProject("Realtime")
        if (!project) {
            print("[Realtime] SupabaseProject not configured — streaming disabled.")
            return
        }
        // Default heartbeat (25 s) — do NOT override low; sendHeartbeat() closes
        // the socket if one round-trip exceeds the interval.
        // DIAGNOSTIC (2026-07-21): the channel never reaches SUBSCRIBED on device
        // (Auth OK → TIMED_OUT → CLOSED loop), and the client swallows the WS
        // reason. Attach a transport logger so the journal shows whether the
        // socket connects, the phx_join push, its reply (or lack of), and any
        // close code/reason. Data is truncated so it can't flood.
        this.client = createClient(project.url, project.publicToken, {
            realtime: {
                logLevel: "info",
                logger: (kind: string, msg: string, data?: any) => {
                    let extra = ""
                    if (data !== undefined) {
                        try { extra = " " + JSON.stringify(data) } catch (e) { extra = " [unserializable]" }
                        if (extra.length > 280) extra = extra.slice(0, 280) + "…"
                    }
                    print("[VideoCallS2MRT/ws] " + kind + ": " + msg + extra)
                },
            },
        })
        const { error } = await this.client.auth.signInWithIdToken({
            provider: "snapchat", token: "",
        })
        if (error) {
            // signInWithIdToken always fails in the Lens Studio preview;
            // anonymous auth (enabled in the dashboard) keeps preview working.
            print("[VideoCallS2MRT] Id-token auth failed (" + (error.message ?? error) +
                ") — trying anonymous.")
            const anon = await this.client.auth.signInAnonymously()
            if (anon.error) {
                print("[VideoCallS2MRT] Auth failed — streaming disabled: " + JSON.stringify(anon.error))
                return
            }
            print("[VideoCallS2MRT] Auth OK (anonymous).")
        } else {
            print("[VideoCallS2MRT] Auth OK (snapchat id-token).")
        }
        this.openChannel()
    }

    private openChannel(): void {
        if (!this.client) return
        this.channel = this.client.channel(povChannelName(this.session), {
            config: { broadcast: { self: false } },
        })
        for (const s of ALL_STREAMERS) {
            this.channel.on("broadcast", { event: "frame:" + s }, (msg: any) => {
                const handler = this.frameHandlers.get(s)
                if (handler && msg && msg.payload) handler(msg.payload as FramePayload)
            })
            this.channel.on("broadcast", { event: "audio:" + s }, (msg: any) => {
                const handler = this.audioHandlers.get(s)
                if (handler && msg && msg.payload) handler(msg.payload as AudioPayload)
            })
            for (const kind of RTC_KINDS) {
                const evt = rtcEventName(kind, s)
                this.channel.on("broadcast", { event: evt }, (msg: any) => {
                    const handler = this.rtcHandlers.get(evt)
                    if (handler && msg && msg.payload) handler(msg.payload as RtcSignalPayload)
                })
            }
        }
        this.channel.subscribe((status: string, err?: any) => {
            if (status === "SUBSCRIBED") {
                this.connected = true
                print("[VideoCallS2MRT] Connected: " + povChannelName(this.session))
            } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                // A mid-call channel death is otherwise permanent (observed
                // CHANNEL_ERROR loops in the device journal) — tear the
                // channel down and rejoin until it comes back. Log the server
                // error detail when there is one: TIMED_OUT with no error =
                // the join got NO reply (socket/service level, not a reject).
                this.connected = false
                print("[VideoCallS2MRT] Channel " + status +
                    (err ? " (" + (err.message ?? JSON.stringify(err)) + ")" : "") +
                    " — rejoining in 3 s.")
                this.scheduleReconnect()
            }
        })
    }

    private scheduleReconnect(): void {
        if (!this.reconnectEvt) {
            this.reconnectEvt = this.script.createEvent("DelayedCallbackEvent")
            this.reconnectEvt.bind(() => {
                if (!this.client || this.connected) return
                print("[VideoCallS2MRT] Recreating channel after error…")
                if (this.channel) {
                    try {
                        this.client.removeChannel(this.channel)
                    } catch (e) {
                        // Stale channel teardown is best-effort.
                    }
                }
                // In-flight promises on a dead channel may never settle —
                // reset the budget so frame sends aren't blocked forever.
                this.framesInFlight = 0
                this.openChannel()
            })
        }
        this.reconnectEvt.reset(3.0)
    }

    /** Broadcast a video frame. Returns false when dropped (not connected / oversize). */
    sendFrame(streamer: string, b64Jpeg: string, seq: number): boolean {
        if (!this.connected || !this.channel) return false
        if (b64Jpeg.length > MAX_PAYLOAD_CHARS) {
            if (!this.oversizeLogged) {
                this.oversizeLogged = true
                print("[VideoCallS2MRT] Frame dropped: " + Math.round(b64Jpeg.length / 1024) +
                    " KB exceeds the 250 KB Realtime limit — lower quality/resolution.")
            }
            return false
        }
        if (this.framesInFlight >= MAX_FRAMES_IN_FLIGHT) {
            this.framesDroppedCongested += 1
            if (this.framesDroppedCongested % 100 === 1) {
                print("[VideoCallS2MRT] Uplink congested — " + this.framesDroppedCongested +
                    " frames dropped so far (bounded latency by design).")
            }
            return false
        }
        const payload: FramePayload = { d: b64Jpeg, n: seq, t: Date.now() }
        const result: any = this.channel.send({ type: "broadcast", event: "frame:" + streamer, payload })
        if (result && typeof result.then === "function") {
            this.framesInFlight += 1
            const release = () => { this.framesInFlight -= 1 }
            result.then(release, release)
        }
        return true
    }

    /** Broadcast one WebRTC signaling message (SDP/candidate — small, always sent). */
    sendRtcSignal(kind: RtcKind, from: string, payload: RtcSignalPayload): boolean {
        if (!this.connected || !this.channel) return false
        this.channel.send({ type: "broadcast", event: rtcEventName(kind, from), payload })
        return true
    }

    /** Broadcast a voice chunk. Returns false when dropped. */
    sendAudio(streamer: string, b64Wav: string, seq: number, sampleRate: number): boolean {
        if (!this.connected || !this.channel) return false
        if (b64Wav.length > MAX_PAYLOAD_CHARS) return false
        const payload: AudioPayload = { d: b64Wav, n: seq, r: sampleRate, t: Date.now() }
        this.channel.send({ type: "broadcast", event: "audio:" + streamer, payload })
        return true
    }

    disconnect(): void {
        this.connected = false
        this.framesInFlight = 0
        this.frameHandlers.clear()
        this.audioHandlers.clear()
        if (this.client) {
            this.client.removeAllChannels()
            this.client = null
        }
        this.channel = null
    }
}
