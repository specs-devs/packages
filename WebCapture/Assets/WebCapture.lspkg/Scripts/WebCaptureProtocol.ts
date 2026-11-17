/**
 * SPECS Inc. 2027
 * Web Capture data formats, shared by the Lens, the Lens Studio plugin and the web portal.
 *
 * - Scene snapshot ("webcapture-scene/1"): the live state of the captured objects, sent while the
 *   Lens runs so the portal can rebuild the scene.
 * - Recording ("webcapture/1"): what happened while recording, as per-object keyframe tracks. Only
 *   changes are stored, so a recording stays small (a "light config file").
 *
 * Units: positions in cm and rotations as quaternions [x, y, z, w], both relative to the capture
 * origin; scale is a factor. Times are seconds from the start of the recording.
 */

export const SCENE_FORMAT = "webcapture-scene/1"
export const RECORDING_FORMAT = "webcapture/1"
export const PACKAGE_VERSION = "4.0.0"

/** Upper bounds that keep messages and Snap Cloud rows small. */
export const MAX_OBJECTS = 128
export const MAX_NAME_LENGTH = 80
export const MAX_TEXT_LENGTH = 280
export const MAX_RECORDING_SECONDS = 90
export const MAX_RECORDING_BYTES = 120 * 1024 * 1024

export type Primitive = "box" | "sphere" | "cylinder" | "plane" | "text" | "mesh" | "panel" | "empty"
export const PRIMITIVES: Primitive[] = ["box", "sphere", "cylinder", "plane", "text", "mesh", "panel", "empty"]

/** Position (3), rotation quaternion (4) and scale (3): 10 numbers. */
export type Pose = number[]
export const POSE_LENGTH = 10
/** Camera: position (3), rotation (4), vertical field of view in degrees (1). */
export type CameraPose = number[]
export const CAMERA_POSE_LENGTH = 8

/** Static description of one captured object. */
export interface CaptureObject {
  id: string
  name: string
  /** Id of the captured parent, or null when the object is drawn relative to the capture origin. */
  parent: string | null
  primitive: Primitive
  /** RGBA, 0–1. */
  color: number[]
  /** Local bounds of the mesh in cm (min xyz, max xyz) when known. */
  bounds?: number[]
  /** Mesh asset name, as a hint for the portal. */
  mesh?: string
  /** Key into recording.assets.meshes when the real geometry was captured. */
  meshId?: string
  /** Materials of the mesh (the portal uses the first). */
  materials?: CaptureMaterial[]
  text?: string
  /** `panel` only: width and height in cm, corner radius in cm, optional border (RGBA + unused), draw order. */
  size?: number[]
  radius?: number
  border?: number[]
  layer?: number
  /** `text` only: the Lens's Text size, so the portal draws it as large as the Lens did. */
  textSize?: number
}

/** What the portal needs to shade a mesh. `tex` is a key into recording.assets.textures. */
export interface CaptureMaterial {
  tex?: string
  twoSided?: boolean
  alpha?: "opaque" | "blend" | "mask"
  unlit?: boolean
  roughness?: number
  metalness?: number
}

/** Mesh and texture data, stored once per recording. Arrays are base64 little-endian Float32 / Uint32. */
export interface CaptureAssetsData {
  meshes: {[id: string]: {p: string; n?: string; u?: string; i?: string}}
  /** Data URLs (JPEG). */
  textures: {[id: string]: string}
}

/** The background texture over time: data-URL JPEG frames at times `t` (seconds from the recording start). */
export interface CaptureBackground {
  t: number[]
  frames: string[]
  /** Pixel size of the frames when known (the real camera frame on Specs). */
  width?: number
  height?: number
  /** "ndk" = the Specs camera through the NDK, "texture" = a texture (Lens Studio). */
  source?: string
  /**
   * The camera as hardware-encoded H.265 (NDK `camera` layer): base64 batches of NKC1 packets
   * `[u8 layer][u8 flags: bit0 = key][u16 0][u64 ts_ns][u32 size][Annex-B payload]` (little-endian), timestamps on the
   * native clock; `startNs` is that clock at the recording start, so packet time = (ts_ns - startNs) / 1e9.
   */
  video?: {
    codec: string
    batches: string[]
    startNs: number
    fps: number
    offsetNs?: number
    /** Reference only: the AR layer rendered by the system from the capture camera's viewpoint (same clock as the video). */
    ar?: {codec: string; batches: string[]; eye: number}
  }
  // A frame captured at packet time ts is at (ts + offsetNs - startNs) / 1e9 seconds on the recording's timeline.
}

/** Values that may change while the Lens runs (besides the pose). */
export interface CaptureParams {
  visible?: boolean
  color?: number[]
  text?: string
}

/** Live state of the scene, sent while the Lens runs. */
export interface SceneSnapshot {
  format: string
  session: string
  revision: number
  /** Seconds since the Lens started. */
  time: number
  lens: string
  objects: CaptureObject[]
  poses: {[id: string]: Pose}
  params: {[id: string]: CaptureParams}
  camera: CameraPose | null
  recording: {id: string; elapsed: number} | null
}

/** Keyframes for one object: times plus a flat array of poses (POSE_LENGTH numbers per time). */
export interface PoseTrack {
  t: number[]
  v: number[]
}

export interface ParamKey {
  t: number
  id: string
  params: CaptureParams
}

export interface RecordingMeta {
  id: string
  name: string
  lens: string
  createdAt: string
  /** Sampling rate the Lens recorded at (keyframes are only stored on change). */
  rate: number
  duration: number
  /** Width / height of the Lens camera frame. The portal replays at this aspect so the background and 3D line up. */
  aspect?: number
  /** The real color camera (Specs): the portal draws the scene through it. See CameraCalibration.ts. */
  camera?: {focal: number[]; principal: number[]; resolution: number[]; p: number[]; q: number[]}
  /** Set when the heavy parts (assets, background) live in Snap Cloud Storage instead of this row. */
  storage?: {bucket: string; path: string; bytes: number}
  packageVersion: string
  lensStudio?: string
  device?: string
  tolerance: {position: number; rotation: number; scale: number}
}

/** A recording: everything the portal needs to rebuild and replay the capture. */
export interface Recording {
  format: string
  meta: RecordingMeta
  objects: CaptureObject[]
  tracks: {[id: string]: PoseTrack}
  camera: {t: number[]; v: number[]}
  params: ParamKey[]
  /** Free-form markers added from code with WebCapture.mark(). */
  markers: {t: number; label: string}[]
  assets?: CaptureAssetsData
  background?: CaptureBackground
  /** Portal edits (trim, cuts, look, titles). The Lens never writes this. */
  edits?: unknown
}

export function round(value: number, digits: number): number {
  const f = Math.pow(10, digits)
  return Math.round(value * f) / f
}

export function clampString(value: string, max: number): string {
  if (!value) return ""
  return value.length > max ? value.substring(0, max) : value
}

/** Short random id (base36). Not cryptographic; only used to name sessions and recordings. */
export function makeId(prefix: string): string {
  let s = ""
  for (let i = 0; i < 10; i++) s += Math.floor(Math.random() * 36).toString(36)
  return prefix + "-" + s
}

export function isoNow(): string {
  try {
    return new Date().toISOString()
  } catch {
    return ""
  }
}

/** Largest absolute component difference between two poses, split into position, rotation and scale. */
export function poseDelta(a: Pose, b: Pose): {p: number; r: number; s: number} {
  const p = Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))
  // q and -q are the same rotation: compare against the closer one.
  const dot = a[3] * b[3] + a[4] * b[4] + a[5] * b[5] + a[6] * b[6]
  const sign = dot < 0 ? -1 : 1
  let r = 0
  for (let i = 3; i < 7; i++) r = Math.max(r, Math.abs(a[i] - sign * b[i]))
  const s = Math.max(Math.abs(a[7] - b[7]), Math.abs(a[8] - b[8]), Math.abs(a[9] - b[9]))
  return {p: p, r: r, s: s}
}

export function sameParams(a: CaptureParams | undefined, b: CaptureParams | undefined): boolean {
  return JSON.stringify(a || {}) === JSON.stringify(b || {})
}

/** Checks a recording before it is saved. Returns a problem description, or null when it is fine. */
export function validateRecording(rec: Recording): string | null {
  if (!rec || rec.format !== RECORDING_FORMAT) return "not a " + RECORDING_FORMAT + " recording"
  if (!rec.meta || !rec.meta.id) return "missing meta.id"
  if (!rec.objects || rec.objects.length === 0) return "no objects were captured"
  if (rec.objects.length > MAX_OBJECTS) return "too many objects (max " + MAX_OBJECTS + ")"
  for (const id in rec.tracks) {
    const track = rec.tracks[id]
    if (track.v.length !== track.t.length * POSE_LENGTH) return "track " + id + " has a bad length"
  }
  if (rec.camera && rec.camera.v.length !== rec.camera.t.length * CAMERA_POSE_LENGTH)
    return "camera track has a bad length"
  return null
}

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

function fnv32(text: string, seed: number): number {
  let h = seed >>> 0
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

/**
 * The project's capture id, derived from the Snap Cloud project URL and public key. The Lens and the portal
 * compute the same value, so recordings from every run and device appear in the portal with nothing to type.
 * Keep identical to projectCode() in WebCapturePortal/src/sources.js.
 */
export function projectCode(url: string, key: string): string {
  const text = url.replace(/\/+$/, "").toLowerCase() + "|" + key
  let out = "WC-"
  for (const seed of [0x811c9dc5, 0x01000193, 0xdeadbeef]) {
    let h = fnv32(text, seed)
    for (let i = 0; i < 5; i++) {
      out += CODE_ALPHABET.charAt(h % CODE_ALPHABET.length)
      h = Math.floor(h / CODE_ALPHABET.length)
    }
  }
  return out
}
