/**
 * SPECS Inc. 2027
 * Wire format shared by the Lens host, the Snap Cloud validation (supabase/setup.sql) and the
 * iOS spectator app (SpectatorProtocol.swift). Keep the three in sync.
 *
 * Coordinates are centimetres in the stage frame: relative to the ARKitSpectator "Stage Origin"
 * SceneObject, +Y up, right-handed (the Lens Studio convention). The phone places the stage
 * origin on a real surface, so the same layout appears there at real-world scale.
 */

export const MAX_ENTITIES = 64
export const MAX_STATE_BYTES = 131072
export const MAX_ENTITY_DATA_BYTES = 2048
export const MAX_ROOM_DATA_BYTES = 8192
export const ROOM_CODE_PATTERN = /^[0-9]{4}$/

export type SpectatorPrimitive = "box" | "sphere" | "cylinder" | "plane" | "none"

/** Animation request for glTF entities. A new `id` re-triggers a one-shot clip. */
export interface SpectatorClip {
  name: string
  loop?: boolean
  id?: string
}

export interface SpectatorEntityState {
  /** Stable id, unique in the room (1–80 characters). */
  id: string
  name?: string
  /** Position in cm, stage frame. */
  p: [number, number, number]
  /** Rotation quaternion (x, y, z, w), stage frame. */
  r: [number, number, number, number]
  /** Scale relative to the stage origin. */
  s: [number, number, number]
  /** https URL of a .glb / .gltf the phone downloads and renders. */
  asset?: string
  /** Placeholder shape when there is no asset (default box). */
  primitive?: SpectatorPrimitive
  /** #RRGGBB or #RRGGBBAA tint for primitives. */
  color?: string
  visible?: boolean
  clip?: SpectatorClip
  /** Free-form JSON for your own spectator logic (≤ 2 KB). */
  data?: unknown
}

export interface SpectatorState {
  entities: SpectatorEntityState[]
  /** Free-form room-level JSON (≤ 8 KB). */
  data?: unknown
}

export interface SpectatorRoomInfo {
  id: string
  code: string
  role: "host" | "spectator"
  expires_at?: string
}

const ENTITY_KEYS = ["id", "name", "p", "r", "s", "asset", "primitive", "color", "visible", "clip", "data"]
const PRIMITIVES = ["box", "sphere", "cylinder", "plane", "none"]

function jsonBytes(value: unknown): number {
  // Close enough for ASCII-heavy payloads; the server enforces the exact byte limit.
  return JSON.stringify(value).length
}

function vector(v: unknown, n: number, limit: number): boolean {
  return Array.isArray(v) && v.length === n && v.every((x) => typeof x === "number" && isFinite(x) && Math.abs(x) <= limit)
}

/** Returns null when valid, otherwise the reason (mirrors spectator_validate_state). */
export function validateEntity(e: SpectatorEntityState): string | null {
  if (!e || typeof e !== "object") return "entity is not an object"
  for (const key of Object.keys(e)) if (ENTITY_KEYS.indexOf(key) < 0) return "unknown field " + key
  if (typeof e.id !== "string" || e.id.length < 1 || e.id.length > 80) return "id must be 1-80 characters"
  if (e.name !== undefined && (typeof e.name !== "string" || e.name.length > 80)) return "name too long"
  if (!vector(e.p, 3, 100000)) return "invalid position"
  if (!vector(e.r, 4, 1.01)) return "invalid rotation"
  if (!vector(e.s, 3, 1000)) return "invalid scale"
  if (e.asset !== undefined && (typeof e.asset !== "string" || e.asset.length > 512 || e.asset.indexOf("https://") !== 0))
    return "asset must be an https URL (max 512 characters)"
  if (e.primitive !== undefined && PRIMITIVES.indexOf(e.primitive) < 0) return "unknown primitive"
  if (e.color !== undefined && !/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(e.color)) return "color must be #RRGGBB or #RRGGBBAA"
  if (e.visible !== undefined && typeof e.visible !== "boolean") return "visible must be a boolean"
  if (e.data !== undefined && jsonBytes(e.data) > MAX_ENTITY_DATA_BYTES) return "data larger than 2 KB"
  if (e.clip !== undefined) {
    const c = e.clip
    if (!c || typeof c !== "object" || typeof c.name !== "string" || c.name.length < 1 || c.name.length > 80) return "invalid clip"
    if (c.loop !== undefined && typeof c.loop !== "boolean") return "invalid clip loop"
    if (c.id !== undefined && (typeof c.id !== "string" || c.id.length > 64)) return "invalid clip id"
  }
  return null
}

export function validateState(state: SpectatorState): string | null {
  if (!state || !Array.isArray(state.entities)) return "state.entities must be an array"
  if (state.entities.length > MAX_ENTITIES) return "more than " + MAX_ENTITIES + " entities"
  const seen: {[id: string]: boolean} = {}
  for (const e of state.entities) {
    const reason = validateEntity(e)
    if (reason) return (e && e.id ? e.id + ": " : "") + reason
    if (seen[e.id]) return "duplicate entity id " + e.id
    seen[e.id] = true
  }
  if (state.data !== undefined && jsonBytes(state.data) > MAX_ROOM_DATA_BYTES) return "room data larger than 8 KB"
  if (jsonBytes(state) > MAX_STATE_BYTES) return "state larger than 128 KB"
  return null
}

/** Rounds to a fixed number of decimals so unchanged poses serialize identically. */
export function round(value: number, decimals: number): number {
  const f = Math.pow(10, decimals)
  const r = Math.round(value * f) / f
  return r === 0 ? 0 : r // normalize -0
}
