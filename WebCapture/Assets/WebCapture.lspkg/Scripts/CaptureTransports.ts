/**
 * SPECS Inc. 2027
 * Where Web Capture sends scene snapshots and recordings.
 *
 * - LocalPortalTransport: a WebSocket to the WebCapture Lens Studio plugin on this computer
 *   (ws://127.0.0.1:47791). The plugin serves the portal and saves recordings into the project.
 *   Lens Studio only allows a plain ws:// URL when the project enables Experimental APIs.
 * - SnapCloudTransport: Snap Cloud (Supabase) RPCs from supabase/setup.sql. Works on Specs and in
 *   Lens Studio; the portal reads the same session with your project's public key.
 * - OfflineTransport: no network; keeps the last recording in memory (tests, or your own upload).
 */
import {createClient, SupabaseClient} from "SupabaseClient.lspkg/supabase-snapcloud"
import {MAX_RECORDING_BYTES, Recording, SceneSnapshot} from "./WebCaptureProtocol"

export type CommandHandler = (action: string, args: {[key: string]: unknown}) => void
export type AuthMode = "snapchat-then-anonymous" | "snapchat" | "anonymous"

export interface SaveResult {
  /** Where the recording went: a project-relative file (local), a Snap Cloud id, or "memory". */
  location: string
  transport: string
}

export interface CaptureTransport {
  readonly name: string
  readonly connected: boolean
  /** Session code shown to the developer (Snap Cloud: the code the portal opens; local: "local"). */
  readonly sessionCode: string
  connect(): Promise<void>
  publishScene(snapshot: SceneSnapshot): void
  /** `json` is the recording already serialized (one JSON.stringify of a 10+ MB recording is enough). */
  saveRecording(recording: Recording, json?: string): Promise<SaveResult>
  dispose(): void
}

type Log = (message: string) => void

const CHUNK_SIZE = 32 * 1024

function internetModule(): InternetModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Lens Studio module import
  return require("LensStudio:InternetModule") as InternetModule
}

export class LocalPortalTransport implements CaptureTransport {
  readonly name = "local"
  private socket: WebSocket | null = null
  private open = false
  private pendingScene: string | null = null
  private saves: {[id: string]: (result: SaveResult) => void} = {}
  private failures: {[id: string]: (error: Error) => void} = {}
  private closed = false

  constructor(
    private url: string,
    private hello: {[key: string]: unknown},
    private onCommand: CommandHandler,
    private log: Log
  ) {}

  get connected(): boolean {
    return this.open
  }

  get sessionCode(): string {
    return "local"
  }

  connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let socket: WebSocket
      try {
        socket = internetModule().createWebSocket(this.url)
      } catch (e) {
        const message = "" + e
        if (message.indexOf("not secure") >= 0) {
          reject(
            new Error(
              "Lens Studio blocks ws:// URLs unless Experimental APIs are enabled (Project Settings). Enable them, or use Snap Cloud mode."
            )
          )
        } else {
          reject(new Error("Couldn't open " + this.url + ": " + message))
        }
        return
      }
      this.socket = socket
      let settled = false
      socket.onopen = () => {
        this.open = true
        settled = true
        this.sendRaw(JSON.stringify(Object.assign({type: "hello"}, this.hello)))
        if (this.pendingScene) {
          this.sendRaw(this.pendingScene)
          this.pendingScene = null
        }
        resolve()
      }
      socket.onmessage = (event: WebSocketMessageEvent) => this.handle(event)
      socket.onerror = () => {
        if (!settled) {
          settled = true
          reject(
            new Error(
              "No WebCapture plugin answered at " +
                this.url +
                ". Open the project in Lens Studio with the WebCapture plugin (Window → WebCapture)."
            )
          )
        }
      }
      socket.onclose = () => {
        this.open = false
        for (const id in this.failures) this.failures[id](new Error("Connection to the WebCapture plugin closed"))
        this.saves = {}
        this.failures = {}
        if (!settled) {
          settled = true
          reject(new Error("The WebCapture plugin closed the connection"))
        }
      }
    })
  }

  private handle(event: WebSocketMessageEvent): void {
    if (typeof event.data !== "string") return
    let msg: {[key: string]: unknown}
    try {
      msg = JSON.parse(event.data)
    } catch {
      return
    }
    // JSON.parse("null") or a bare number parses fine but isn't a message.
    if (!msg || typeof msg !== "object") return
    if (msg.type === "saved" && typeof msg.id === "string" && this.saves[msg.id]) {
      this.saves[msg.id]({location: String(msg.file || ""), transport: this.name})
      delete this.saves[msg.id]
      delete this.failures[msg.id]
    } else if (msg.type === "save-failed" && typeof msg.id === "string" && this.failures[msg.id]) {
      this.failures[msg.id](new Error(String(msg.error || "save failed")))
      delete this.saves[msg.id]
      delete this.failures[msg.id]
    } else if (msg.type === "command" && typeof msg.action === "string") {
      this.onCommand(msg.action, (msg.args as {[key: string]: unknown}) || {})
    }
  }

  private sendRaw(text: string): void {
    if (!this.socket || !this.open) return
    try {
      this.socket.send(text)
    } catch (e) {
      // The socket is closing; onclose follows shortly. Never let a send break the UpdateEvent loop.
    }
  }

  publishScene(snapshot: SceneSnapshot): void {
    const text = JSON.stringify({type: "scene", snapshot: snapshot})
    if (this.open) this.sendRaw(text)
    else this.pendingScene = text
  }

  saveRecording(recording: Recording, json?: string): Promise<SaveResult> {
    if (!this.open) return Promise.reject(new Error("Not connected to the WebCapture plugin"))
    const text = json || JSON.stringify(recording)
    if (text.length > MAX_RECORDING_BYTES)
      return Promise.reject(new Error("Recording is larger than " + MAX_RECORDING_BYTES + " bytes"))
    const id = recording.meta.id
    const chunks = Math.max(1, Math.ceil(text.length / CHUNK_SIZE))
    return new Promise<SaveResult>((resolve, reject) => {
      this.saves[id] = resolve
      this.failures[id] = reject
      this.sendRaw(
        JSON.stringify({type: "recording-begin", id: id, name: recording.meta.name, bytes: text.length, chunks: chunks})
      )
      for (let i = 0; i < chunks; i++) {
        this.sendRaw(
          JSON.stringify({
            type: "recording-chunk",
            id: id,
            index: i,
            data: text.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
          })
        )
      }
      this.sendRaw(JSON.stringify({type: "recording-end", id: id}))
    })
  }

  dispose(): void {
    this.closed = true
    this.open = false
    if (this.socket) {
      try {
        this.socket.close()
      } catch {
        // already closed
      }
    }
    this.socket = null
  }
}

const ROW_LIMIT_BYTES = Math.floor(5.5 * 1024 * 1024)
const STORAGE_BUCKET = "webcapture"

export class SnapCloudTransport implements CaptureTransport {
  readonly name = "snapcloud"
  private client: SupabaseClient | null = null
  private session: {id: string; code: string} | null = null
  private revision = 0
  private pending: SceneSnapshot | null = null
  private sending = false

  constructor(
    private url: string,
    private publicToken: string,
    private authMode: AuthMode,
    private lens: string,
    private log: Log,
    private captureCode: string = ""
  ) {}

  get connected(): boolean {
    return this.session !== null
  }

  get sessionCode(): string {
    return this.session ? this.session.code : ""
  }

  async connect(): Promise<void> {
    const client = createClient(this.url, this.publicToken, {realtime: {heartbeatIntervalMs: 5000}})
    const existing = await client.auth.getSession()
    if (!existing.data.session) {
      let error: string | null = null
      if (this.authMode !== "anonymous") {
        const snap = await client.auth.signInWithSnapchat()
        error = snap.error ? snap.error.message : null
      }
      if (this.authMode === "anonymous" || (error && this.authMode === "snapchat-then-anonymous")) {
        const guest = await client.auth.signInAnonymously()
        error = guest.error ? guest.error.message : null
      }
      if (error) throw new Error("Snap Cloud sign-in failed: " + error)
    }
    this.client = client
    let result = await client.rpc("webcapture_create_session", {p_lens: this.lens, p_code: this.captureCode || null})
    if (result.error && this.captureCode && /could not find|not found|PGRST202/i.test(result.error.message + " " + (result.error.code || ""))) {
      // The backend predates fixed codes (fixed-code.sql not run yet): fall back to a random code for this run.
      this.log("Snap Cloud: fixed-code.sql not installed, using a random code")
      result = await client.rpc("webcapture_create_session", {p_lens: this.lens})
    }
    if (result.error) throw new Error(result.error.message + " (is supabase/setup.sql installed on this project?)")
    const data = result.data as {id: string; code: string}
    if (!data || !data.id || !data.code) throw new Error("Invalid session response; reinstall supabase/setup.sql")
    this.session = data
    this.revision = 0
  }

  publishScene(snapshot: SceneSnapshot): void {
    if (!this.session) return
    this.pending = snapshot
    if (!this.sending) void this.flush()
  }

  private async flush(): Promise<void> {
    this.sending = true
    try {
      while (this.pending && this.session && this.client) {
        const scene = this.pending
        this.pending = null
        const result = await this.client.rpc("webcapture_publish_scene", {
          p_session: this.session.id,
          p_revision: this.revision,
          p_scene: scene
        })
        if (result.error) {
          this.log("Snap Cloud publish paused: " + result.error.message)
          break
        }
        this.revision = Math.max(this.revision, Number(result.data))
      }
    } catch (e) {
      this.log("Snap Cloud publish failed: " + e)
    } finally {
      this.sending = false
    }
  }

  async saveRecording(recording: Recording, json?: string): Promise<SaveResult> {
    if (!this.session || !this.client) throw new Error("No Snap Cloud session")
    const full = json || JSON.stringify(recording)
    let toSave: Recording = recording
    if (full.length > ROW_LIMIT_BYTES) {
      // Too big for a database row: upload the full recording to Storage, keep a small row that points to it.
      const path = this.session.id + "/" + recording.meta.id + ".json"
      let uploaded = false
      try {
        const up = await this.client.storage.from(STORAGE_BUCKET).upload(path, full, {contentType: "application/json"})
        if (up.error) throw new Error(up.error.message)
        uploaded = true
      } catch (e) {
        this.log("Storage upload failed (" + ((e as Error).message || e) + "): saving without the heavy parts")
      }
      const lean: Recording = {...recording}
      delete lean.assets
      delete lean.background
      if (uploaded) {
        lean.meta = {...recording.meta, storage: {bucket: STORAGE_BUCKET, path: path, bytes: full.length}}
      }
      toSave = lean
      if (JSON.stringify(lean).length > ROW_LIMIT_BYTES) throw new Error("Recording too large even without meshes and background")
    }
    const result = await this.client.rpc("webcapture_save_recording", {
      p_session: this.session.id,
      p_recording: toSave
    })
    if (result.error) throw new Error(result.error.message)
    return {location: String(result.data), transport: this.name}
  }

  dispose(): void {
    const session = this.session
    const client = this.client
    this.session = null
    this.pending = null
    if (session && client) {
      void client.rpc("webcapture_end_session", {p_session: session.id}).then(
        () => {},
        () => {}
      )
    }
  }
}

export class OfflineTransport implements CaptureTransport {
  readonly name = "offline"
  lastScene: SceneSnapshot | null = null
  lastRecording: Recording | null = null

  get connected(): boolean {
    return true
  }

  get sessionCode(): string {
    return "offline"
  }

  connect(): Promise<void> {
    return Promise.resolve()
  }

  publishScene(snapshot: SceneSnapshot): void {
    this.lastScene = snapshot
  }

  saveRecording(recording: Recording, json?: string): Promise<SaveResult> {
    this.lastRecording = recording
    return Promise.resolve({location: "memory", transport: this.name})
  }

  dispose(): void {}
}
