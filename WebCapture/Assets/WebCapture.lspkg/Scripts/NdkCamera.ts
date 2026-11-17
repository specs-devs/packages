/**
 * SPECS Inc. 2027
 * Camera frames on Specs through the NDKCapture native module (SpecsNDK): a low-rate JPEG proxy of the
 * real camera, at the camera's own resolution and aspect ratio. Used as the capture's background track.
 * In the Lens Studio editor the native module is unavailable and the texture background is used instead.
 */
import {loadNDKCaptureNative, NDKCaptureNativeExports} from "NDKCapture.lspkg/Scripts/NDKCaptureNativeModule"

export interface NdkFrame {
  /** Seconds on the native monotonic clock. */
  t: number
  /** Base64 JPEG. */
  b64: string
}

export class NdkCamera {
  private native: NDKCaptureNativeExports | null = null
  private running = false

  /** Loads the module. Resolves false in the editor or when the module can't load. */
  async load(log: (message: string) => void): Promise<boolean> {
    this.native = await loadNDKCaptureNative(log)
    return !!this.native
  }

  get available(): boolean {
    return !!this.native
  }

  /** Starts the proxy: JPEG frames up to `maxWidth` px wide at `quality` (1-100) and `fps`. */
  start(maxWidth: number, quality: number, fps: number): boolean {
    if (!this.native) return false
    const result = this.native.startProxy(Math.round(maxWidth), Math.round(quality), Math.round(fps))
    this.running = result === 0
    return this.running
  }

  stop(): void {
    if (this.native && this.running) this.native.stopProxy()
    this.running = false
  }

  /**
   * Debug/ground truth: also let the device write its own composite (camera + AR, as the system captures it) to an
   * MP4. The Lens sandbox decides which folders are writable, so a few are tried; the first that works is used.
   * Returns the file path (pull it with `adb pull`), or null.
   */
  startReference(name: string, width: number, height: number, log: (message: string) => void): string | null {
    if (!this.native) return null
    const folders = ["/data/local/tmp", "/tmp", "/sdcard", "/data/snapos/user/0/app", "."]
    for (const folder of folders) {
      const path = folder + "/" + name + ".mp4"
      let result = -99
      try {
        result = this.native.startComposite(path, 1, 0, 1, width, height, 0, 0)
      } catch (e) {
        log("Reference composite " + path + " threw: " + e)
      }
      if (result === 0) {
        this.referenceRunning = true
        log("Reference composite recording to " + path)
        return path
      }
      log("Reference composite " + path + " refused (" + result + ")")
    }
    return null
  }

  stopReference(): void {
    if (this.native && this.referenceRunning) this.native.stopComposite()
    this.referenceRunning = false
  }

  private referenceRunning = false

  // ---- H.265 camera layer (SpecsRecorder VIDEO): hardware-encoded, native clock timestamps, no JPEG per frame.

  private videoRunning = false

  /** Starts the camera as an H.265 stream. bitrate in bits per second (0 = SDK default). */
  startVideo(fps: number, bitrate: number, log: (message: string) => void): boolean {
    if (!this.native) return false
    const rateControl = bitrate > 0 ? 1 : 0
    this.native.configureLayer("camera", Math.round(fps), Math.round(bitrate), Math.round(fps), rateControl, 0)
    const started = this.native.startLayer("camera")
    if (started !== 0) {
      log("H.265 camera layer could not start (" + started + ")")
      return false
    }
    this.native.streamLayer("camera", 1)
    this.videoRunning = true
    return true
  }

  stopVideo(): void {
    if (!this.native || !this.videoRunning) return
    this.native.streamLayer("camera", 0)
    this.native.stopLayer("camera")
    this.videoRunning = false
  }

  // ---- AR layer (SpecsRecorder AR_VIDEO). eye 4 = rendered from the capture camera's viewpoint (recent SPECS OS builds).
  private arRunning = false

  startAr(fps: number, bitrate: number, eye: number, log: (message: string) => void): boolean {
    if (!this.native) return false
    this.native.configureLayer("ar", Math.round(fps), Math.round(bitrate), Math.round(fps), bitrate > 0 ? 1 : 0, eye)
    const started = this.native.startLayer("ar")
    if (started !== 0) {
      log("AR reference layer could not start (" + started + ")")
      return false
    }
    this.native.streamLayer("ar", 1)
    this.arRunning = true
    return true
  }

  stopAr(): void {
    if (!this.native || !this.arRunning) return
    this.native.streamLayer("ar", 0)
    this.native.stopLayer("ar")
    this.arRunning = false
  }

  pollAr(maxBytes: number): string | null {
    if (!this.native || !this.arRunning) return null
    const data = this.native.pollLayer("ar", maxBytes)
    return data ? data : null
  }

  /** The native layer counters as JSON (frames, queued, dropped, lastTs per layer), or "" when unavailable. */
  layerStats(): string {
    if (!this.native) return ""
    try {
      return this.native.stats()
    } catch (e) {
      return ""
    }
  }

  /** Base64 of NKC1-framed packets (up to maxBytes), or null when nothing is queued. */
  pollVideo(maxBytes: number): string | null {
    if (!this.native || !this.videoRunning) return null
    const data = this.native.pollLayer("camera", maxBytes)
    return data ? data : null
  }

  /** The native clock now, in seconds (same clock as frame timestamps). */
  now(): number {
    return this.native ? this.native.clockNs() / 1e9 : 0
  }

  /** The newest frame not read yet, or null. */
  poll(): NdkFrame | null {
    if (!this.native || !this.running) return null
    const raw = this.native.proxyFrame()
    if (!raw) return null
    const i = raw.indexOf(":")
    if (i <= 0) return null
    return {t: Number(raw.substring(0, i)) / 1e9, b64: raw.substring(i + 1)}
  }
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

/** True when the first NKC1 packet of a base64 batch is a keyframe (flags byte, bit 0). */
export function firstPacketIsKey(b64: string): boolean {
  const head = b64.substring(0, 4)
  const bytes: number[] = []
  let acc = 0
  let bits = 0
  for (let i = 0; i < head.length; i++) {
    const v = B64.indexOf(head.charAt(i))
    if (v < 0) continue
    acc = (acc << 6) | v
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((acc >> bits) & 255)
      acc &= (1 << bits) - 1
    }
  }
  return bytes.length >= 2 && (bytes[1] & 1) === 1
}

/** Timestamp (ns, native packet clock) of the first NKC1 packet in a base64 batch, read from its 16-byte header. */
export function firstPacketNs(b64: string): number {
  const head = b64.substring(0, 24)
  const bytes: number[] = []
  let acc = 0
  let bits = 0
  for (let i = 0; i < head.length; i++) {
    const v = B64.indexOf(head.charAt(i))
    if (v < 0) continue
    acc = (acc << 6) | v
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((acc >> bits) & 255)
      acc &= (1 << bits) - 1
    }
  }
  if (bytes.length < 16) return 0
  // u64 little-endian at offset 4; a double holds it exactly for ~104 days of uptime.
  let ts = 0
  for (let i = 11; i >= 4; i--) ts = ts * 256 + bytes[i]
  return ts
}

/** Width and height of a base64 JPEG, read from its first bytes (no decoding). */
export function jpegSize(b64: string): {width: number; height: number} | null {
  const head = b64.substring(0, 8192)
  const bytes: number[] = []
  let acc = 0
  let bits = 0
  for (let i = 0; i < head.length; i++) {
    const v = B64.indexOf(head.charAt(i))
    if (v < 0) continue
    acc = (acc << 6) | v
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((acc >> bits) & 255)
      acc &= (1 << bits) - 1
    }
  }
  let i = 2
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++
      continue
    }
    const marker = bytes[i + 1]
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return {height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8]}
    }
    i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3])
  }
  return null
}
