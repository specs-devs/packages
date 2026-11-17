import {CapturedFrame} from './SocialClient'
// Extracted capture pattern from SnapCloudExamples/Example5-Media. Encode one
// frame at a time; upload after recording to avoid network contention on device.
export class CameraRecorder {
  private module: CameraModule = require('LensStudio:CameraModule')
  private texture: Texture
  private frames: CapturedFrame[] = []
  private startTime = 0
  private nextFrame = 0
  private recording = false
  private pending: Promise<void> | null = null
  private memory = 0
  private alive = true
  constructor(private script: BaseScriptComponent, private fps: number, private maxSeconds: number, private onLimit: () => void, private onError: (message: string) => void, composite?: Texture) {
    if (composite) this.texture = composite
    else {
      const request = CameraModule.createCameraRequest()
      request.cameraId = global.deviceInfoSystem.isEditor() ? CameraModule.CameraId.Default_Color : CameraModule.CameraId.Right_Color
      this.texture = this.module.requestCamera(request)
    }
    script.createEvent('UpdateEvent').bind(() => this.update())
  }
  start(): void {
    if (!this.texture || this.texture.getWidth() === 0 || this.texture.getHeight() === 0) throw new Error('Camera is not ready')
    this.frames = []; this.memory = 0; this.startTime = getTime(); this.nextFrame = 0; this.recording = true
  }
  private update(): void {
    if (!this.recording) return
    const time = getTime() - this.startTime
    if (time >= this.maxSeconds || this.memory >= 32 * 1024 * 1024) {
      this.recording = false; this.onLimit(); return
    }
    if (this.pending || time < this.nextFrame) return
    this.nextFrame = time + 1 / this.fps
    this.pending = encode(this.texture).then(bytes => {
      if (!this.alive) return
      this.memory += bytes.length; this.frames.push({bytes, time})
    }).catch(() => {this.recording = false; this.onError('Frame capture failed. Record again.');}).then(() => {this.pending = null})
  }
  async stop(): Promise<CapturedFrame[]> {
    this.recording = false
    if (this.pending) await this.pending
    if (this.frames.length < 2) throw new Error('Record a longer clip')
    const result = this.frames; this.frames = []; return result
  }
  async photo(): Promise<CapturedFrame[]> {return [{bytes: await encode(this.texture), time: 0}]}
  destroy(): void {this.alive = false; this.recording = false; this.frames = []; this.texture = null}
}
function encode(texture: Texture): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    if (!texture || texture.getWidth() === 0) {reject(new Error('Camera not ready')); return}
    Base64.encodeTextureAsync(texture, text => resolve(decode(text)), () => reject(new Error('Camera encoding failed')), CompressionQuality.IntermediateQuality, EncodingType.Jpg)
  })
}
function decode(text: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const lookup = new Uint8Array(256)
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i
  const size = text.length * 3 / 4 - (text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0)
  const output = new Uint8Array(size)
  for (let i = 0, p = 0; i < text.length; i += 4) {
    const a = lookup[text.charCodeAt(i)], b = lookup[text.charCodeAt(i + 1)], c = lookup[text.charCodeAt(i + 2)], d = lookup[text.charCodeAt(i + 3)]
    if (p < size) output[p++] = (a << 2) | (b >> 4)
    if (p < size) output[p++] = ((b & 15) << 4) | (c >> 2)
    if (p < size) output[p++] = ((c & 3) << 6) | d
  }
  return output
}
