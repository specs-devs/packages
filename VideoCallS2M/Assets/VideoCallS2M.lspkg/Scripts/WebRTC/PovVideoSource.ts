// PovVideoSource — the single seam that enforces "editor OR device, never both."
//
// The POV panel (Watch Your Back) shows a Texture and does not care where it
// came from. EXACTLY ONE source feeds it, chosen ONCE at start() by isEditor():
//
//   • device  → WebRtcWatchYourBackSource — real H.264 WebRTC decode-to-texture,
//               sourced from the wearer's OWN phone. NO cloud fallback: if WebRTC
//               can't connect, the panel just shows its "connecting" caption.
//   • editor  → SyntheticPovSource — a local animated test pattern. The native
//               .so can't load in the Lens Studio preview, so WebRTC never runs
//               here; the synthetic feed keeps the panel/UI iterable in-editor.
//
// This is deliberately NOT a runtime fallback or handover — the branch is picked
// at start() and never switches. See the conversation design notes: one thing or
// the other, editor vs non.

import { WebRTCController } from "./WebRTCController"
import { WebRTCSession } from "./WebRTCSession"
import { RtcMailbox } from "../SnapCloud/RtcMailbox"
import { STREAMER_GLASSES } from "../App/Types"
import { RtcVoicePlayer } from "./RtcVoicePlayer"

export interface PovVideoSource {
    /** Fired when the display Texture is (re)created and ready to show. Wire it
     *  to PovPanelUI.setFrameTexture. */
    onTexture: ((tex: Texture) => void) | null
    /** Short status for the panel caption (source-specific). */
    statusLine(): string
    start(): void
    stop(): void
}

// ── Editor source: animated synthetic feed ──────────────────────────────────
//
// A scrolling diagonal color gradient with a bright horizontal scan line sweeping
// down — obviously "live" so it's clear the panel is updating, and obviously fake
// so no one mistakes it for a real camera. Portrait 9:16-ish to match the panel.
export class SyntheticPovSource implements PovVideoSource {
    onTexture: ((tex: Texture) => void) | null = null

    private readonly w = 180
    private readonly h = 320
    private readonly px = new Uint8Array(this.w * this.h * 4)
    private tex: Texture | null = null
    private provider: ProceduralTextureProvider | null = null
    private update: UpdateEvent | null = null
    private frame = 0

    constructor(private readonly script: BaseScriptComponent) {}

    start(): void {
        this.tex = ProceduralTextureProvider.createWithFormat(
            this.w, this.h, TextureFormat.RGBA8Unorm)
        this.provider = this.tex.control as ProceduralTextureProvider
        if (this.onTexture) this.onTexture(this.tex)
        this.update = this.script.createEvent("UpdateEvent")
        this.update.bind(() => this.render())
        print("[PovVideoSource] Editor synthetic feed started (" + this.w + "x" + this.h + ").")
    }

    private render(): void {
        if (!this.provider) return
        this.frame += 1
        const t = this.frame
        const scan = (t * 3) % this.h
        let i = 0
        for (let y = 0; y < this.h; y++) {
            const onScan = Math.abs(y - scan) < 4
            for (let x = 0; x < this.w; x++) {
                if (onScan) {
                    this.px[i] = 255
                    this.px[i + 1] = 255
                    this.px[i + 2] = 255
                } else {
                    const g = (x + y + t * 2) & 0xff
                    this.px[i] = g
                    this.px[i + 1] = (255 - g) & 0xff
                    this.px[i + 2] = (t * 2) & 0xff
                }
                this.px[i + 3] = 255
                i += 4
            }
        }
        this.provider.setPixels(0, 0, this.w, this.h, this.px)
    }

    statusLine(): string {
        return "EDITOR PREVIEW · synthetic feed (WebRTC runs on device only)"
    }

    stop(): void {
        if (this.update) this.update.enabled = false
        this.update = null
        this.tex = null
        this.provider = null
    }
}

// ── Device source: inbound WebRTC video from the wearer's OWN phone ──────────
//
// STUB — filled in by the "Watch Your Back device WebRTC receive session" task.
// It will drive the receive-only inbound-video session (kKindFriendVid decode
// worker → RGBA in VideoCallS2MWebRTCModule) sourced from phoneA's rear camera and
// emit onTexture, reusing the same machinery Call Friend already uses for the
// friend's camera. One-way video, no voice. Device-only — WebRTC never runs in
// the editor, so there is intentionally nothing to render in preview here.
export class WebRtcWatchYourBackSource implements PovVideoSource {
    onTexture: ((tex: Texture) => void) | null = null

    private session: WebRTCSession | null = null
    private mailbox: RtcMailbox | null = null
    private voice: RtcVoicePlayer | null = null
    private procTex: Texture | null = null
    private provider: ProceduralTextureProvider | null = null
    private texW = 0
    private texH = 0
    private frames = 0

    constructor(
        private readonly script: BaseScriptComponent,
        private readonly sessionCode: string,
    ) {}

    start(): void {
        const native = WebRTCController.native
        if (!native) {
            print("[WYB] WebRTC native module unavailable — device-only, nothing to receive.")
            return
        }
        // Reuse the PROVEN inbound path: the friend-camera video already arrives on
        // the recvonly leg of the duplex pov session (a standalone recvonly session
        // crashed this engine — see WebRTCSession). WYB captures no Glasses mic
        // (one-way audio — we only PLAY the phone's mic). The wearer's OWN phone (phoneA) must answer the pov
        // offer and stream its REAR camera back (the peopleFinder-control message already
        // sets camera:"back" for WYB — see VideoCallS2MManager.applySelection).
        //
        // KNOWN TRADEOFF: reusing pov means the Glasses still captures + offers its
        // forward camera to the phone (which ignores it in WYB). A dedicated
        // recvonly WYB session would avoid that capture but needs native engine
        // work; deferred. Signaling rides the same Snap Cloud DB mailbox as the call.
        this.mailbox = new RtcMailbox(this.script, this.sessionCode, STREAMER_GLASSES)
        this.mailbox.start()
        this.session = new WebRTCSession(this.script, this.mailbox, native)
        this.session.onFriendVideoFrame = (rgba, w, h) => this.upload(rgba, w, h)
        // One-way audio: the phone offers its mic (voiceEnabled on the phone side);
        // we decode + play it so the wearer hears the phone's surroundings. The
        // phone's Mute button just disables its own track — nothing needed here.
        this.voice = new RtcVoicePlayer(this.script)
        this.voice.start()
        this.session.onVoicePcm = (pcm, rate) => { if (this.voice) this.voice.enqueue(pcm, rate) }
        this.session.start()
        print("[WYB] Device WebRTC receive started (duplex pov video + one-way phone voice).")
    }

    /** Decoded rear-cam frame (RGBA8, vertically flipped) → ProceduralTexture.
     *  Mirrors CallStreamer.uploadFriendFrame: create once per size, then
     *  setPixels into the same texture (no per-frame GPU alloc). */
    private upload(rgba: Uint8Array, w: number, h: number): void {
        if (w <= 0 || h <= 0 || w > 1920 || h > 1920) return
        const need = w * h * 4
        if (rgba.length < need) return
        if (!this.procTex || this.texW !== w || this.texH !== h) {
            this.procTex = ProceduralTextureProvider.createWithFormat(w, h, TextureFormat.RGBA8Unorm)
            this.provider = this.procTex.control as ProceduralTextureProvider
            this.texW = w
            this.texH = h
            if (this.onTexture) this.onTexture(this.procTex)
            print("[WYB] Rear-cam texture created " + w + "x" + h)
        }
        const px = rgba.length === need ? rgba : rgba.subarray(0, need) as Uint8Array
        this.provider!.setPixels(0, 0, w, h, px)
        this.frames += 1
        if (this.frames === 1) print("[WYB] First rear-cam frame decoded → texture.")
    }

    statusLine(): string {
        return this.frames > 0 ? "LIVE · " + this.frames + " frames" : "device WebRTC — connecting…"
    }

    stop(): void {
        if (this.session) { this.session.stop(); this.session = null }
        if (this.mailbox) { this.mailbox.stop(); this.mailbox = null }
        if (this.voice) { this.voice.stop(); this.voice = null }
        this.procTex = null
        this.provider = null
        this.texW = 0
        this.texH = 0
    }
}
