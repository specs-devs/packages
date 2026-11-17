/**
 * SPECS Inc. 2027
 * ARKit Spectator host. Creates a Snap Cloud room, shows its 4-digit code, and streams the poses of
 * chosen SceneObjects (plus optional glTF URLs and custom JSON) so iPhones running the ARKit
 * Spectator app can watch the same scene on a real surface, read-only, from their own camera.
 */
import {SpectatorAuthMode, SpectatorRoomClient} from "./SpectatorRoomClient"
import {SpectatorEntity} from "./SpectatorEntity"
import {SnapCloudRequirements} from "../SnapCloudRequirements"
import {
  MAX_ENTITIES,
  round,
  SpectatorEntityState,
  SpectatorRoomInfo,
  SpectatorState,
  validateEntity,
  validateState
} from "./SpectatorProtocol"

@component
export class ARKitSpectator extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Snap Cloud</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Assign your SupabaseProject asset (Window → Supabase → Import Credentials) on SnapCloudRequirements and run supabase/setup.sql on that project once.</span>')
  @input
  @allowUndefined
  @hint("SnapCloudRequirements holding the SupabaseProject asset with your Snap Cloud URL and public key. Never paste keys into scripts")
  snapCloudRequirements: SnapCloudRequirements

  @input
  @allowUndefined
  @hint("Deprecated: use snapCloudRequirements. Only read when snapCloudRequirements isn't wired")
  supabaseProject: SupabaseProject

  @input
  @hint("How the Lens signs in. The iPhone app always signs in anonymously")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Snapchat, then anonymous", "snapchat-then-anonymous"),
      new ComboBoxItem("Snapchat only", "snapchat"),
      new ComboBoxItem("Anonymous only", "anonymous")
    ])
  )
  authMode: string = "snapchat-then-anonymous"

  @input
  @hint("Create a room as soon as the Lens starts. Off: call createRoom() yourself")
  autoCreateRoom: boolean = true

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">What to stream</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Poses are sent relative to the Stage Origin, in cm. The phone puts the Stage Origin on the surface the viewer taps.</span>')
  @input
  @allowUndefined
  @hint("Reference frame for every pose (e.g. your table or play-area root). Empty = this SceneObject")
  stageOrigin: SceneObject

  @input
  @hint("Also stream every SceneObject that has a SpectatorEntity component")
  includeSpectatorEntities: boolean = true

  @input
  @allowUndefined
  @hint("Extra SceneObjects to stream without a SpectatorEntity (drawn as boxes on the phone)")
  trackedObjects: SceneObject[] = []

  @input
  @hint("Optional room-level JSON sent with every update (max 8 KB). Change it at runtime with setRoomData()")
  roomJson: string = ""

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Publishing</span>')
  @input("float")
  @hint("Maximum updates per second. Updates are only sent when something changed")
  @widget(new SliderWidget(1, 15, 1))
  publishRate: number = 5

  @input("float")
  @hint("Position change (cm) below which an object counts as unchanged")
  positionTolerance: number = 0.2

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Room code display</span>')
  @input
  @allowUndefined
  @hint("Text that shows the room code for the phone (optional)")
  roomCodeText: Text

  @input
  @hint("Room code format; {code} is replaced by the 4 digits")
  roomCodeFormat: string = "Spectator code\n{code}"

  @input
  @allowUndefined
  @hint("Text that shows connection status (optional)")
  statusText: Text

  @input
  @hint("Print connection details to the Logger")
  debugLogs: boolean = false

  private client: SpectatorRoomClient | null = null
  private roomData: unknown = undefined
  private lastSignature = ""
  private elapsed = 0
  private sinceResend = 0
  private statusMessage = "Offline"
  private roomReadyCallbacks: ((code: string) => void)[] = []
  private roomClosedCallbacks: (() => void)[] = []
  private warned: {[key: string]: boolean} = {}

  onAwake(): void {
    if (this.roomJson.trim().length > 0) {
      try {
        this.roomData = JSON.parse(this.roomJson)
      } catch (e) {
        this.warnOnce("roomJson", "Room Json is not valid JSON, ignored")
      }
    }
    this.showCode(null)
    this.createEvent("OnStartEvent").bind(() => {
      if (this.autoCreateRoom) void this.createRoom()
    })
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
    this.createEvent("OnDestroyEvent").bind(() => this.client?.dispose())
  }

  /** The current 4-digit room code, or null while offline. */
  get roomCode(): string | null {
    return this.client?.room?.code ?? null
  }

  get status(): string {
    return this.statusMessage
  }

  /** Called with the room code once the room exists (immediately if it already does). */
  onRoomReady(callback: (code: string) => void): void {
    this.roomReadyCallbacks.push(callback)
    if (this.roomCode) callback(this.roomCode)
  }

  onRoomClosed(callback: () => void): void {
    this.roomClosedCallbacks.push(callback)
  }

  /** Replaces the room-level JSON published with every update. */
  setRoomData(data: unknown): void {
    this.roomData = data
  }

  /** Creates a new room (closing the current one) and returns its code. */
  async createRoom(): Promise<string | null> {
    const client = this.ensureClient()
    if (!client) return null
    try {
      const room: SpectatorRoomInfo = await client.createRoom()
      this.lastSignature = ""
      this.showCode(room.code)
      this.setStatus("Room " + room.code + " · waiting for spectators")
      this.log("Room " + room.code + " created (" + room.id + ")")
      for (const callback of this.roomReadyCallbacks) callback(room.code)
      return room.code
    } catch (e) {
      this.showCode(null)
      this.setStatus("Could not create a room: " + ((e as Error).message || e))
      return null
    }
  }

  /** Closes the room; spectators see an empty stage and the code stops working. */
  async closeRoom(): Promise<void> {
    if (!this.client?.room) return
    await this.client.close()
    this.showCode(null)
    this.setStatus("Room closed")
    for (const callback of this.roomClosedCallbacks) callback()
  }

  /** Builds the state that would be published now (useful for debugging and tests). */
  buildState(): SpectatorState {
    const stage = (this.stageOrigin || this.sceneObject).getTransform()
    const inverse = stage.getInvertedWorldTransform()
    const stageRotation = stage.getWorldRotation().invert()
    const stageScale = stage.getWorldScale()
    const entities: SpectatorEntityState[] = []
    const used: {[id: string]: boolean} = {}
    const add = (object: SceneObject, meta: SpectatorEntity | null) => {
      if (!object || entities.length >= MAX_ENTITIES) {
        if (object) this.warnOnce("max", "More than " + MAX_ENTITIES + " objects — extra objects are not streamed")
        return
      }
      let id = meta ? meta.id : object.name.substring(0, 80)
      if (id.length === 0) id = "object"
      if (used[id]) {
        // Ids must be unique: suffix duplicates deterministically.
        let n = 2
        while (used[id.substring(0, 75) + "#" + n]) n++
        this.warnOnce("dup:" + id, "Duplicate entity id '" + id + "' — set a unique Entity Id on its SpectatorEntity")
        id = id.substring(0, 75) + "#" + n
      }
      const t = object.getTransform()
      const p = inverse.multiplyPoint(t.getWorldPosition())
      const r = stageRotation.multiply(t.getWorldRotation())
      const s = t.getWorldScale()
      const d = (v: number, by: number) => (Math.abs(by) > 1e-6 ? v / by : v)
      const decimals = this.positionTolerance >= 1 ? 0 : this.positionTolerance >= 0.1 ? 1 : 2
      const entity: SpectatorEntityState = {
        id,
        p: [round(p.x, decimals), round(p.y, decimals), round(p.z, decimals)],
        r: [round(r.x, 4), round(r.y, 4), round(r.z, 4), round(r.w, 4)],
        s: [round(d(s.x, stageScale.x), 3), round(d(s.y, stageScale.y), 3), round(d(s.z, stageScale.z), 3)]
      }
      if (object.name && object.name !== id) entity.name = object.name.substring(0, 80)
      const visible = object.isEnabledInHierarchy && (!meta || meta.enabled)
      if (!visible) entity.visible = false
      if (meta) {
        const asset = meta.assetUrl.trim()
        if (asset.length > 0) entity.asset = asset.indexOf("https://") === 0 ? asset : this.client ? this.client.storageUrl(asset) : asset
        entity.primitive = meta.getPrimitive()
        entity.color = meta.getColorHex()
        const clip = meta.getClip()
        if (clip) entity.clip = clip
        const data = meta.getCustomData()
        if (data !== undefined) entity.data = data
      }
      const reason = validateEntity(entity)
      if (reason) {
        this.warnOnce("invalid:" + id, "Not streaming '" + id + "': " + reason)
        return
      }
      used[id] = true
      entities.push(entity)
    }
    if (this.includeSpectatorEntities) for (const meta of SpectatorEntity.all) add(meta.getSceneObject(), meta)
    for (const object of this.trackedObjects || []) {
      if (!object) continue
      if (this.includeSpectatorEntities && SpectatorEntity.all.some((m) => m.getSceneObject() === object)) continue
      add(object, null)
    }
    const state: SpectatorState = {entities}
    if (this.roomData !== undefined) state.data = this.roomData
    return state
  }

  private onUpdate(): void {
    const client = this.client
    if (!client || !client.room) return
    this.elapsed += getDeltaTime()
    this.sinceResend += getDeltaTime()
    // Re-send unchanged state every 10 s so a paused or rejected update recovers on its own.
    if (this.sinceResend >= 10) {
      this.sinceResend = 0
      this.lastSignature = ""
    }
    if (this.elapsed < 1 / Math.max(1, Math.min(15, this.publishRate))) return
    if (client.busy) return // one request in flight; the next tick sends the newest state
    this.elapsed = 0
    const state = this.buildState()
    const signature = JSON.stringify(state)
    if (signature === this.lastSignature) return
    const reason = validateState(state)
    if (reason) {
      this.warnOnce("state:" + reason, "State not published: " + reason)
      return
    }
    this.lastSignature = signature
    client.publish(state)
  }

  /** The Snap Cloud project: from snapCloudRequirements, else the deprecated supabaseProject input. */
  getSupabaseProject(): SupabaseProject | null {
    if (this.snapCloudRequirements) return this.snapCloudRequirements.getSupabaseProject() ?? null
    return this.supabaseProject ?? null
  }

  private ensureClient(): SpectatorRoomClient | null {
    if (this.client) return this.client
    const project = this.getSupabaseProject()
    if (!project) {
      this.setStatus("Assign a SupabaseProject (Snap Cloud credentials) on SnapCloudRequirements")
      return null
    }
    let url = ""
    let token = ""
    try {
      url = project.url
      token = project.publicToken
    } catch (e) {
      this.setStatus("Snap Cloud credentials are not readable here: " + e)
      return null
    }
    if (!url || !token) {
      this.setStatus("The SupabaseProject asset has no URL or public key")
      return null
    }
    this.client = new SpectatorRoomClient(
      url,
      token,
      this.authMode as SpectatorAuthMode,
      (message) => this.setStatus(message),
      (message) => this.log(message)
    )
    return this.client
  }

  private showCode(code: string | null): void {
    if (!this.roomCodeText) return
    this.roomCodeText.text = code ? this.roomCodeFormat.replace("{code}", code) : "Spectator code\n····"
  }

  private setStatus(message: string): void {
    this.statusMessage = message
    if (this.statusText) this.statusText.text = message
    this.log(message)
  }

  private log(message: string): void {
    if (this.debugLogs) print("[ARKitSpectator] " + message)
  }

  private warnOnce(key: string, message: string): void {
    if (this.warned[key]) return
    this.warned[key] = true
    print("[ARKitSpectator] " + message)
  }
}
