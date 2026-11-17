/**
 * SPECS Inc. 2027
 * Snap Cloud (Supabase) transport for the ARKit Spectator host: sign-in, room creation,
 * revision-checked publishing and closing. Uses the RPCs from supabase/setup.sql.
 */
import {createClient, SupabaseClient} from "SupabaseClient.lspkg/supabase-snapcloud"
import {ROOM_CODE_PATTERN, SpectatorRoomInfo, SpectatorState} from "./SpectatorProtocol"

export type SpectatorAuthMode = "snapchat-then-anonymous" | "snapchat" | "anonymous"

export class SpectatorRoomClient {
  room: SpectatorRoomInfo | null = null
  private client: SupabaseClient | null = null
  private revision = 0
  private pending: SpectatorState | null = null
  private sending = false
  private generation = 0
  private disposed = false

  constructor(
    private url: string,
    private publicToken: string,
    private authMode: SpectatorAuthMode,
    private status: (message: string) => void,
    private log: (message: string) => void
  ) {}

  /** Public URL for a path in a public Snap Cloud Storage bucket ("bucket/path/model.glb"). */
  storageUrl(path: string): string {
    const base = this.url.replace(/\/+$/, "")
    const clean = path.replace(/^\/+/, "").split("/").map((s) => encodeURIComponent(s)).join("/")
    return base + "/storage/v1/object/public/" + clean
  }

  private async signedIn(): Promise<SupabaseClient> {
    if (this.client) return this.client
    const client = createClient(this.url, this.publicToken, {realtime: {heartbeatIntervalMs: 2500}})
    const existing = await client.auth.getSession()
    if (!existing.data.session) {
      let error: string | null = null
      if (this.authMode !== "anonymous") {
        const snap = await client.auth.signInWithSnapchat()
        error = snap.error ? snap.error.message : null
        if (!error) this.log("Signed in with Snapchat")
      }
      if (this.authMode === "anonymous" || (error && this.authMode === "snapchat-then-anonymous")) {
        if (error) this.log("Snapchat sign-in failed (" + error + "), trying anonymous sign-in")
        const guest = await client.auth.signInAnonymously()
        error = guest.error ? guest.error.message : null
        if (!error) this.log("Signed in anonymously")
      }
      if (error) throw new Error("Sign-in failed: " + error)
    }
    this.client = client
    return client
  }

  async createRoom(): Promise<SpectatorRoomInfo> {
    await this.close() // also invalidates any earlier createRoom still in flight
    const epoch = this.generation
    this.status("Connecting to Snap Cloud…")
    const client = await this.signedIn()
    const result = await client.rpc("spectator_create_room")
    if (result.error) throw new Error(result.error.message)
    const data = result.data as SpectatorRoomInfo
    if (!data || !data.id || !ROOM_CODE_PATTERN.test(data.code)) throw new Error("Invalid room response — is supabase/setup.sql installed?")
    if (epoch !== this.generation || this.disposed) {
      await client.rpc("spectator_leave_room", {p_room: data.id})
      throw new Error("Room creation cancelled")
    }
    this.room = data
    this.revision = 0
    return data
  }

  /** Queues the latest state; only the newest pending state is sent (older ones are dropped). */
  publish(state: SpectatorState): void {
    if (!this.room) return
    this.pending = state
    if (!this.sending) void this.flush()
  }

  get busy(): boolean {
    return this.sending
  }

  private async flush(): Promise<void> {
    this.sending = true
    const epoch = this.generation
    let conflicts = 0
    try {
      while (this.pending && this.room && this.client && epoch === this.generation) {
        const state = this.pending
        this.pending = null
        const result = await this.client.rpc("spectator_publish", {p_room: this.room.id, p_revision: this.revision, p_state: state})
        if (epoch !== this.generation) break
        if (result.error) {
          if (result.error.message.indexOf("Revision conflict") >= 0 && conflicts++ < 3) {
            // Another device or an earlier session wrote this room: adopt the stored revision and retry once.
            await this.refreshRevision()
            if (!this.pending) this.pending = state
            continue
          }
          this.status("Publishing paused: " + result.error.message)
          break
        }
        this.revision = Math.max(this.revision, Number(result.data))
        conflicts = 0
      }
    } catch (e) {
      this.status("Network interrupted — retrying")
      this.log("Publish failed: " + e)
    } finally {
      this.sending = false
    }
  }

  private async refreshRevision(): Promise<void> {
    if (!this.room || !this.client) return
    const result = await this.client.from("spectator_states").select("revision").eq("room_id", this.room.id)
    const rows = (result.data || []) as {revision: number}[]
    if (!result.error && rows.length > 0) this.revision = Number(rows[0].revision)
  }

  /** Closes the room: phones see an empty stage and the code is released. */
  async close(): Promise<void> {
    ++this.generation
    this.pending = null
    const old = this.room
    this.room = null
    if (old && this.client) {
      try {
        await this.client.rpc("spectator_leave_room", {p_room: old.id})
      } catch (e) {
        this.log("Close failed: " + e)
      }
    }
  }

  dispose(): void {
    this.disposed = true
    void this.close()
  }
}
