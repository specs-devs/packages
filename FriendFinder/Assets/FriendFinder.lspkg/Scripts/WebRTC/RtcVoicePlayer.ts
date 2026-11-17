// RtcVoicePlayer — jitter-buffered playback of decoded inbound WebRTC voice PCM.
//
// Lifted from CallStreamer's playback path so Watch Your Back can play the
// phone's mic (one-way audio) WITHOUT pulling in the whole call streamer (which
// also owns mic capture + camera). Kept as its own class so the working Call
// Friend path is untouched. S16 mono PCM chunks in → batched to a WAV →
// RemoteMediaModule → a dedicated AudioComponent.

const remoteMediaModule = require("LensStudio:RemoteMediaModule") as RemoteMediaModule

// WebRTC voice arrives as smoothly-paced 20 ms frames; a short prime keeps
// latency low without underruns. Matches CallStreamer's tuning.
const RTC_PLAY_BUFFER_START_S = 0.5
const PLAY_BUFFER_MAX_S = 4
const PLAY_BATCH_MIN_S = 0.25

export class RtcVoicePlayer {
    private pcmQueue: Uint8Array[] = []
    private queuedBytes = 0
    private inRate = 0
    private playbackStarted = false
    private loadingBatch = false
    private running = false
    private readonly audioOut: AudioComponent
    private pump: UpdateEvent | null = null

    constructor(private readonly script: BaseScriptComponent) {
        this.audioOut = script.getSceneObject()
            .createComponent("Component.AudioComponent") as AudioComponent
        this.audioOut.volume = 1.0
        // LowPower (default) — LowLatency broke per-chunk dynamic tracks on device.
    }

    start(): void {
        if (this.running) return
        this.running = true
        this.pump = this.script.createEvent("UpdateEvent")
        this.pump.bind(() => this.pumpPlayback())
    }

    stop(): void {
        this.running = false
        if (this.pump) this.pump.enabled = false
        this.pump = null
        this.reset()
    }

    /** Decoded mono S16 PCM (+ its sample rate) into the jitter buffer. */
    enqueue(pcm: Uint8Array, rate: number): void {
        if (!this.running) return
        if (this.inRate !== 0 && rate !== this.inRate) this.reset()
        this.inRate = rate
        this.pcmQueue.push(pcm)
        this.queuedBytes += pcm.length
        const maxBytes = PLAY_BUFFER_MAX_S * this.inRate * 2
        while (this.queuedBytes > maxBytes && this.pcmQueue.length > 1) {
            this.queuedBytes -= this.pcmQueue.shift()!.length
        }
    }

    private reset(): void {
        this.pcmQueue = []
        this.queuedBytes = 0
        this.inRate = 0
        this.playbackStarted = false
    }

    private pumpPlayback(): void {
        if (!this.running || this.loadingBatch || this.audioOut.isPlaying()) return
        if (this.inRate === 0) return
        if (this.pcmQueue.length === 0) {
            this.playbackStarted = false // drained — re-prime on the next chunk
            return
        }
        const queuedS = this.queuedBytes / (this.inRate * 2)
        const threshold = this.playbackStarted ? PLAY_BATCH_MIN_S : RTC_PLAY_BUFFER_START_S
        if (queuedS < threshold) return

        const pcm = new Uint8Array(this.queuedBytes)
        let offset = 0
        for (const c of this.pcmQueue) { pcm.set(c, offset); offset += c.length }
        this.pcmQueue = []
        this.queuedBytes = 0
        const wav = this.wavFromPcm(pcm, this.inRate)

        this.loadingBatch = true
        try {
            const resource = DynamicResource.createWithBuffer(wav)
            remoteMediaModule.loadResourceAsAudioTrackAsset(
                resource,
                (track: AudioTrackAsset) => {
                    this.loadingBatch = false
                    this.audioOut.audioTrack = track
                    this.audioOut.play(1)
                    this.playbackStarted = true
                },
                (err: string) => {
                    this.loadingBatch = false
                    print("[RtcVoice] batch load failed: " + err)
                }
            )
        } catch (e) {
            this.loadingBatch = false
            print("[RtcVoice] batch error: " + e)
        }
    }

    /** 16-bit mono PCM bytes → WAV for the RemoteMediaModule playback path. */
    private wavFromPcm(pcmBytes: Uint8Array, sampleRate: number): Uint8Array {
        const dataSize = pcmBytes.length
        const header = new ArrayBuffer(44)
        const view = new DataView(header)
        view.setUint32(0, 0x52494646, false)  // "RIFF"
        view.setUint32(4, 36 + dataSize, true)
        view.setUint32(8, 0x57415645, false)  // "WAVE"
        view.setUint32(12, 0x666d7420, false) // "fmt "
        view.setUint32(16, 16, true)
        view.setUint16(20, 1, true)           // PCM
        view.setUint16(22, 1, true)           // mono
        view.setUint32(24, sampleRate, true)
        view.setUint32(28, sampleRate * 2, true)
        view.setUint16(32, 2, true)
        view.setUint16(34, 16, true)
        view.setUint32(36, 0x64617461, false) // "data"
        view.setUint32(40, dataSize, true)
        const wav = new Uint8Array(44 + dataSize)
        wav.set(new Uint8Array(header), 0)
        wav.set(pcmBytes, 44)
        return wav
    }
}
