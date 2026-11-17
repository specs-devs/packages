// MobileKitLink — Glasses Mobile Kit transport + preview simulation.
//
// Real mode: opens a Mobile Kit session and subscribes to the "location" call
// method served by the iOS companion app (iOS/VideoCallS2M/MobileKitModel.swift).
// Each payload is one JSON string:
//   { "lat": <deg>, "lon": <deg>, "accuracy": <m>, "heading": <deg>, "role": "self"|"friend",
//     "name"?: <string>, "alt"?: <m MSL>, "vAcc"?: <m>, "pressure"?: <kPa> }
// ("alt"/"vAcc" are GPS altitude; "pressure" is the raw barometer reading —
// comparing pressure between two nearby phones cancels weather, ~1 m relative height.)
//
// Simulation mode (Lens Studio preview has no phone — "Session is not available"
// is expected there): streams a fixed self fix and a slowly strolling friend so
// the pointer, marker, and label can be verified in preview.

import Event, {PublicApi} from "InteractionKit.lspkg/Utils/Event"
import {
    RtcKind, RtcSignalPayload, RtcSignalTransport, RtcRelayMessage, rtcEventName,
} from "../App/Types"

// Preview-simulation extras (editor only — never on device). Flip one on when
// testing that specific feature in preview; both default OFF so a normal
// preview run isn't interrupted by fake events.
const SIM_INCOMING_CALL = false // fake call request ~10 s in (tests the dialog)
const SIM_UWB_BURSTS = false // friend hops to ~5 m + uwbDist every other 20 s

export interface LocationFix {
    lat: number
    lon: number
    accuracy: number | null
    heading: number | null
    name: string | null
    alt: number | null
    vAcc: number | null
    pressure: number | null
    /** Phone-to-phone UWB distance (m), present only while fresh (<2 s). */
    uwbDist: number | null
}

export class MobileKitLink implements RtcSignalTransport {
    private _onSelfFix = new Event<LocationFix>()
    private _onFriendFix = new Event<LocationFix>()
    private _onConnection = new Event<boolean>()
    private _onTestMessage = new Event<string>()
    private _onCallRequest = new Event<string>()
    private _onCallCancel = new Event<void>()
    private _onModeExit = new Event<void>()
    private _onQualityRequest = new Event<number>()

    // WebRTC signaling over Mobile Kit (RtcSignalTransport): SDP/ICE ride the
    // same phone link as control messages — Glasses → phone via sendData (arrives
    // as .notify on iOS, relayed to phoneB over multipeer), phone → Glasses via
    // the "rtc" subscription. Media stays peer-to-peer; no cloud involved.
    private connected = false
    private rtcHandlers = new Map<string, (p: RtcSignalPayload) => void>()

    get onSelfFix(): PublicApi<LocationFix> { return this._onSelfFix.publicApi() }
    get onFriendFix(): PublicApi<LocationFix> { return this._onFriendFix.publicApi() }
    get onConnection(): PublicApi<boolean> { return this._onConnection.publicApi() }
    get onTestMessage(): PublicApi<string> { return this._onTestMessage.publicApi() }
    /** Friend phone wants to start a video call (name of the requester). */
    get onCallRequest(): PublicApi<string> { return this._onCallRequest.publicApi() }
    /** Friend phone cancelled its pending call request (dismiss the dialog). */
    get onCallCancel(): PublicApi<void> { return this._onCallCancel.publicApi() }
    /** Phone asked to leave the current mode (same as CHANGE MODES on device). */
    get onModeExit(): PublicApi<void> { return this._onModeExit.publicApi() }
    /** Friend phone asked for a video-quality preset (kbps). */
    get onQualityRequest(): PublicApi<number> { return this._onQualityRequest.publicApi() }

    // ── RtcSignalTransport: WebRTC signaling over the phone relay ────────

    /** True while the Mobile Kit session to the bonded phone is up. */
    get isConnected(): boolean { return this.connected }

    onRtcSignal(kind: RtcKind, from: string, cb: (p: RtcSignalPayload) => void): void {
        this.rtcHandlers.set(rtcEventName(kind, from), cb)
    }

    offRtcSignal(kind: RtcKind, from: string): void {
        this.rtcHandlers.delete(rtcEventName(kind, from))
    }

    /** Glasses → phone: one SDP/ICE message. Rides sendData as {type:"rtc",…}. */
    sendRtcSignal(kind: RtcKind, from: string, payload: RtcSignalPayload): boolean {
        if (!this.session) return false
        const msg: RtcRelayMessage = { type: "rtc", kind, from, sig: payload }
        try {
            this.session.sendData(JSON.stringify(msg))
            return true
        } catch (e) {
            print("[MobileKitLink] RTC signal send failed: " + e)
            return false
        }
    }

    /** Dispatch an inbound relayed signal ({kind,from,sig}) to its handler. */
    private handleRtcPayload(payload: string): void {
        let msg: any
        try {
            msg = JSON.parse(payload)
        } catch (e) {
            print("[MobileKitLink] Bad rtc payload: " + payload)
            return
        }
        if (!msg || msg.type !== "rtc" || !msg.kind || !msg.from || !msg.sig) return
        const handler = this.rtcHandlers.get(rtcEventName(msg.kind, msg.from))
        if (handler) handler(msg.sig as RtcSignalPayload)
    }

    private session: SpectaclesMobileKitSession | null = null
    // The lens and the phone must both have createSession() live at the same moment
    // to complete the BLE handshake, so we keep retrying until the phone initiates a
    // session. A single reused event avoids leaking one DelayedCallbackEvent per retry.
    private readonly sessionRetrySec = 3.0
    private sessionAttempts = 0
    private sessionRetryEvent: DelayedCallbackEvent | null = null
    private seenRoles: { [role: string]: boolean } = {}
    // Last control message — re-sent on every (re)connect so the phone can
    // relaunch mid-session and still learn the mode + cloud session code.
    private pendingControl: string | null = null

    constructor(
        private readonly script: BaseScriptComponent,
        private readonly module: SpectaclesMobileKitModule | null
    ) {}

    start(simulate: boolean): void {
        // Build marker — lets us confirm from the device journal which code is live.
        print("[MobileKitLink] BUILD=mk-single-module-v3  module=" + (this.module ? "present" : "NULL") +
            "  simulate=" + simulate)
        if (simulate) {
            this.startSimulation()
        } else {
            this.startSession()
        }
    }

    // ── Real Mobile Kit session ─────────────────────────────────────────

    private startSession(): void {
        if (!this.module) {
            print("[MobileKitLink] No Mobile Kit module assigned — cannot receive phone locations.")
            return
        }
        try {
            this.session = this.module.createSession()
            // The working Mobile Kit sample only opens subscriptions once the
            // phone is actually connected — mirror that exactly. (Guard against
            // onConnected re-firing on the same session after a reconnect.)
            let subscribed = false

            this.session.onConnected.add(() => {
                print("[MobileKitLink] Phone connected.")
                this.connected = true
                this._onConnection.invoke(true)
                if (!subscribed) {
                    subscribed = true
                    this.openSubscriptions()
                }
                this.flushControl()
            })

            this.session.onDisconnected.add(() => {
                print("[MobileKitLink] Phone disconnected — retrying.")
                this.connected = false
                this._onConnection.invoke(false)
                this.session = null
                this.scheduleSessionRetry()
            })

            this.session.onError.add((err: string) => {
                print("[MobileKitLink] Session error: " + err)
            })

            this.session.start()
            this.sessionAttempts = 0
            print("[MobileKitLink] Mobile Kit session started. Waiting for phone…")
        } catch (e) {
            // On device, createSession() throws "Session is not available" until a
            // bonded phone actually starts a session. The old code assumed this only
            // happened in the editor preview and gave up on the first throw — which
            // left the phone stuck on "Session starting…" forever. Keep retrying so we
            // rendezvous with the phone whenever it initiates. Log sparsely.
            this.session = null
            this.sessionAttempts += 1
            if (this.sessionAttempts === 1 || this.sessionAttempts % 10 === 0) {
                print("[MobileKitLink] Mobile Kit session not available yet (attempt " +
                    this.sessionAttempts + "): " + e + " — retrying every " +
                    this.sessionRetrySec + "s. Start a session from the phone.")
            }
            this.scheduleSessionRetry()
        }
    }

    private openSubscriptions(): void {
        if (!this.session) return

        // Main data channel: streaming GPS fixes from the phone.
        const location = this.session.startSubscription("location", (err: string) => {
            print("[MobileKitLink] 'location' subscription error: " + err)
        })
        location.add((payload: string) => this.handlePayload(payload))

        // Plain-text loopback channel — proves phone → Glasses transport works
        // before any GPS/JSON logic is involved (see the phone app's Test field).
        const test = this.session.startSubscription("test", (err: string) => {
            print("[MobileKitLink] 'test' subscription error: " + err)
        })
        test.add((message: string) => {
            print("[MobileKitLink] TEST message from phone: " + message)
            this._onTestMessage.invoke(message)
        })

        // Reverse call initiation: the friend phone's call request, relayed by
        // the bonded phone. Payload: {"type":"call-request","name":<string>}.
        const request = this.session.startSubscription("request", (err: string) => {
            print("[MobileKitLink] 'request' subscription error: " + err)
        })
        request.add((payload: string) => {
            let data: any
            try {
                data = JSON.parse(payload)
            } catch (e) {
                print("[MobileKitLink] Bad request payload: " + payload)
                return
            }
            if (data && data.type === "call-request") {
                const name = typeof data.name === "string" ? data.name : "Friend"
                print("[MobileKitLink] Incoming call request from: " + name)
                this._onCallRequest.invoke(name)
            } else if (data && data.type === "call-cancel") {
                print("[MobileKitLink] Call request cancelled by the friend phone.")
                this._onCallCancel.invoke()
            } else if (data && data.type === "quality" && typeof data.kbps === "number") {
                print("[MobileKitLink] Video-quality request from phone: " + data.kbps + " kbps.")
                this._onQualityRequest.invoke(data.kbps)
            } else if (data && data.type === "mode-exit") {
                print("[MobileKitLink] Mode-exit requested from phone.")
                this._onModeExit.invoke()
            }
        })

        // WebRTC signaling from the friend phone (pov answers/ICE, voice
        // offers/ICE), relayed by the bonded phone. Payload is a {type:"rtc",…}
        // envelope — see RtcRelayMessage / WebRTCSession.
        const rtc = this.session.startSubscription("rtc", (err: string) => {
            print("[MobileKitLink] 'rtc' subscription error: " + err)
        })
        rtc.add((payload: string) => this.handleRtcPayload(payload))

        print("[MobileKitLink] Subscribed to 'location' + 'test' + 'request' + 'rtc'.")
    }

    /**
     * Send a control message to the bonded phone (Glasses → phone, one-way).
     * Arrives on iOS as a `.notify` request; the phone forwards it to the
     * friend phone over multipeer. Queued + re-sent on every reconnect.
     */
    sendControl(control: object): void {
        this.pendingControl = JSON.stringify(control)
        this.flushControl()
    }

    /**
     * Fire-and-forget message to the bonded phone. Unlike sendControl it is
     * NOT queued for re-send on reconnect — used for call accept/deny replies.
     */
    sendOneShot(message: object): void {
        if (!this.session) return
        try {
            this.session.sendData(JSON.stringify(message))
        } catch (e) {
            print("[MobileKitLink] One-shot send failed: " + e)
        }
    }

    private flushControl(): void {
        if (!this.session || !this.pendingControl) return
        try {
            this.session.sendData(this.pendingControl)
            print("[MobileKitLink] Control sent: " + this.pendingControl)
        } catch (e) {
            print("[MobileKitLink] Control send failed (will retry on reconnect): " + e)
        }
    }

    private scheduleSessionRetry(): void {
        if (!this.sessionRetryEvent) {
            this.sessionRetryEvent = this.script.createEvent("DelayedCallbackEvent")
            this.sessionRetryEvent.bind(() => this.startSession())
        }
        this.sessionRetryEvent.reset(this.sessionRetrySec)
    }

    private handlePayload(payload: string): void {
        let data: any
        try {
            data = JSON.parse(payload)
        } catch (e) {
            print("[MobileKitLink] Bad location payload: " + payload)
            return
        }
        if (typeof data.lat !== "number" || typeof data.lon !== "number") {
            return
        }
        const fix: LocationFix = {
            lat: data.lat,
            lon: data.lon,
            accuracy: typeof data.accuracy === "number" ? data.accuracy : null,
            heading: typeof data.heading === "number" ? data.heading : null,
            name: typeof data.name === "string" ? data.name : null,
            alt: typeof data.alt === "number" ? data.alt : null,
            vAcc: typeof data.vAcc === "number" ? data.vAcc : null,
            pressure: typeof data.pressure === "number" ? data.pressure : null,
            uwbDist: typeof data.uwbDist === "number" ? data.uwbDist : null,
        }
        if (!this.seenRoles[data.role]) {
            this.seenRoles[data.role] = true
            print("[MobileKitLink] First '" + data.role + "' fix received from phone.")
        }
        if (data.role === "self") {
            this._onSelfFix.invoke(fix)
        } else if (data.role === "friend") {
            this._onFriendFix.invoke(fix)
        }
    }

    // ── Preview simulation ──────────────────────────────────────────────

    private startSimulation(): void {
        print("[MobileKitLink] SIMULATION: streaming fake self+friend GPS (editor preview).")
        const SELF_LAT = 37.7749
        const SELF_LON = -122.4194
        let tick = 0
        const loop = this.script.createEvent("DelayedCallbackEvent")
        loop.bind(() => {
            tick += 1
            if (tick === 1) {
                this.connected = true
                this._onConnection.invoke(true)
            }
            // One fake incoming call request so the accept/deny dialog can be
            // exercised in the editor preview (gated — see SIM_INCOMING_CALL).
            if (SIM_INCOMING_CALL && tick === 10) {
                this._onCallRequest.invoke("iPhone A4F2 (sim)")
            }
            this._onSelfFix.invoke({
                lat: SELF_LAT, lon: SELF_LON,
                accuracy: 5, heading: null, name: null,
                alt: 15, vAcc: 5, pressure: 101.325,
                uwbDist: null,
            })
            // Friend strolls a slow ~30 m loop centered ~110 m northeast of self,
            // ~10 m higher (pressure 0.12 kPa lower ≈ 10 m up — e.g. a balcony).
            // Every other 20 s block also carries a fake UWB reading (as if
            // the friend were ~4 m away) so the UWB display paths — ring,
            // footer, label source — can be exercised in preview repeatedly.
            const angle = tick * 0.06
            const inUwbBurst = SIM_UWB_BURSTS && Math.floor(tick / 20) % 2 === 1
            const simUwb = inUwbBurst ? 4 + Math.sin(tick * 0.4) : null
            if (inUwbBurst && tick % 20 === 0) {
                print("[MobileKitLink] SIMULATION: UWB burst (20 s — friend ~5 m away).")
            }
            // During the burst the friend is genuinely close (GPS ~5 m NE,
            // matching the UWB claim) — the map zooms in and the UWB ring
            // shows; otherwise the usual ~110 m stroll.
            this._onFriendFix.invoke({
                lat: SELF_LAT + (inUwbBurst ? 0.00003 : 0.0007 + 0.00027 * Math.sin(angle)),
                lon: SELF_LON + (inUwbBurst ? 0.00004 : 0.0009 + 0.00027 * Math.cos(angle)),
                accuracy: 8, heading: null, name: "iPhone A4F2 (sim)",
                alt: 25, vAcc: 5, pressure: 101.205,
                uwbDist: simUwb,
            })
            loop.reset(1.0)
        })
        loop.reset(0.5)
    }
}
