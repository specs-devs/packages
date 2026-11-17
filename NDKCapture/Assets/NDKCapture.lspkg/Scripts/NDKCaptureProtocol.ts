/**
 * SPECS Inc. 2027
 * NDK Capture protocol: layer ids, per-layer settings, the session manifest (ndkcapture/1) and
 * the messages exchanged with the NDK Capture Studio (Lens Studio plugin, ws://127.0.0.1:47793).
 * See Docs/format.md for the on-disk layout.
 */

export const PACKAGE_VERSION = "4.0.0"
export const MANIFEST_FORMAT = "ndkcapture/1"
export const DEFAULT_STUDIO_URL = "ws://127.0.0.1:47793"

/** camera / ar / mic are native SpecsRecorder layers; ui is a proxy-only visual layer. */
export type LayerId = "camera" | "ar" | "ui" | "mic"
export const VISUAL_LAYERS: LayerId[] = ["camera", "ar", "ui"]
export const ALL_LAYERS: LayerId[] = ["camera", "ar", "ui", "mic"]

/** Codec of the packets a layer produces. hevc/aac come from the native module, jpeg from a proxy. */
export type LayerCodec = "hevc" | "aac" | "jpeg"

export type BlendMode = "normal" | "add" | "screen" | "multiply"

export interface LayerTransform {
  /** Offset in output-relative units (0 = centered, 1 = one output width/height). */
  x: number
  y: number
  scale: number
  rotation: number
}

/**
 * Everything that can be changed per layer, live while streaming and again later in the Studio.
 * Encoding fields (fps, bitrate, keyFrameInterval) drive the native encoder; composition fields
 * (opacity, blend, transform, z) only describe how the layer is composited, so recordings keep
 * every layer untouched and the composite can be re-done later.
 */
/**
 * Proxy frames are JPEG (no alpha). AR and UI layers therefore default to "screen", where black is
 * transparent, the same way the Spectacles additive display shows them.
 */
export interface LayerSettings {
  enabled: boolean
  opacity: number
  blend: BlendMode
  transform: LayerTransform
  z: number
  fps: number
  bitrate: number
  keyFrameInterval: number
  /** Proxy JPEG frames per second (live preview / editing proxy). */
  proxyFps: number
}

export function defaultSettings(layer: LayerId): LayerSettings {
  return {
    enabled: layer !== "ui",
    opacity: 1,
    blend: layer === "camera" || layer === "mic" ? "normal" : "screen",
    transform: {x: 0, y: 0, scale: 1, rotation: 0},
    z: layer === "camera" ? 0 : layer === "ar" ? 1 : 2,
    fps: layer === "mic" ? 0 : 30,
    bitrate: 0,
    keyFrameInterval: 30,
    proxyFps: layer === "mic" ? 0 : 6
  }
}

export interface Marker {
  /** Milliseconds since the session started. */
  t: number
  label: string
  color: string
  layer?: LayerId
}

/** A change of one or more settings of one layer at time t (ms since session start). */
export interface SettingsChange {
  t: number
  layer: LayerId
  set: Partial<LayerSettings>
}

export interface LayerTrack {
  id: LayerId
  kind: "video" | "audio"
  codec: LayerCodec
  /** "native" = SpecsRecorder encoded packets, "proxy" = JPEG frames from the Lens / proxy. */
  source: "native" | "proxy"
  /** Track file inside the recording folder (written by the Studio). */
  file: string
}

export interface SessionManifest {
  format: string
  version: string
  id: string
  name: string
  createdAt: string
  lens: string
  durationMs: number
  device: "specs" | "editor"
  ndk: string
  layers: LayerTrack[]
  initial: {[layer: string]: LayerSettings}
  timeline: SettingsChange[]
  markers: Marker[]
  /** Native packet clock (ns) at t = 0, to place native packets on the session timeline. */
  clock?: {nativeStartNs: number}
  /** Track files and composite MP4 written on the device (when a device folder is set). */
  deviceFiles?: {[name: string]: string}
  /** Finished SpecsCapture MP4 (camera + AR composited + audio), when recorded on device. */
  composite?: {file: string; withAr: boolean; blend: string; alpha: number}
}

/** Lens → Studio */
export type LensMessage =
  | {type: "hello"; lens: string; device: string; ndk: string; version: string; layers: LayerId[]}
  | {type: "settings"; layers: {[layer: string]: LayerSettings}}
  | {type: "frame"; layer: LayerId; t: number; codec: "jpeg"; data: string}
  | {type: "packets"; layer: LayerId; codec: LayerCodec; data: string}
  | {type: "stats"; stats: string}
  | {type: "record-begin"; manifest: SessionManifest}
  | {type: "record-change"; change: SettingsChange}
  | {type: "record-marker"; marker: Marker}
  | {type: "record-end"; manifest: SessionManifest}

/** Studio → Lens */
export interface StudioCommand {
  type: "command"
  action: "setLayer" | "startStream" | "stopStream" | "startRecording" | "stopRecording" | "marker" | "keyFrame"
  args: {[key: string]: unknown}
}

export function makeId(prefix: string): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789"
  let s = ""
  for (let i = 0; i < 8; i++) s += alphabet.charAt(Math.floor(Math.random() * alphabet.length))
  return prefix + "-" + s
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** Validate and clamp a settings patch coming from the Studio. Unknown fields are dropped. */
export function sanitizeSettings(patch: {[key: string]: unknown}): Partial<LayerSettings> {
  const out: Partial<LayerSettings> = {}
  const n = (k: string): number | null => (typeof patch[k] === "number" && isFinite(patch[k] as number) ? (patch[k] as number) : null)
  if (typeof patch.enabled === "boolean") out.enabled = patch.enabled
  if (n("opacity") !== null) out.opacity = clamp(n("opacity") as number, 0, 1)
  if (patch.blend === "normal" || patch.blend === "add" || patch.blend === "screen" || patch.blend === "multiply")
    out.blend = patch.blend
  if (n("z") !== null) out.z = Math.round(n("z") as number)
  if (n("fps") !== null) out.fps = clamp(Math.round(n("fps") as number), 0, 60)
  if (n("bitrate") !== null) out.bitrate = clamp(Math.round(n("bitrate") as number), 0, 50000000)
  if (n("keyFrameInterval") !== null) out.keyFrameInterval = clamp(Math.round(n("keyFrameInterval") as number), 0, 300)
  if (n("proxyFps") !== null) out.proxyFps = clamp(Math.round(n("proxyFps") as number), 0, 30)
  const t = patch.transform as {[key: string]: unknown} | undefined
  if (t && typeof t === "object") {
    const num = (k: string, d: number): number => (typeof t[k] === "number" && isFinite(t[k] as number) ? (t[k] as number) : d)
    out.transform = {
      x: clamp(num("x", 0), -2, 2),
      y: clamp(num("y", 0), -2, 2),
      scale: clamp(num("scale", 1), 0.05, 4),
      rotation: clamp(num("rotation", 0), -360, 360)
    }
  }
  return out
}
