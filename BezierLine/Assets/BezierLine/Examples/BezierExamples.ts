/**
 * BezierExamples — a mini whiteboard that shows how the SPECS Whiteboard uses BezierLine.
 *
 * What it demonstrates:
 * - `BezierLine.createBezierLine()` — connectors are created at runtime, no prefab needed.
 * - The Whiteboard handle rules — connectors leave/arrive along a card edge's local axis
 *   (X for Left/Right, Y for Top/Bottom) with a 15 cm handle and a small attach offset.
 * - Change detection — grab a card (SIK) and every attached ribbon follows for free.
 * - Camera facing — ribbons stay flat toward the viewer (`faceCamera` + `camera`).
 * - Drag-to-connect — pinch an anchor dot, drag to another card's dot, release (BezierAnchor).
 * - Curve queries — flow markers ride each connector using `getPointAtT()` / `getTangentAtT()`.
 *
 * Place this on an empty object and assign the meshes/materials, or drop
 * `BezierLine__PLACE_IN_SCENE.prefab` into the scene.
 */
import Event, {PublicApi} from "InteractionKit.lspkg/Utils/Event"
import WorldCameraFinderProvider from "InteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {BezierLine} from "../Scripts/BezierLine"
import {AnchorDragEnd, AnchorDragUpdate, BezierAnchor, OPPOSITE_SIDE} from "./BezierAnchor"
import {BezierCard, lighten, scaleMeshToSize} from "./BezierCard"

export interface Connection {
  from: BezierAnchor
  to: BezierAnchor
  line: BezierLine
  material: Material
  marker: SceneObject | null
  /** Phase offset so markers on different connectors are not in lockstep. */
  phase: number
}

interface StarterCard {
  label: string
  position: vec3
}

/** Card colors — saturated so white labels stay readable on Specs' additive display. */
const PALETTE: vec4[] = [
  new vec4(0.98, 0.7, 0.18, 1), // amber
  new vec4(0.32, 0.6, 0.98, 1), // sky
  new vec4(0.36, 0.82, 0.58, 1), // mint
  new vec4(0.95, 0.42, 0.55, 1), // rose
  new vec4(0.68, 0.55, 0.98, 1), // violet
]

const STARTER_CARDS: StarterCard[] = [
  {label: "Idea", position: new vec3(-20, 8, 0)},
  {label: "Design", position: new vec3(20, 8, 0)},
  {label: "Ship", position: new vec3(0, -12, 0)},
]

/** How far the ribbon stops outside the anchor dot so it visibly starts at the dot's surface. */
const ATTACH_OUTSIDE_DOT_CM = 0.3
/** Label size = Headline1 (54) scaled to the 130 cm focal plane. */
const CARD_LABEL_TEXT_SIZE = 64
const MARKER_RADIUS_FACTOR = 0.9
const MARKER_LENGTH_FACTOR = 3.0

@component
export class BezierExamples extends BaseScriptComponent {
  @ui.label("BezierLine Examples — whiteboard-style connector board")
  @ui.separator
  @ui.group_start("Assets")
  @input
  @hint("Box mesh used for the card faces (scaled to Card Size).")
  cardMesh: RenderMesh
  @input
  @hint("Sphere mesh used for anchor dots and flow markers.")
  anchorMesh: RenderMesh
  @input
  @hint("Material cloned and tinted per card.")
  cardMaterial: Material
  @input
  @hint("Material cloned per anchor dot (tinted with the card color on hover).")
  anchorMaterial: Material
  @input
  @hint("Material cloned and tinted per connector ribbon.")
  connectorMaterial: Material
  @input
  @hint("Material cloned and tinted per flow marker.")
  markerMaterial: Material
  @ui.group_end

  @ui.group_start("Connectors")
  @input
  @hint("Ribbon width in cm.")
  @widget(new SliderWidget(0.05, 2, 0.01))
  lineWidth: number = 0.45
  @input("int")
  @hint("Curve subdivisions per connector (2-128). Each adds two vertices.")
  @widget(new SliderWidget(2, 128, 1))
  segments: number = 32
  @input
  @hint("Handle length in cm — how far a connector leaves a card before bending. The Whiteboard uses 15.")
  @widget(new SliderWidget(0, 30, 0.5))
  handleLength: number = 15
  @input
  @hint("Rotate ribbons to face the camera so they never appear edge-on.")
  faceCamera: boolean = true
  @input
  @hint("Draw curve, control points and handles with the debug render system.")
  debugDraw: boolean = false
  @ui.group_end

  @ui.group_start("Board")
  @input
  @hint("Card size in cm.")
  cardSize: vec2 = new vec2(16, 10)
  @input
  @hint("Anchor dot radius in cm.")
  @widget(new SliderWidget(0.4, 2.5, 0.1))
  anchorRadius: number = 0.9
  @input
  @hint("Show a marker travelling along each connector (getPointAtT / getTangentAtT).")
  flowMarkers: boolean = true
  @input
  @hint("Flow marker speed in laps per second.")
  @widget(new SliderWidget(0.05, 2, 0.05))
  flowSpeed: number = 0.3
  @ui.group_end

  private camera: Camera | null = null
  private cardsRoot!: SceneObject
  private linesRoot!: SceneObject
  private cards: BezierCard[] = []
  private connections: Connection[] = []
  private liveLine: BezierLine | null = null
  private liveHovered: BezierAnchor | null = null
  private cardsSpawned: number = 0

  private _onConnectionsChanged = new Event<number>()
  /** Fires with the connection count whenever a connector is added or removed. */
  get onConnectionsChanged(): PublicApi<number> {
    return this._onConnectionsChanged.publicApi()
  }

  get connectionCount(): number {
    return this.connections.length
  }

  /** Vertices currently generated across all connectors: two per segment step. */
  get vertexCount(): number {
    return this.connections.length * (this.segments + 1) * 2
  }

  onAwake(): void {
    this.cardsRoot = global.scene.createSceneObject("Cards")
    this.cardsRoot.setParent(this.sceneObject)
    this.linesRoot = global.scene.createSceneObject("Connections")
    this.linesRoot.setParent(this.sceneObject)

    // SIK's camera provider resolves the Specs world camera without an @input.
    this.camera = WorldCameraFinderProvider.getInstance().getComponent()

    this.createEvent("OnStartEvent").bind(() => this.buildStarterBoard())
    this.createEvent("UpdateEvent").bind(() => this.updateFlowMarkers())
  }

  // ── Board ──────────────────────────────────────────────────────────────────

  /** Three cards in a triangle, connected the way you would sketch a flow on a whiteboard. */
  buildStarterBoard(): void {
    this.clearBoard()
    const cards = STARTER_CARDS.map((c) => this.addCardAt(c.label, c.position))
    const [idea, design, ship] = cards
    this.connect(idea.getAnchor("Right"), design.getAnchor("Left"))
    this.connect(design.getAnchor("Bottom"), ship.getAnchor("Right"))
    this.connect(idea.getAnchor("Bottom"), ship.getAnchor("Left"))
  }

  /** Spawns a new card just in front of the board center so it is easy to grab and move. */
  addCard(): BezierCard {
    const n = this.cardsSpawned
    const jitter = new vec3((n % 3) * 4 - 4, ((n + 1) % 3) * 3 - 3, 6 + (n % 2) * 3)
    return this.addCardAt(`Note ${n + 1}`, jitter)
  }

  addCardAt(label: string, position: vec3): BezierCard {
    const card = BezierCard.create(this.cardsRoot, {
      label,
      color: PALETTE[this.cardsSpawned % PALETTE.length],
      size: this.cardSize,
      position,
      cardMesh: this.cardMesh,
      cardMaterial: this.cardMaterial,
      anchorMesh: this.anchorMesh,
      anchorMaterial: this.anchorMaterial,
      anchorRadius: this.anchorRadius,
      labelTextSize: CARD_LABEL_TEXT_SIZE,
    })
    this.cardsSpawned++
    for (const anchor of card.anchors) {
      anchor.onDragStart.add((a) => this.onAnchorDragStart(a))
      anchor.onDragUpdate.add((e) => this.onAnchorDragUpdate(e))
      anchor.onDragEnd.add((e) => this.onAnchorDragEnd(e))
    }
    this.cards.push(card)
    return card
  }

  /** Removes every card and connector. */
  clearBoard(): void {
    this.clearConnections()
    for (const card of this.cards) card.destroyCard()
    this.cards = []
    this.cardsSpawned = 0
  }

  /** Rebuilds the starter layout. */
  resetBoard(): void {
    this.buildStarterBoard()
  }

  // ── Connections ────────────────────────────────────────────────────────────

  /**
   * Connects two anchors with a BezierLine. Only one connector may exist between two cards,
   * so an existing one between the same pair is replaced (same rule as the Whiteboard).
   */
  connect(from: BezierAnchor, to: BezierAnchor): Connection | null {
    if (from.card === to.card) return null
    const existing = this.connections.find(
      (c) => (c.from.card === from.card && c.to.card === to.card) || (c.from.card === to.card && c.to.card === from.card)
    )
    if (existing) this.removeConnection(existing)

    const material = this.connectorMaterial.clone()
    material.mainPass.baseColor = lighten(from.card.color, 0.35)
    const line = BezierLine.createBezierLine(this.linesRoot, material, from.sceneObject, to.sceneObject)
    this.applyLineSettings(line)
    from.applyStart(line, this.handleLength, this.attachOffset)
    to.applyEnd(line, this.handleLength, this.attachOffset)

    const connection: Connection = {from, to, line, material, marker: null, phase: Math.random()}
    connection.marker = this.createMarker(from.card.color)
    connection.marker.enabled = this.flowMarkers
    this.connections.push(connection)
    this._onConnectionsChanged.invoke(this.connections.length)
    return connection
  }

  removeConnection(connection: Connection): void {
    const index = this.connections.indexOf(connection)
    if (index < 0) return
    this.connections.splice(index, 1)
    connection.line.sceneObject.destroy()
    if (connection.marker) connection.marker.destroy()
    this._onConnectionsChanged.invoke(this.connections.length)
  }

  /** Removes every connector touching `anchor`. */
  removeConnectionsAt(anchor: BezierAnchor): void {
    for (const c of this.connections.filter((c) => c.from === anchor || c.to === anchor)) {
      this.removeConnection(c)
    }
  }

  clearConnections(): void {
    for (const c of [...this.connections]) this.removeConnection(c)
  }

  // ── Live settings (called by the UI panel) ─────────────────────────────────

  setLineWidth(width: number): void {
    this.lineWidth = width
    this.forEachLine((line) => {
      line.width = width
      line.markDirty()
    })
  }

  setSegments(segments: number): void {
    this.segments = Math.max(2, Math.round(segments))
    this.forEachLine((line) => {
      line.segments = this.segments
      line.markDirty()
    })
  }

  /** Re-applies the Whiteboard handle rule with a new handle length on every connector. */
  setHandleLength(cm: number): void {
    this.handleLength = cm
    for (const c of this.connections) {
      c.from.applyStart(c.line, cm, this.attachOffset)
      c.to.applyEnd(c.line, cm, this.attachOffset)
    }
  }

  setFaceCamera(on: boolean): void {
    this.faceCamera = on
    this.forEachLine((line) => {
      line.faceCamera = on
      line.markDirty()
    })
  }

  setDebugDraw(on: boolean): void {
    this.debugDraw = on
    this.forEachLine((line) => {
      line.debugDraw = on
      line.markDirty()
    })
  }

  setFlowMarkers(on: boolean): void {
    this.flowMarkers = on
    for (const c of this.connections) {
      if (c.marker) c.marker.enabled = on
    }
  }

  // ── Drag-to-connect (driven by BezierAnchor events) ────────────────────────

  private onAnchorDragStart(source: BezierAnchor): void {
    this.destroyLiveLine()
    const material = this.connectorMaterial.clone()
    material.mainPass.baseColor = lighten(source.card.color, 0.6)
    // Same factory as a real connector — the end just happens to be the anchor's drag target.
    const line = BezierLine.createBezierLine(this.linesRoot, material, source.sceneObject, source.dragTarget)
    this.applyLineSettings(line)
    source.applyStart(line, this.handleLength, this.attachOffset)
    BezierAnchor.configureEnd(line, OPPOSITE_SIDE[source.side], this.handleLength, 0)
    this.liveLine = line
    this.liveHovered = null
  }

  private onAnchorDragUpdate(e: AnchorDragUpdate): void {
    if (!this.liveLine || e.hovered === this.liveHovered) return
    this.liveHovered = e.hovered
    if (e.hovered) {
      // Snap the loose end onto the hovered dot and curve into its side.
      this.liveLine.setEndpoints(e.source.sceneObject, e.hovered.sceneObject)
      e.hovered.applyEnd(this.liveLine, this.handleLength, this.attachOffset)
    } else {
      this.liveLine.setEndpoints(e.source.sceneObject, e.source.dragTarget)
      BezierAnchor.configureEnd(this.liveLine, OPPOSITE_SIDE[e.source.side], this.handleLength, 0)
    }
  }

  private onAnchorDragEnd(e: AnchorDragEnd): void {
    this.destroyLiveLine()
    if (e.target) {
      this.connect(e.source, e.target)
    } else if (e.isTap) {
      // Tapping a dot clears the connectors attached to it.
      this.removeConnectionsAt(e.source)
    }
  }

  private destroyLiveLine(): void {
    if (this.liveLine) {
      this.liveLine.sceneObject.destroy()
      this.liveLine = null
    }
    this.liveHovered = null
  }

  // ── Flow markers: getPointAtT / getTangentAtT in action ────────────────────

  private createMarker(color: vec4): SceneObject {
    const marker = global.scene.createSceneObject("FlowMarker")
    marker.setParent(this.linesRoot)
    const rmv = marker.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = this.anchorMesh
    const material = this.markerMaterial.clone()
    material.mainPass.baseColor = lighten(color, 0.5)
    rmv.mainMaterial = material
    const r = this.lineWidth * MARKER_RADIUS_FACTOR
    // A sphere stretched along +Z becomes a pill; lookAt() then aligns +Z with the curve tangent.
    scaleMeshToSize(marker, this.anchorMesh, new vec3(r * 2, r * 2, r * 2 * MARKER_LENGTH_FACTOR))
    return marker
  }

  private updateFlowMarkers(): void {
    if (!this.flowMarkers || this.connections.length === 0) return
    const time = getTime() * this.flowSpeed
    for (const c of this.connections) {
      if (!c.marker) continue
      const t = (time + c.phase) % 1
      const point = c.line.getPointAtT(t)
      const tangent = c.line.getTangentAtT(t)
      if (!point || !tangent) continue
      const transform = c.marker.getTransform()
      transform.setWorldPosition(point)
      transform.setWorldRotation(quat.lookAt(tangent, vec3.up()))
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private get attachOffset(): number {
    return this.anchorRadius + ATTACH_OUTSIDE_DOT_CM
  }

  private applyLineSettings(line: BezierLine): void {
    line.camera = this.camera
    line.width = this.lineWidth
    line.segments = this.segments
    line.faceCamera = this.faceCamera
    line.debugDraw = this.debugDraw
  }

  private forEachLine(fn: (line: BezierLine) => void): void {
    for (const c of this.connections) fn(c.line)
    if (this.liveLine) fn(this.liveLine)
  }
}
