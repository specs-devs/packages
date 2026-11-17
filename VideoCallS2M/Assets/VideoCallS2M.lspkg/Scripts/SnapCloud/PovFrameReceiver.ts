// PovFrameReceiver — live POV frames for one streamer over Realtime.
//
// Subscribes to `frame:<streamer>` broadcasts on the shared session channel
// and decodes each base64 JPEG straight to a texture. If a frame arrives
// while a decode is still in flight, only the newest is kept — the panel
// always shows live, never a backlog. onWaiting fires while no frame has
// arrived for STALL_S (stream not started yet, or stalled) — same contract
// as the v1 poll-until-404-stops behavior.

import Event, { PublicApi } from "InteractionKit.lspkg/Utils/Event"
import { Realtime } from "./Realtime"
import { FramePayload } from "../App/Types"

const STALL_S = 3.0

export class PovFrameReceiver {
    private _onFrame = new Event<Texture>()
    private _onWaiting = new Event<void>()
    get onFrame(): PublicApi<Texture> { return this._onFrame.publicApi() }
    get onWaiting(): PublicApi<void> { return this._onWaiting.publicApi() }

    private running = false
    private decoding = false
    private pendingB64: string | null = null
    private lastFrameAt = -1
    private stallTicker: DelayedCallbackEvent | null = null
    private frameCount = 0
    // Rolling stats (printed every STATS_S while live) — measure real fps on device.
    private statFrames = 0
    private statSkipped = 0
    private statStart = -1

    constructor(
        private readonly script: BaseScriptComponent,
        private readonly rt: Realtime,
        private readonly streamer: string
    ) {}

    start(): void {
        if (this.running) return
        this.running = true
        this.rt.onFrame(this.streamer, (p) => this.handleFrame(p))
        this.stallTicker = this.script.createEvent("DelayedCallbackEvent")
        this.stallTicker.bind(() => {
            if (!this.running || !this.stallTicker) return
            if (this.lastFrameAt < 0 || getTime() - this.lastFrameAt > STALL_S) {
                this._onWaiting.invoke()
            }
            this.stallTicker.reset(STALL_S)
        })
        this.stallTicker.reset(STALL_S)
        print("[PovRx] Listening for " + this.streamer + " frames over Realtime.")
    }

    stop(): void {
        this.running = false
        this.rt.offFrame(this.streamer)
        this.pendingB64 = null
    }

    private handleFrame(p: FramePayload): void {
        if (!this.running || !p || !p.d) return
        if (this.decoding) {
            if (this.pendingB64 !== null) this.statSkipped += 1
            this.pendingB64 = p.d
            return
        }
        this.decode(p.d)
    }

    private decode(b64: string): void {
        this.decoding = true
        Base64.decodeTextureAsync(
            b64,
            (texture: Texture) => {
                this.decoding = false
                this.lastFrameAt = getTime()
                this.frameCount += 1
                if (this.frameCount === 1) {
                    print("[PovRx] First frame from " + this.streamer)
                }
                this.tickStats()
                this._onFrame.invoke(texture)
                const next = this.pendingB64
                this.pendingB64 = null
                if (next && this.running) this.decode(next)
            },
            () => {
                this.decoding = false
                this.pendingB64 = null
            }
        )
    }

    private tickStats(): void {
        const STATS_S = 5
        this.statFrames += 1
        if (this.statStart < 0) {
            this.statStart = getTime()
            return
        }
        const elapsed = getTime() - this.statStart
        if (elapsed >= STATS_S) {
            const fps = this.statFrames / elapsed
            print("[PovRx] " + this.streamer + " " + fps.toFixed(1) + " fps" +
                (this.statSkipped > 0 ? " (" + this.statSkipped + " dropped behind decode)" : ""))
            this.statFrames = 0
            this.statSkipped = 0
            this.statStart = getTime()
        }
    }
}
