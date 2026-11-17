// VideoCallS2SManager — the orchestrator of the Glasses ↔ Glasses video call.
//
// Flow:
//   idle      — HomeUI shows this Glasses' pairing code; the INBOX mailbox (Snap
//               Cloud, keyed by our code) polls slowly for a `ring`.
//   calling   — CALL FRIEND: open a mailbox on the friend's code, `ring` it, show
//               the call panel ("Calling…"), wait for `accept` / `decline` / `busy`.
//   ringing   — a `ring` landed in our inbox: IncomingCallUI (ACCEPT / DENY).
//   in-call   — CallStreamer runs the WebRTC session: the caller OFFERS, the
//               callee ANSWERS, one duplex PeerConnection carries both cameras
//               and both voices. Either side's HANG UP posts `bye`.
//
// Everything this manager spawns lives under one "Video Call S2S" scene node.
// Snap Cloud is required for calling (assign a SupabaseProject on the
// SnapCloudRequirements object); without it the home screen still shows and says so.

import { HomeUI } from "./HomeUI"
import { IncomingCallUI } from "./IncomingCallUI"
import { CallPanelUI } from "./CallPanelUI"
import { CallStreamer } from "../WebRTC/CallStreamer"
import { VIDEO_QUALITY_PRESETS_KBPS } from "../WebRTC/WebRTCSession"
import { SyntheticVideoSource } from "../WebRTC/PreviewVideoSource"
import { RtcMailbox, POLL_ACTIVE_S, POLL_IDLE_S, SCHEMA_MISSING_HINT } from "../SnapCloud/RtcMailbox"
import { SnapCloudModule } from "../SnapCloud/SnapCloudModule"
import {
    CallRole, callSessionId, makePairingCode, normalizePairingCode, PAIRING_CODE_LENGTH,
} from "./Types"

const CHIME_TRACK = requireAsset("../../Audio/ConnectChime.wav") as AudioTrackAsset
const RING_TRACK = requireAsset("../../Audio/TargetPing.wav") as AudioTrackAsset

// An unanswered incoming call is dismissed as missed after this long.
const INCOMING_CALL_RING_S = 60
// An outgoing call nobody answers gives up after this long.
const OUTGOING_CALL_RING_S = 45
// Rotating call-setup lines (~7 s each) — SDP/ICE ride polled DB rows, so setup
// legitimately takes seconds; keep the wait human.
const CONNECTING_MESSAGES = [
    "Connecting the dots…",
    "Trading secret handshakes…",
    "Herding video packets…",
    "Finding the shortest path to your friend…",
    "Warming up the cameras…",
    "Good things take a second (or ten)…",
]

type CallState = "idle" | "calling" | "ringing" | "in-call"

/** UI tag for a video-quality preset ("1K" / "2K" / "MAX"). */
function qualityLabel(kbps: number): string {
    return kbps >= 3000 ? "MAX" : kbps >= 1500 ? "2K" : "1K"
}

@component
export class VideoCallS2SManager extends BaseScriptComponent {
    @input
    @allowUndefined
    @hint("Snap Cloud block — the ▸ Snap Cloud object (SnapCloudModule + SupabaseRequirements). REQUIRED for calling: it carries the pairing handshake and WebRTC signaling.")
    snapCloud!: SnapCloudModule

    @input
    @hint("Lens Studio preview only: with no Snap Cloud project assigned, CALL FRIEND (any code) opens the call panel with a synthetic test pattern so the call UI stays iterable. Has no effect on device.")
    previewTestPattern: boolean = true

    // Scene
    private root!: SceneObject
    private uiGroup!: SceneObject
    private callGroup!: SceneObject
    private home!: HomeUI
    private incoming: IncomingCallUI | null = null
    private panel: CallPanelUI | null = null
    private chime!: AudioComponent
    private ring!: AudioComponent

    // Pairing + signaling
    private readonly myCode = makePairingCode()
    private inbox: RtcMailbox | null = null   // long-lived, keyed by OUR code
    private outbox: RtcMailbox | null = null  // per outgoing call, keyed by the FRIEND's code
    private schemaMissing = false             // the project has no rtc_signals table (SCHEMA_MISSING_HINT)

    // Call state
    private state: CallState = "idle"
    private peerCode: string | null = null
    private streamer: CallStreamer | null = null
    private preview: SyntheticVideoSource | null = null
    private timeout: DelayedCallbackEvent | null = null
    private captionPoll: DelayedCallbackEvent | null = null
    private videoQualityKbps = VIDEO_QUALITY_PRESETS_KBPS[0]

    onAwake(): void {
        this.buildScene()
        this.buildHome()
        // The Snap Cloud block (@input) is resolved in onStart: this manager sits
        // at the top of the hierarchy, so its onAwake runs before the module below
        // it is awake.
        this.createEvent("OnStartEvent").bind(() => this.onStart())
    }

    // ── Scene construction ──────────────────────────────────────────────

    private buildScene(): void {
        this.root = global.scene.createSceneObject("Video Call S2S")
        this.uiGroup = global.scene.createSceneObject("UI")
        this.uiGroup.setParent(this.root)
        this.callGroup = global.scene.createSceneObject("Call")
        this.callGroup.setParent(this.root)
        // Adopt the authored native-module controller under Call so all the
        // WebRTC pieces live together (skips gracefully if it isn't found).
        this.adoptRootByName("WebRTCController", this.callGroup)

        this.chime = this.makeAudio(CHIME_TRACK)
        this.ring = this.makeAudio(RING_TRACK)
    }

    private adoptRootByName(name: string, parent: SceneObject): void {
        try {
            const count = global.scene.getRootObjectsCount()
            for (let i = 0; i < count; i++) {
                const obj = global.scene.getRootObject(i)
                if (obj && obj.name === name) {
                    obj.setParent(parent)
                    return
                }
            }
        } catch (e) {
            print("[VideoCallS2S] Could not adopt " + name + ": " + e)
        }
    }

    private buildHome(): void {
        const homeObj = global.scene.createSceneObject("Home")
        homeObj.setParent(this.uiGroup)
        homeObj.getTransform().setWorldPosition(new vec3(0, 0, -110))
        this.home = homeObj.createComponent(HomeUI.getTypeName()) as HomeUI
        this.home.setCode(this.myCode)
        this.home.onCall.add((raw) => this.callFriend(raw))
    }

    private makeAudio(track: AudioTrackAsset): AudioComponent {
        const audio = this.sceneObject.createComponent("Component.AudioComponent") as AudioComponent
        audio.audioTrack = track
        audio.playbackMode = Audio.PlaybackMode.LowLatency
        audio.volume = 0.8
        return audio
    }

    // ── Lifecycle ───────────────────────────────────────────────────────

    private get cloudReady(): boolean {
        return !!this.snapCloud && this.snapCloud.isConfigured()
    }

    private onStart(): void {
        print("[VideoCallS2S] Started. My code: " + this.myCode)
        if (!this.cloudReady) {
            this.home.setStatus(
                "Snap Cloud not configured — assign a SupabaseProject on SnapCloudRequirements.", "warn")
            this.home.setCallEnabled(global.deviceInfoSystem.isEditor() && this.previewTestPattern)
            return
        }
        this.home.setStatus("Connecting to Snap Cloud…")
        this.inbox = this.snapCloud.createRtcMailbox(callSessionId(this.myCode), this.myCode, POLL_IDLE_S)
        if (!this.inbox) {
            this.home.setStatus("Snap Cloud unavailable — calling disabled.", "warn")
            this.home.setCallEnabled(false)
            return
        }
        this.inbox.onRtcSignal("ring", (_p, from) => this.onRing(from))
        this.inbox.onSchemaMissing = () => this.onSchemaMissing()
        this.inbox.onReady = () => {
            this.home.setStatus("Ready · share your code, or call a friend.", "ok")
        }
        this.inbox.start()
    }

    /** The Snap Cloud project answered "no such table": nothing can be signaled
     *  until the migration runs, so say so at once instead of ringing into the void. */
    private onSchemaMissing(): void {
        this.schemaMissing = true
        this.home.setCallEnabled(false)
        if (this.state === "calling") {
            this.endCall("blocked — " + SCHEMA_MISSING_HINT, "warn")
        } else {
            this.home.setStatus(SCHEMA_MISSING_HINT, "warn")
        }
    }

    // ── Outgoing call ───────────────────────────────────────────────────

    private callFriend(raw: string): void {
        if (this.state !== "idle") return
        const code = normalizePairingCode(raw)
        if (!this.cloudReady && global.deviceInfoSystem.isEditor() && this.previewTestPattern) {
            // Lens Studio preview without Snap Cloud: there is nobody to call, so
            // CALL FRIEND (any code, even none) opens the call panel with the
            // synthetic feed — the call UI stays iterable in the editor.
            this.peerCode = code ?? "0000"
            this.state = "in-call"
            this.home.hide()
            this.showPanel("PREVIEW · call panel with a synthetic feed")
            this.startPreviewFeed()
            return
        }
        if (!code) {
            this.home.setStatus("Enter your friend's " + PAIRING_CODE_LENGTH + "-digit code.", "warn")
            return
        }
        if (code === this.myCode) {
            this.home.setStatus("That's your own code — ask your friend for theirs.", "warn")
            return
        }
        if (!this.cloudReady || !this.inbox) {
            this.home.setStatus("Snap Cloud not configured — calling disabled.", "warn")
            return
        }
        if (this.schemaMissing) {
            this.home.setStatus(SCHEMA_MISSING_HINT, "warn")
            return
        }
        this.peerCode = code
        this.state = "calling"
        this.home.hide()
        this.showPanel("Calling " + code + "…")
        this.outbox = this.snapCloud.createRtcMailbox(callSessionId(code), this.myCode, POLL_ACTIVE_S)
        if (!this.outbox) {
            this.endCall("Snap Cloud unavailable", "warn")
            return
        }
        this.outbox.onRtcSignal("accept", () => this.onAccepted())
        this.outbox.onRtcSignal("decline", () => this.endCall("declined by " + code, "warn"))
        this.outbox.onRtcSignal("busy", () => this.endCall(code + " is busy", "warn"))
        this.outbox.onRtcSignal("bye", () => this.endCall("ended by " + code))
        this.outbox.onSchemaMissing = () => this.onSchemaMissing()
        this.outbox.onReady = () => {
            if (this.state !== "calling" || !this.outbox) return
            this.outbox.sendRtcSignal("ring", { t: "ring" })
            print("[VideoCallS2S] Ringing " + code + "…")
        }
        this.outbox.start()
        this.armTimeout(OUTGOING_CALL_RING_S, () => {
            if (this.state !== "calling") return
            if (this.outbox) this.outbox.sendRtcSignal("bye", { t: "bye" })
            this.endCall("no answer from " + code, "warn")
        })
        this.logCallState("calling")
    }

    private onAccepted(): void {
        if (this.state !== "calling" || !this.outbox) return
        this.clearTimeout()
        print("[VideoCallS2S] " + this.peerCode + " accepted — starting media as caller.")
        this.startMedia("caller", this.outbox)
    }

    // ── Incoming call ───────────────────────────────────────────────────

    private onRing(from: string): void {
        if (!this.inbox) return
        if (this.state !== "idle") {
            // Already busy (calling / ringing / in a call) — tell them right away.
            this.inbox.sendRtcSignal("busy", { t: "busy" })
            print("[VideoCallS2S] Ring from " + from + " while " + this.state + " — busy.")
            return
        }
        this.state = "ringing"
        this.peerCode = from
        // The home screen's interaction plane would swallow the dialog's pinches.
        this.home.hide()
        this.ring.play(1)
        const obj = global.scene.createSceneObject("IncomingCall")
        obj.setParent(this.uiGroup)
        this.incoming = obj.createComponent(IncomingCallUI.getTypeName()) as IncomingCallUI
        this.incoming.setCaller(from)
        this.incoming.onAccept.add(() => this.answerCall(true))
        this.incoming.onDeny.add(() => this.answerCall(false))
        print("[VideoCallS2S] Incoming call from " + from)
        this.armTimeout(INCOMING_CALL_RING_S, () => this.missIncomingCall())
    }

    private answerCall(accepted: boolean): void {
        if (this.state !== "ringing" || !this.inbox) return
        this.clearTimeout()
        this.dismissIncomingCall()
        if (!accepted) {
            this.inbox.sendRtcSignal("decline", { t: "decline" })
            print("[VideoCallS2S] Call from " + this.peerCode + " denied.")
            this.backToHome("Call declined.")
            return
        }
        this.inbox.sendRtcSignal("accept", { t: "accept" })
        print("[VideoCallS2S] Accepted call from " + this.peerCode + " — starting media as callee.")
        this.showPanel("Connecting to " + this.peerCode + "…")
        this.startMedia("callee", this.inbox)
    }

    private missIncomingCall(): void {
        if (this.state !== "ringing") return
        print("[VideoCallS2S] Incoming call unanswered for " + INCOMING_CALL_RING_S + " s — missed.")
        this.dismissIncomingCall()
        if (this.inbox) this.inbox.sendRtcSignal("decline", { t: "decline" })
        this.backToHome("Missed call from " + this.peerCode + ".", "warn")
    }

    private dismissIncomingCall(): void {
        if (!this.incoming) return
        // Hide instantly; defer destroy — tearing the hierarchy down from
        // inside the dialog's own button callback is unreliable on device.
        const obj = this.incoming.getSceneObject()
        obj.enabled = false
        const destroyEvt = this.createEvent("DelayedCallbackEvent")
        destroyEvt.bind(() => obj.destroy())
        destroyEvt.reset(0.1)
        this.incoming = null
    }

    // ── Media ───────────────────────────────────────────────────────────

    private startMedia(role: CallRole, mailbox: RtcMailbox): void {
        this.state = "in-call"
        mailbox.setPollInterval(POLL_ACTIVE_S)
        // The friend's HANG UP posts a `bye` on the shared mailbox.
        mailbox.onRtcSignal("bye", () => this.endCall("ended by " + this.peerCode))
        if (!this.panel) this.showPanel("Connecting…")
        this.streamer = new CallStreamer(this, mailbox, role)
        this.streamer.onFriendVideoTexture = (tex) => {
            if (this.panel) this.panel.setFrameTexture(tex)
        }
        this.streamer.start()
        this.chime.play(1)
        if (this.streamer.unavailableReason && global.deviceInfoSystem.isEditor() && this.previewTestPattern) {
            this.startPreviewFeed()
        }
        this.startCaptionPoll()
        this.logCallState("media started (" + role + ")")
    }

    private startPreviewFeed(): void {
        if (this.preview) return
        this.preview = new SyntheticVideoSource(this)
        this.preview.onTexture = (tex) => {
            if (this.panel) this.panel.setFrameTexture(tex)
        }
        this.preview.start()
    }

    private startCaptionPoll(): void {
        this.captionPoll = this.createEvent("DelayedCallbackEvent")
        this.captionPoll.bind(() => {
            if (!this.panel || !this.streamer) return
            const who = this.peerCode ?? "friend"
            if (this.streamer.unavailableReason) {
                this.panel.setCaption(who + " · " + this.streamer.unavailableReason +
                    (this.preview ? "\n" + this.preview.statusLine() : ""))
            } else if (!this.streamer.mediaConnected) {
                const i = Math.floor(getTime() / 7) % CONNECTING_MESSAGES.length
                this.panel.setCaption("CALL WITH " + who + "\n" + CONNECTING_MESSAGES[i])
            } else {
                this.panel.setCaption("CALL WITH " + who + " · " + this.streamer.transportLine() +
                    "\n" + this.streamer.micStatusLine() + " · " + this.streamer.friendVideoLine())
            }
            if (this.captionPoll) this.captionPoll.reset(1)
        })
        this.captionPoll.reset(1)
    }

    private showPanel(caption: string): void {
        if (this.panel) {
            this.panel.setCaption(caption)
            return
        }
        const panelObj = global.scene.createSceneObject("CallPanel")
        panelObj.setParent(this.callGroup)
        this.panel = panelObj.createComponent(CallPanelUI.getTypeName()) as CallPanelUI
        this.panel.onHangUp.add(() => this.hangUp())
        this.panel.onQualityToggle.add(() => {
            const presets = VIDEO_QUALITY_PRESETS_KBPS
            const i = presets.indexOf(this.videoQualityKbps)
            this.applyVideoQuality(presets[(i + 1) % presets.length])
        })
        this.panel.setQualityLabel("VIDEO · " + qualityLabel(this.videoQualityKbps))
        this.panel.setCaption(caption)
    }

    /** Apply a video-quality preset (kbps): reaches the HW encoder live. */
    private applyVideoQuality(kbps: number): void {
        this.videoQualityKbps = kbps
        const applied = this.streamer ? this.streamer.setVideoBitrate(kbps) : 0
        if (this.panel) this.panel.setQualityLabel("VIDEO · " + qualityLabel(kbps))
        print("[VideoCallS2S] Video quality -> " + kbps + " kbps (" + qualityLabel(kbps) +
            (applied === 0 ? ", encoder not running yet" : "") + ").")
    }

    // ── Teardown ────────────────────────────────────────────────────────

    /** HANG UP on the panel (also cancels an outgoing call that is still ringing). */
    private hangUp(): void {
        if (this.state === "idle" || this.state === "ringing") return
        const mailbox = this.outbox ?? this.inbox
        if (mailbox && this.peerCode) mailbox.sendRtcSignal("bye", { t: "bye" })
        this.endCall("ended")
    }

    /** Tear the call down (media, panel, outbox) and return to the home screen. */
    private endCall(reason: string, tone: "info" | "warn" = "info"): void {
        this.clearTimeout()
        if (this.captionPoll) this.captionPoll.enabled = false
        this.captionPoll = null
        if (this.streamer) {
            this.streamer.stop()
            this.streamer = null
        }
        if (this.preview) {
            this.preview.stop()
            this.preview = null
        }
        if (this.outbox) {
            this.outbox.stop()
            this.outbox = null
        }
        if (this.inbox) {
            this.inbox.offRtcSignal("bye")
            this.inbox.offRtcSignal("pov")
            this.inbox.setPollInterval(POLL_IDLE_S)
        }
        if (this.panel) {
            // Hide instantly; defer destroy — tearing the hierarchy down from
            // inside the panel's own button callback is unreliable on device.
            const panelObj = this.panel.getSceneObject()
            panelObj.enabled = false
            const destroyEvt = this.createEvent("DelayedCallbackEvent")
            destroyEvt.bind(() => panelObj.destroy())
            destroyEvt.reset(0.1)
            this.panel = null
        }
        this.logCallState("call " + reason)
        this.backToHome("Call " + reason + ".", tone)
    }

    private backToHome(status: string, tone: "info" | "warn" = "info"): void {
        this.state = "idle"
        this.peerCode = null
        this.home.clearInput()
        this.home.show()
        this.home.setStatus(status, tone)
    }

    private armTimeout(seconds: number, cb: () => void): void {
        this.clearTimeout()
        this.timeout = this.createEvent("DelayedCallbackEvent")
        this.timeout.bind(cb)
        this.timeout.reset(seconds)
    }

    private clearTimeout(): void {
        if (this.timeout) this.timeout.enabled = false
        this.timeout = null
    }

    private logCallState(reason: string): void {
        print("[CallState] " + reason + " | state=" + this.state + " me=" + this.myCode +
            " peer=" + (this.peerCode ?? "-") +
            " | " + (this.streamer ? this.streamer.transportLine() : "no media"))
    }
}
