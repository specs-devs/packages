/**
 * SPECS Inc. 2027
 * Wire types and validation for Snap Cloud Connected. They match Supabase/snapcloud-connected-setup.sql.
 * A pose is always expressed relative to the sender's placed origin: "p" in centimeters, "r" as a
 * quaternion [x, y, z, w] and "s" as a per-axis scale. World poses are never sent.
 */

export const ROOM_CODE_PATTERN = /^[0-9]{4}$/
export const MAX_SYNCED_TRANSFORMS = 64
export const MAX_ID_LENGTH = 80

export type RoomStatus = "waiting" | "active"

export interface RoomMember {
  seat: number
  ready: boolean
}

/** Room snapshot returned by every room RPC. */
export interface RoomInfo {
  id: string
  code: string
  seat: number
  max_players: number
  status: RoomStatus
  revision: number
  expires_at: string
  members: RoomMember[]
}

/** One synced transform. "o" is the ownership stamp, used for "Anyone" objects (higher stamp wins). */
export interface TransformPose {
  id: string
  p: number[]
  r: number[]
  s: number[]
  o?: number
}

export interface TransformState {
  entities: TransformPose[]
}

/** One player's row in connected_transforms. */
export interface TransformRow {
  room_id: string
  seat: number
  revision: number
  state: TransformState
  updated_at?: string
}

function finiteVector(v: any, n: number, limit: number): boolean {
  if (!Array.isArray(v) || v.length !== n) return false
  for (const x of v) if (typeof x !== "number" || !isFinite(x) || Math.abs(x) > limit) return false
  return true
}

export function validPose(e: any): e is TransformPose {
  return (
    !!e &&
    typeof e.id === "string" &&
    e.id.length >= 1 &&
    e.id.length <= MAX_ID_LENGTH &&
    finiteVector(e.p, 3, 100000) &&
    finiteVector(e.r, 4, 1.01) &&
    finiteVector(e.s, 3, 1000) &&
    (e.o === undefined || (typeof e.o === "number" && isFinite(e.o) && e.o >= 0))
  )
}

export function parseRoom(raw: any): RoomInfo | null {
  if (!raw || typeof raw.id !== "string" || typeof raw.code !== "string" || !ROOM_CODE_PATTERN.test(raw.code)) return null
  if (typeof raw.seat !== "number" || (raw.status !== "waiting" && raw.status !== "active")) return null
  const members: RoomMember[] = Array.isArray(raw.members)
    ? raw.members.filter((m: any) => m && typeof m.seat === "number").map((m: any) => ({seat: m.seat, ready: m.ready === true}))
    : []
  return {
    id: raw.id,
    code: raw.code,
    seat: raw.seat,
    max_players: typeof raw.max_players === "number" ? raw.max_players : 2,
    status: raw.status,
    revision: typeof raw.revision === "number" ? raw.revision : 0,
    expires_at: typeof raw.expires_at === "string" ? raw.expires_at : "",
    members
  }
}

export function parseTransformRow(raw: any): TransformRow | null {
  if (!raw || typeof raw.room_id !== "string" || typeof raw.seat !== "number" || typeof raw.revision !== "number") return null
  const entities = raw.state && Array.isArray(raw.state.entities) ? raw.state.entities.filter(validPose) : []
  return {room_id: raw.room_id, seat: raw.seat, revision: raw.revision, state: {entities}, updated_at: raw.updated_at}
}

/** Rounds to keep payloads small: 0.1 mm for positions, 1e-5 for rotations and scales. */
export function round(value: number, digits: number): number {
  const k = Math.pow(10, digits)
  return Math.round(value * k) / k
}

/** Random id for this Lens session, so two devices signed in to the same account still get separate seats. */
export function makeClientId(): string {
  let id = ""
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  for (let i = 0; i < 24; i++) id += chars.charAt(Math.floor(Math.random() * chars.length))
  return id
}
