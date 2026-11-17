/**
 * SPECS Inc. 2027
 * Snap Cloud (Supabase) transport for Snap Cloud Connected: sign-in, 4-digit room create/join,
 * readiness, heartbeats, publishing this player's transform row, and Realtime Postgres Changes for
 * room status and the other players' rows. Uses the RPCs from Supabase/snapcloud-connected-setup.sql.
 */
import {createClient, RealtimeChannel, SupabaseClient} from "SupabaseClient.lspkg/supabase-snapcloud"
import {
  makeClientId,
  parseRoom,
  parseTransformRow,
  ROOM_CODE_PATTERN,
  RoomInfo,
  TransformRow,
  TransformState
} from "./ConnectedProtocol"

export type ConnectedAuthMode = "snapchat-then-anonymous" | "snapchat" | "anonymous"

export interface ConnectedRoomCallbacks {
  status: (message: string) => void
  log: (message: string) => void
  room: (room: RoomInfo) => void
  transforms: (row: TransformRow) => void
  /** The server no longer has this player in the room (expired room, seat freed after a timeout). */
  lost: (reason: string) => void
}

const HEARTBEAT_SECONDS = 20

export class ConnectedRoomClient {
  readonly clientId = makeClientId()
  room: RoomInfo | null = null
  private client: SupabaseClient | null = null
  private channel: RealtimeChannel | null = null
  private revisions: {[seat: number]: number} = {}
  private pending: TransformState | null = null
  private sending = false
  private generation = 0
  private disposed = false
  private heartbeatTimer = 0
  private heartbeatBusy = false

  constructor(
    private url: string,
    private publicToken: string,
    private authMode: ConnectedAuthMode,
    private callbacks: ConnectedRoomCallbacks
  ) {}

  private async signedIn(): Promise<SupabaseClient> {
    if (this.client) return this.client
    // Known Snap Cloud Realtime limitation: keep the heartbeat at 2.5 s.
    const client = createClient(this.url, this.publicToken, {realtime: {heartbeatIntervalMs: 2500}})
    const existing = await client.auth.getSession()
    if (!existing.data.session) {
      let error: string | null = null
      if (this.authMode !== "anonymous") {
        const snap = await client.auth.signInWithSnapchat()
        error = snap.error ? snap.error.message : null
        if (!error) this.callbacks.log("Signed in with Snapchat")
      }
      if (this.authMode === "anonymous" || (error && this.authMode === "snapchat-then-anonymous")) {
        if (error) this.callbacks.log("Snapchat sign-in failed (" + error + "), trying anonymous sign-in")
        const guest = await client.auth.signInAnonymously()
        error = guest.error ? guest.error.message : null
        if (!error) this.callbacks.log("Signed in anonymously")
      }
      if (error) throw new Error("Sign-in failed: " + error)
    }
    if (this.disposed) throw new Error("Session closed")
    this.client = client
    return client
  }

  /** Host: creates a room and returns it with its 4-digit code. */
  async createRoom(maxPlayers: number): Promise<RoomInfo> {
    await this.leave()
    const epoch = this.generation
    this.callbacks.status("Connecting to Snap Cloud…")
    const client = await this.signedIn()
    const result = await client.rpc("connected_create_room", {p_client: this.clientId, p_max_players: maxPlayers})
    if (result.error) throw new Error(this.explain(result.error.message))
    return this.enter(client, result.data, epoch)
  }

  /** Guest: joins the room with this 4-digit code. */
  async joinRoom(code: string): Promise<RoomInfo> {
    const trimmed = (code || "").trim()
    if (!ROOM_CODE_PATTERN.test(trimmed)) throw new Error("Enter the 4-digit room code")
    await this.leave()
    const epoch = this.generation
    this.callbacks.status("Joining room " + trimmed + "…")
    const client = await this.signedIn()
    const result = await client.rpc("connected_join_room", {p_code: trimmed, p_client: this.clientId})
    if (result.error) throw new Error(this.explain(result.error.message))
    if (result.data && result.data.error) throw new Error(result.data.error)
    return this.enter(client, result.data, epoch)
  }

  private async enter(client: SupabaseClient, data: any, epoch: number): Promise<RoomInfo> {
    const room = parseRoom(data)
    if (!room) throw new Error("Invalid room response. Run Supabase/snapcloud-connected-setup.sql on this Snap Cloud project.")
    if (epoch !== this.generation || this.disposed) {
      await client.rpc("connected_leave_room", {p_room: room.id, p_client: this.clientId})
      throw new Error("Cancelled")
    }
    this.room = room
    this.revisions = {}
    this.heartbeatTimer = 0
    this.subscribe(client, room.id, epoch)
    this.callbacks.room(room)
    await this.refreshTransforms()
    return room
  }

  private subscribe(client: SupabaseClient, roomId: string, epoch: number): void {
    this.channel = client
      .channel("connected:" + roomId)
      .on("postgres_changes", {event: "UPDATE", schema: "public", table: "connected_rooms", filter: "id=eq." + roomId}, () => {
        if (epoch === this.generation) void this.refreshRoom()
      })
      .on(
        "postgres_changes",
        {event: "UPDATE", schema: "public", table: "connected_transforms", filter: "room_id=eq." + roomId},
        (payload: any) => {
          if (epoch === this.generation) this.accept(payload.new)
        }
      )
    this.channel.subscribe((status: string) => {
      if (epoch !== this.generation) return
      this.callbacks.log("Realtime channel: " + status)
      if (status === "SUBSCRIBED") {
        // Catch up on anything that changed before the subscription was live.
        void this.refreshRoom()
        void this.refreshTransforms()
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        this.callbacks.status("Reconnecting to Snap Cloud…")
      }
    })
  }

  /** Re-reads the room and its members (RLS: members only). */
  async refreshRoom(): Promise<void> {
    const room = this.room
    if (!room || !this.client) return
    const [roomResult, membersResult] = await Promise.all([
      this.client.from("connected_rooms").select("*").eq("id", room.id),
      this.client.from("connected_members").select("seat,ready").eq("room_id", room.id)
    ])
    if (this.room?.id !== room.id) return
    if (roomResult.error || membersResult.error) {
      this.callbacks.log("Room refresh failed: " + (roomResult.error || membersResult.error).message)
      return
    }
    const row = roomResult.data && roomResult.data[0]
    if (!row) {
      this.lost("The room expired or was closed")
      return
    }
    const next = parseRoom({...row, seat: room.seat, members: membersResult.data})
    if (next) this.setRoom(next)
  }

  async refreshTransforms(): Promise<void> {
    const room = this.room
    if (!room || !this.client) return
    const result = await this.client.from("connected_transforms").select("*").eq("room_id", room.id)
    if (this.room?.id !== room.id) return
    if (result.error) {
      this.callbacks.log("Transform refresh failed: " + result.error.message)
      return
    }
    for (const raw of result.data || []) this.accept(raw)
  }

  private setRoom(next: RoomInfo): void {
    const current = this.room
    if (!current || next.id !== current.id) return
    if (next.revision < current.revision) return
    if (!next.members.some((m) => m.seat === current.seat)) {
      this.lost("You are no longer in this room")
      return
    }
    this.room = next
    this.callbacks.room(next)
  }

  private accept(raw: any): void {
    const row = parseTransformRow(raw)
    if (!row || !this.room || row.room_id !== this.room.id || row.seat === this.room.seat) return
    if (row.revision <= (this.revisions[row.seat] ?? -1)) return
    this.revisions[row.seat] = row.revision
    this.callbacks.transforms(row)
  }

  async setReady(ready: boolean): Promise<void> {
    const room = this.room
    if (!room || !this.client) return
    const result = await this.client.rpc("connected_set_ready", {p_room: room.id, p_client: this.clientId, p_ready: ready})
    if (result.error) throw new Error(result.error.message)
    const next = parseRoom(result.data)
    if (next) this.setRoom(next)
  }

  /** Queues this player's latest state. Only the newest pending state is sent. */
  publish(state: TransformState): void {
    if (!this.room) return
    this.pending = state
    if (!this.sending) void this.flush()
  }

  private async flush(): Promise<void> {
    this.sending = true
    const epoch = this.generation
    try {
      while (this.pending && this.room && this.client && epoch === this.generation) {
        const state = this.pending
        this.pending = null
        const result = await this.client.rpc("connected_publish", {p_room: this.room.id, p_client: this.clientId, p_state: state})
        if (result.error) {
          this.callbacks.log("Publish failed: " + result.error.message)
          if (/no longer|Only room members/i.test(result.error.message)) this.lost("You are no longer in this room")
          break
        }
      }
    } catch (error) {
      this.callbacks.status("Network interrupted. Reconnecting…")
    } finally {
      this.sending = false
    }
  }

  /** Call every frame: sends a heartbeat every 20 s and uses it to re-sync room and transforms. */
  tick(dt: number): void {
    if (!this.room || this.heartbeatBusy) return
    this.heartbeatTimer += dt
    if (this.heartbeatTimer < HEARTBEAT_SECONDS) return
    this.heartbeatTimer = 0
    void this.heartbeat()
  }

  private async heartbeat(): Promise<void> {
    const room = this.room
    if (!room || !this.client) return
    this.heartbeatBusy = true
    try {
      const result = await this.client.rpc("connected_heartbeat", {p_room: room.id, p_client: this.clientId})
      if (this.room?.id !== room.id) return
      if (result.error) {
        if (/no longer|not found|expired/i.test(result.error.message)) this.lost(result.error.message)
        return
      }
      const next = parseRoom(result.data)
      if (next) this.setRoom(next)
      await this.refreshTransforms()
    } catch (error) {
      this.callbacks.log("Heartbeat failed: " + error)
    } finally {
      this.heartbeatBusy = false
    }
  }

  private lost(reason: string): void {
    if (!this.room) return
    this.reset()
    this.callbacks.lost(reason)
  }

  private reset(): void {
    ++this.generation
    this.room = null
    this.pending = null
    this.revisions = {}
    const channel = this.channel
    this.channel = null
    if (channel && this.client) void this.client.removeChannel(channel)
  }

  async leave(): Promise<void> {
    const old = this.room
    this.reset()
    if (old && this.client) {
      try {
        await this.client.rpc("connected_leave_room", {p_room: old.id, p_client: this.clientId})
      } catch (error) {
        this.callbacks.log("Leave failed: " + error)
      }
    }
  }

  destroy(): void {
    this.disposed = true
    void this.leave()
  }

  private explain(message: string): string {
    return /Could not find the function|PGRST202/i.test(message)
      ? "Snap Cloud project is missing the Connected tables. Run Supabase/snapcloud-connected-setup.sql once."
      : message
  }
}
