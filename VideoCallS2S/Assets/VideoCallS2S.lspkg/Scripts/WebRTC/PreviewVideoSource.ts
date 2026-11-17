// PreviewVideoSource — an animated synthetic feed for the Lens Studio preview.
//
// The native WebRTC module only loads on device, so in the editor the call
// panel would stay blank. This test pattern stands in — obviously "live"
// (a scan line sweeps down a scrolling gradient) and obviously fake — so the
// panel layout and captions stay iterable in preview. Never used on device.

export class SyntheticVideoSource {
    onTexture: ((tex: Texture) => void) | null = null

    private readonly w = 320
    private readonly h = 180
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
        print("[PreviewVideo] Editor synthetic feed started (" + this.w + "x" + this.h + ").")
    }

    private render(): void {
        if (!this.provider) return
        this.frame += 1
        const t = this.frame
        const scan = (t * 2) % this.h
        let i = 0
        for (let y = 0; y < this.h; y++) {
            const onScan = Math.abs(y - scan) < 3
            for (let x = 0; x < this.w; x++) {
                if (onScan) {
                    this.px[i] = 255
                    this.px[i + 1] = 255
                    this.px[i + 2] = 255
                } else {
                    const g = (x + y + t * 2) & 0xff
                    this.px[i] = (g >> 1) & 0xff
                    this.px[i + 1] = (200 - (g >> 1)) & 0xff
                    this.px[i + 2] = (120 + (t & 0x7f)) & 0xff
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
