/**
 * SPECS Inc. 2027
 * Snap Cloud Connected session. Pairs players with a 4-digit room code, has each player place its own
 * origin on a surface (SurfacePlacement package), waits until every player confirms they are ready,
 * then syncs the transforms registered by SyncedTransforms components through Snap Cloud.
 * Each pose is sent relative to the sender's placed origin, so players don't need a shared physical
 * coordinate frame.
 */
import Event, {PublicApi} from "InteractionKit.lspkg/Utils/Event"
import {PlacementMode, PlacementSettings} from "SurfacePlacement.lspkg/Scripts/PlacementSettings"
import {SurfacePlacementController} from "SurfacePlacement.lspkg/Scripts/SurfacePlacementController"
import {Logger} from "Utilities.lspkg/Scripts/Utils/Logger"
import {ConnectedAuthMode, ConnectedRoomClient} from "./ConnectedRoomClient"
import {MAX_SYNCED_TRANSFORMS, round, RoomInfo, TransformPose, TransformRow} from "./ConnectedProtocol"
import {SnapCloudRequirements} from "../SnapCloudRequirements"

/** Session lifecycle, in order. */
export enum ConnectedState {
  /** Not in a room. Host or join. */
  Offline = "offline",
  /** Signing in and creating or joining a room. */
  Connecting = "connecting",
  /** In a room, placing the local origin on a surface. */
  Placing = "placing",
  /** Origin placed. Waiting for this player to confirm they are ready (or place again). */
  Confirm = "confirm",
  /** This player is ready. Waiting for the other players. */
  Waiting = "waiting",
  /** Every player is ready. Transforms are syncing. */
  Active = "active"
}

/** Owner value for objects that anyone can move: the last player to move one owns it. */
export const OWNER_ANYONE = -1

interface Pose {
  p: vec3
  r: quat
  s: vec3
}

interface SyncedEntity {
  id: string
  object: SceneObject
  ownerSeat: number
  /** Current claim for OWNER_ANYONE objects: highest stamp wins, lower seat breaks ties. */
  stamp: number
  claimSeat: number
  last: Pose | null
  sent: Pose | null
  target: Pose | null
  snapToTarget: boolean
}

const AUTH_MODES: ConnectedAuthMode[] = ["snapchat-then-anonymous", "snapchat", "anonymous"]
/** Yaw of each seat's frame when players face each other around the same table. */
const FACE_TO_FACE_YAW = [0, 180, 90, -90]
const NO_PROJECT_STATUS = "Add your Snap Cloud project: assign a SupabaseProject on SnapCloudRequirements, then Host or Join."

@component
export class SnapCloudConnected extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Snap Cloud</span>')
  @ui.label(
    '<span style="color: #94A3B8; font-size: 11px;">Assign your SupabaseProject asset (Window → Supabase → Import Credentials) on SnapCloudRequirements and run Supabase/snapcloud-connected-setup.sql on that project once.</span>'
  )
  @input
  @allowUndefined
  @hint("SnapCloudRequirements holding the SupabaseProject (Snap Cloud URL and public key). Never paste keys into scripts")
  snapCloudRequirements: SnapCloudRequirements

  @input
  @allowUndefined
  @hint("Deprecated: use snapCloudRequirements. Only used when snapCloudRequirements isn't wired")
  supabaseProject: SupabaseProject

  @input("int")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Snapchat, then anonymous", 0),
      new ComboBoxItem("Snapchat only", 1),
      new ComboBoxItem("Anonymous only", 2)
    ])
  )
  @hint("How players sign in. Anonymous sign-in must be enabled in your Snap Cloud project's Auth settings")
  authMode: number = 0

  @input("int")
  @widget(new SliderWidget(2, 4, 1))
  @hint("Players per room. The session starts when every seat is taken and every player is ready")
  maxPlayers: number = 2

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Surface Placement</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Each player places this origin on their own surface. Put synced content under it</span>')
  @input
  @hint("Local origin that each player places on a surface. Synced poses are relative to it")
  origin: SceneObject

  @input
  @hint("Hide the origin and its children until this player has placed it")
  hideOriginUntilPlaced: boolean = true

  @input("int")
  @widget(new ComboBoxWidget([new ComboBoxItem("Ground (floor)", 0), new ComboBoxItem("Tabletop (palm on a table)", 2)]))
  @hint("SurfacePlacement mode. Both confirm by holding still; there is no pinch or tap")
  placementMode: number = PlacementMode.GROUND

  @input
  @hint("Set ready automatically after placement instead of waiting for confirmReady()")
  autoReadyAfterPlacement: boolean = false

  @input
  @hint("Players face each other around the origin: player 2 is turned 180°, players 3 and 4 ±90°. Off: everyone sees the same layout in front of them")
  faceToFace: boolean = true

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Sync</span>')
  @input
  @widget(new SliderWidget(1, 20, 1))
  @hint("Maximum publishes per second for this player's transforms")
  sendRate: number = 10

  @input
  @widget(new SliderWidget(0, 30, 1))
  @hint("Smoothing for remote transforms (higher = snappier). 0 = no smoothing")
  smoothing: number = 12

  @ui.separator
  @input
  @hint("Enable general logging")
  enableLogging: boolean = false

  private static instance: SnapCloudConnected | null = null
  /** The first SnapCloudConnected in the scene. SyncedTransforms uses it when no session is assigned. */
  static getInstance(): SnapCloudConnected | null {
    return SnapCloudConnected.instance
  }

  private logger: Logger
  private client: ConnectedRoomClient | null = null
  private _state: ConnectedState = ConnectedState.Offline
  private _status = "Host a room or join one with its 4-digit code."
  private entities: {[id: string]: SyncedEntity} = {}
  private lamport = 0
  private dirty = false
  private sendTimer = 0
  private placed = false
  private placementToken = 0
  private placementUsed = false

  private readonly stateChanged = new Event<ConnectedState>()
  private readonly statusChanged = new Event<string>()
  private readonly roomChanged = new Event<RoomInfo | null>()

  /** Fires on every state change. */
  get onStateChanged(): PublicApi<ConnectedState> {
    return this.stateChanged.publicApi()
  }
  /** Fires with a short, user-facing status line. */
  get onStatusChanged(): PublicApi<string> {
    return this.statusChanged.publicApi()
  }
  /** Fires when the room, its members or its status change, and with null when leaving. */
  get onRoomChanged(): PublicApi<RoomInfo | null> {
    return this.roomChanged.publicApi()
  }

  get state(): ConnectedState {
    return this._state
  }
  get status(): string {
    return this._status
  }
  get room(): RoomInfo | null {
    return this.client?.room ?? null
  }
  /** The room's 4-digit code, or "" when not in a room. */
  get roomCode(): string {
    return this.room?.code ?? ""
  }
  /** This player's seat: 0 for the host, 1-3 for guests, -1 when not in a room. */
  get seat(): number {
    return this.room?.seat ?? -1
  }
  get isHost(): boolean {
    return this.seat === 0
  }

  onAwake(): void {
    this.logger = new Logger("SnapCloudConnected", this.enableLogging, true)
    if (!SnapCloudConnected.instance) SnapCloudConnected.instance = this
    if (this.origin && this.hideOriginUntilPlaced) this.origin.enabled = false
    // Say up front what is missing, so the panel never offers Host / Join that can't work.
    if (!this.getSupabaseProject()) this._status = NO_PROJECT_STATUS
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
    this.createEvent("OnDestroyEvent").bind(() => {
      if (SnapCloudConnected.instance === this) SnapCloudConnected.instance = null
      this.stopPlacement()
      this.client?.destroy()
    })
  }

  // ------------------------------------------------------------------ public API

  /** Creates a room. The 4-digit code is in roomCode once the state leaves Connecting. */
  host(): void {
    void this.connect(null)
  }

  /** Joins the room with this 4-digit code. */
  join(code: string): void {
    void this.connect(code)
  }

  /** Leaves the room and goes back to Offline. */
  leave(): void {
    this.stopPlacement()
    this.placed = false
    if (this.origin && this.hideOriginUntilPlaced) this.origin.enabled = false
    void this.client?.leave()
    this.resetClaims()
    this.setState(ConnectedState.Offline, "Left the room. Host a room or join one with its 4-digit code.")
    this.roomChanged.invoke(null)
  }

  /** Starts (or restarts) surface placement of the local origin. Readiness is cleared until confirmed again. */
  placeSurface(): void {
    if (!this.room) return
    if (this._state === ConnectedState.Waiting || this._state === ConnectedState.Active) void this.setReady(false)
    this.startPlacement()
  }

  /** Confirms this player is ready after placing the origin. */
  confirmReady(): void {
    if (this._state !== ConnectedState.Confirm || !this.placed) return
    void this.setReady(true)
  }

  /** SyncedTransforms registers its objects here. Ids must be the same on every device. */
  registerObject(id: string, object: SceneObject, ownerSeat: number): void {
    if (!object || this.entities[id]) {
      if (this.entities[id]) this.logger.warn("Duplicate synced id '" + id + "' ignored. Give each SyncedTransforms a unique Sync Id")
      return
    }
    if (Object.keys(this.entities).length >= MAX_SYNCED_TRANSFORMS) {
      this.logger.warn("More than " + MAX_SYNCED_TRANSFORMS + " synced transforms: '" + id + "' ignored")
      return
    }
    this.entities[id] = {id, object, ownerSeat, stamp: 0, claimSeat: -1, last: null, sent: null, target: null, snapToTarget: true}
  }

  unregisterObject(id: string): void {
    delete this.entities[id]
  }

  /** True when this player currently publishes this object's pose. */
  ownsObject(id: string): boolean {
    const e = this.entities[id]
    return !!e && this.owns(e)
  }

  // ------------------------------------------------------------------ connection

  /** The Snap Cloud project from SnapCloudRequirements, or the deprecated supabaseProject input when it isn't wired. */
  getSupabaseProject(): SupabaseProject | null {
    if (this.snapCloudRequirements) return this.snapCloudRequirements.getSupabaseProject() ?? null
    return this.supabaseProject ?? null
  }

  private ensureClient(): ConnectedRoomClient | null {
    if (this.client) return this.client
    const project = this.getSupabaseProject()
    if (!project) {
      this.setState(ConnectedState.Offline, NO_PROJECT_STATUS)
      return null
    }
    if (!project.url || !project.publicToken) {
      this.setState(ConnectedState.Offline, "The SupabaseProject asset has no URL or public key.")
      return null
    }
    this.client = new ConnectedRoomClient(project.url, project.publicToken, AUTH_MODES[this.authMode] ?? AUTH_MODES[0], {
      status: (message) => this.setStatus(message),
      log: (message) => this.logger.info(message),
      room: (room) => this.onRoom(room),
      transforms: (row) => this.onTransforms(row),
      lost: (reason) => {
        this.stopPlacement()
        this.placed = false
        this.resetClaims()
        this.setState(ConnectedState.Offline, reason + ". Host a room or join one with its 4-digit code.")
        this.roomChanged.invoke(null)
      }
    })
    return this.client
  }

  private async connect(code: string | null): Promise<void> {
    if (this._state === ConnectedState.Connecting) return
    const client = this.ensureClient()
    if (!client) return
    this.stopPlacement()
    this.placed = false
    this.resetClaims()
    this.setState(ConnectedState.Connecting, code === null ? "Creating a room…" : "Joining room " + code.trim() + "…")
    try {
      const room = code === null ? await client.createRoom(Math.max(2, Math.min(4, Math.round(this.maxPlayers)))) : await client.joinRoom(code)
      this.logger.info("In room " + room.code + " as player " + (room.seat + 1))
      this.startPlacement()
    } catch (error) {
      const message = (error as Error).message || String(error)
      if (message === "Cancelled") return
      this.setState(ConnectedState.Offline, "Could not connect: " + message)
    }
  }

  private async setReady(ready: boolean): Promise<void> {
    try {
      if (ready) this.setState(ConnectedState.Waiting, this.waitingMessage())
      await this.client?.setReady(ready)
    } catch (error) {
      if (ready) this.setState(ConnectedState.Confirm, "Could not confirm: " + ((error as Error).message || error) + ". Try again.")
    }
  }

  private onRoom(room: RoomInfo): void {
    this.roomChanged.invoke(room)
    const ready = room.members.some((m) => m.seat === room.seat && m.ready)
    if (room.status === "active" && ready && this.placed) {
      if (this._state !== ConnectedState.Active) this.activate()
    } else if (this._state === ConnectedState.Active) {
      this.setState(ConnectedState.Waiting, "A player left. " + this.waitingMessage())
    } else if (this._state === ConnectedState.Waiting) {
      this.setStatus(this.waitingMessage())
    }
  }

  private waitingMessage(): string {
    const room = this.room
    if (!room) return "Waiting…"
    const joined = room.members.length
    const readyCount = room.members.filter((m) => m.ready).length
    if (joined < room.max_players) return "Room " + room.code + " · waiting for " + (room.max_players - joined) + " more player(s) to join with this code."
    return "Room " + room.code + " · " + readyCount + " of " + room.max_players + " players ready."
  }

  private activate(): void {
    // Baseline every object so the first frame is not mistaken for a local move.
    for (const id in this.entities) {
      const e = this.entities[id]
      e.last = this.relativePose(e.object)
      e.sent = null
    }
    this.dirty = true
    this.sendTimer = Number.MAX_VALUE
    this.setState(ConnectedState.Active, "Room " + this.roomCode + " · connected as player " + (this.seat + 1) + ".")
    void this.client?.refreshTransforms()
  }

  // ------------------------------------------------------------------ surface placement

  private startPlacement(): void {
    this.placed = false
    const token = ++this.placementToken
    this.setState(ConnectedState.Placing, "Room " + this.roomCode + " · look at a surface to place your play area.")
    const mode = this.placementMode === PlacementMode.TABLETOP ? PlacementMode.TABLETOP : PlacementMode.GROUND
    const settings = new PlacementSettings(mode)
    this.placementUsed = true
    SurfacePlacementController.getInstance().startSurfacePlacement(settings, (pos, rot) => {
      if (token !== this.placementToken || !this.room) return
      this.moveOrigin(pos, rot)
      this.placed = true
      if (this.origin) this.origin.enabled = true
      if (this.autoReadyAfterPlacement) {
        this._state = ConnectedState.Confirm
        void this.setReady(true)
      } else {
        this.setState(ConnectedState.Confirm, "Room " + this.roomCode + " · surface placed. Confirm when you're ready, or place again.")
      }
    })
  }

  private stopPlacement(): void {
    ++this.placementToken
    // Only touch the SurfacePlacement singleton once it exists (getInstance creates it).
    if (this.placementUsed) SurfacePlacementController.getInstance().stopSurfacePlacement()
  }

  /** Moves the origin and carries every synced object with it, so relative poses don't change. */
  private moveOrigin(pos: vec3, rot: quat | null): void {
    if (!this.origin) return
    const keep: {[id: string]: Pose} = {}
    for (const id in this.entities) keep[id] = this.relativePose(this.entities[id].object)
    const t = this.origin.getTransform()
    t.setWorldPosition(pos)
    if (rot) t.setWorldRotation(rot)
    for (const id in keep) {
      const e = this.entities[id]
      this.applyRelativePose(e.object, keep[id])
      e.last = keep[id]
    }
  }

  // ------------------------------------------------------------------ transform sync

  private onUpdate(): void {
    const dt = getDeltaTime()
    this.client?.tick(dt)
    if (this._state !== ConnectedState.Active) return
    const seat = this.seat
    const k = this.smoothing > 0 ? 1 - Math.exp(-this.smoothing * dt) : 1
    for (const id in this.entities) {
      const e = this.entities[id]
      if (isNull(e.object)) continue
      const current = this.relativePose(e.object)
      if (e.ownerSeat === OWNER_ANYONE && e.claimSeat !== seat && e.last && moved(current, e.last)) {
        // The local player moved an object someone else held: take it over.
        e.stamp = ++this.lamport
        e.claimSeat = seat
        e.target = null
        this.dirty = true
      }
      if (this.owns(e)) {
        if (!e.sent || moved(current, e.sent)) this.dirty = true
        e.last = current
      } else if (e.target) {
        const next = e.snapToTarget || k >= 1 ? e.target : lerpPose(current, e.target, k)
        e.snapToTarget = false
        this.applyRelativePose(e.object, next)
        e.last = next
      } else {
        e.last = current
      }
    }
    this.sendTimer += dt
    if (this.dirty && this.sendTimer >= 1 / Math.max(1, this.sendRate)) {
      this.sendTimer = 0
      this.dirty = false
      this.publishOwned()
    }
  }

  private owns(e: SyncedEntity): boolean {
    const seat = this.seat
    return seat >= 0 && (e.ownerSeat === seat || (e.ownerSeat === OWNER_ANYONE && e.claimSeat === seat))
  }

  private publishOwned(): void {
    const entities: TransformPose[] = []
    for (const id in this.entities) {
      const e = this.entities[id]
      if (!this.owns(e) || isNull(e.object)) continue
      const pose = e.last ?? this.relativePose(e.object)
      e.sent = pose
      const wire: TransformPose = {
        id,
        p: [round(pose.p.x, 2), round(pose.p.y, 2), round(pose.p.z, 2)],
        r: [round(pose.r.x, 5), round(pose.r.y, 5), round(pose.r.z, 5), round(pose.r.w, 5)],
        s: [round(pose.s.x, 4), round(pose.s.y, 4), round(pose.s.z, 4)]
      }
      if (e.ownerSeat === OWNER_ANYONE) wire.o = e.stamp
      entities.push(wire)
    }
    this.client?.publish({entities})
  }

  private onTransforms(row: TransformRow): void {
    for (const pose of row.state.entities) {
      const e = this.entities[pose.id]
      if (!e) continue
      const target: Pose = {
        p: new vec3(pose.p[0], pose.p[1], pose.p[2]),
        r: normalized(new quat(pose.r[3], pose.r[0], pose.r[1], pose.r[2])),
        s: new vec3(pose.s[0], pose.s[1], pose.s[2])
      }
      if (e.ownerSeat === OWNER_ANYONE) {
        const stamp = pose.o ?? 0
        this.lamport = Math.max(this.lamport, stamp)
        const wins = e.claimSeat === row.seat || stamp > e.stamp || (stamp === e.stamp && (e.claimSeat < 0 || row.seat < e.claimSeat))
        if (!wins) continue
        if (e.claimSeat !== row.seat && e.claimSeat === this.seat) this.logger.info("'" + e.id + "' taken over by player " + (row.seat + 1))
        e.stamp = stamp
        e.claimSeat = row.seat
      } else if (e.ownerSeat !== row.seat) {
        continue
      }
      if (!e.target) e.snapToTarget = true
      e.target = target
    }
  }

  private resetClaims(): void {
    this.lamport = 0
    this.dirty = false
    for (const id in this.entities) {
      const e = this.entities[id]
      e.stamp = 0
      e.claimSeat = -1
      e.target = null
      e.sent = null
      e.snapToTarget = true
    }
  }

  // ------------------------------------------------------------------ frames

  /** This player's shared frame: the placed origin, turned by the seat yaw when players face each other. */
  private frame(): {p: vec3; r: quat; s: number} {
    if (!this.origin) return {p: vec3.zero(), r: quat.quatIdentity(), s: 1}
    const t = this.origin.getTransform()
    const seat = Math.max(0, this.seat)
    const yaw = this.faceToFace ? FACE_TO_FACE_YAW[seat % FACE_TO_FACE_YAW.length] : 0
    const r = t.getWorldRotation().multiply(quat.angleAxis((yaw * Math.PI) / 180, vec3.up()))
    const s = t.getWorldScale().x
    return {p: t.getWorldPosition(), r, s: Math.abs(s) > 1e-6 ? s : 1}
  }

  private relativePose(object: SceneObject): Pose {
    const f = this.frame()
    const t = object.getTransform()
    const inv = f.r.invert()
    return {
      p: inv.multiplyVec3(t.getWorldPosition().sub(f.p)).uniformScale(1 / f.s),
      r: normalized(inv.multiply(t.getWorldRotation())),
      s: t.getWorldScale().uniformScale(1 / f.s)
    }
  }

  private applyRelativePose(object: SceneObject, pose: Pose): void {
    const f = this.frame()
    const t = object.getTransform()
    t.setWorldPosition(f.p.add(f.r.multiplyVec3(pose.p.uniformScale(f.s))))
    t.setWorldRotation(f.r.multiply(pose.r))
    t.setWorldScale(pose.s.uniformScale(f.s))
  }

  // ------------------------------------------------------------------ state

  private setState(state: ConnectedState, status: string): void {
    const changed = state !== this._state
    this._state = state
    this.setStatus(status)
    if (changed) {
      this.logger.info("State: " + state)
      this.stateChanged.invoke(state)
    }
  }

  private setStatus(message: string): void {
    if (message === this._status) return
    this._status = message
    this.logger.info(message)
    this.statusChanged.invoke(message)
  }
}

function moved(a: Pose, b: Pose): boolean {
  return a.p.distance(b.p) > 0.05 || Math.abs(dot(a.r, b.r)) < 0.99999 || a.s.distance(b.s) > 0.0005
}

function dot(a: quat, b: quat): number {
  return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w
}

function normalized(q: quat): quat {
  const n = Math.sqrt(dot(q, q))
  return n > 1e-8 ? new quat(q.w / n, q.x / n, q.y / n, q.z / n) : quat.quatIdentity()
}

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {p: vec3.lerp(a.p, b.p, t), r: quat.slerp(a.r, b.r, t), s: vec3.lerp(a.s, b.s, t)}
}
