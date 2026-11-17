/**
 * BezierAnchor — a connection dot on one edge of a BezierCard.
 *
 * Standalone version of the Whiteboard's `BezierNode`. It does three things:
 *
 * 1. Knows which side of the card it sits on and configures a BezierLine handle for that side.
 *    Left/Right handles run along the card's local X axis, Top/Bottom along local Y — the exact
 *    rule the Whiteboard connector uses (`startAxis` / `startCtrlOffset` / `startAttachOffset`).
 * 2. Lets the user pinch it and drag out a new connector. SIK's InteractableManipulation moves a
 *    hidden "drag target" object instead of the anchor itself (`setManipulateRoot`), so the anchor
 *    stays glued to the card while a BezierLine is drawn from the anchor to the moving target.
 * 3. Reports what happens through typed events (onDragStart / onDragUpdate / onDragEnd). The board
 *    (BezierExamples) owns the lines, so the anchor never has to know about connections.
 */
import Event, {PublicApi} from "InteractionKit.lspkg/Utils/Event"
import {Interactable} from "InteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractableManipulation} from "InteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import {InteractorEvent} from "InteractionKit.lspkg/Core/Interactor/InteractorEvent"
import {Interactor} from "InteractionKit.lspkg/Core/Interactor/Interactor"
import {BezierLine} from "../Scripts/BezierLine"
import type {BezierCard} from "./BezierCard"

export type AnchorSide = "Left" | "Right" | "Top" | "Bottom"

export const ANCHOR_SIDES: AnchorSide[] = ["Left", "Right", "Top", "Bottom"]

export const OPPOSITE_SIDE: Record<AnchorSide, AnchorSide> = {
  Left: "Right",
  Right: "Left",
  Top: "Bottom",
  Bottom: "Top",
}

export interface AnchorDragUpdate {
  source: BezierAnchor
  /** Anchor of another card currently under the interactor, or null while in empty space. */
  hovered: BezierAnchor | null
}

export interface AnchorDragEnd {
  source: BezierAnchor
  /** Anchor the drag was released on (a valid connection target), or null. */
  target: BezierAnchor | null
  /** True when the pinch was released without moving — a "tap" on the anchor. */
  isTap: boolean
}

/** Pinch released closer than this to where it started counts as a tap, not a drag. */
const TAP_DISTANCE_CM = 1.5
const HIGHLIGHT_SCALE = 1.6
/** SIK Interactable targeting mode: 3 = Direct + Indirect. */
const TARGETING_DIRECT_AND_INDIRECT = 3

@component
export class BezierAnchor extends BaseScriptComponent {
  private static registry: Map<Interactable, BezierAnchor> = new Map()

  /** Card this anchor belongs to. Set by `init()`. */
  card!: BezierCard
  /** Side of the card this anchor sits on. */
  side: AnchorSide = "Left"

  private interactable!: Interactable
  private manipulation!: InteractableManipulation
  private dragTargetObject!: SceneObject
  private visual: SceneObject | null = null
  private visualMaterial: Material | null = null
  private baseColor: vec4 = new vec4(1, 1, 1, 1)
  private highlightColor: vec4 = new vec4(1, 1, 1, 1)
  private baseVisualScale: vec3 = vec3.one()

  private transform!: Transform
  private updateEvent!: SceneEvent
  private activeInteractor: Interactor | null = null
  private hovered: BezierAnchor | null = null
  private dragging: boolean = false

  private _onDragStart = new Event<BezierAnchor>()
  private _onDragUpdate = new Event<AnchorDragUpdate>()
  private _onDragEnd = new Event<AnchorDragEnd>()

  /** Fires when the user starts dragging a connector out of this anchor. */
  get onDragStart(): PublicApi<BezierAnchor> {
    return this._onDragStart.publicApi()
  }
  /** Fires every frame while dragging, with the anchor currently hovered (if any). */
  get onDragUpdate(): PublicApi<AnchorDragUpdate> {
    return this._onDragUpdate.publicApi()
  }
  /** Fires when the pinch is released. */
  get onDragEnd(): PublicApi<AnchorDragEnd> {
    return this._onDragEnd.publicApi()
  }

  /** Object that follows the hand while a connector is dragged out. Use it as the live line's `end`. */
  get dragTarget(): SceneObject {
    return this.dragTargetObject
  }

  /** Local card axis this side's handle runs along. */
  get axis(): "X" | "Y" {
    return this.side === "Left" || this.side === "Right" ? "X" : "Y"
  }

  /** +1 when the handle points along the positive axis (Right / Top), -1 for Left / Bottom. */
  get direction(): number {
    return this.side === "Right" || this.side === "Top" ? 1 : -1
  }

  onAwake(): void {
    this.transform = this.getTransform()
    this.updateEvent = this.createEvent("UpdateEvent")
    this.updateEvent.bind(() => this.onUpdate())
    this.updateEvent.enabled = false
    this.createEvent("OnDestroyEvent").bind(() => {
      if (this.interactable) BezierAnchor.registry.delete(this.interactable)
    })
  }

  /**
   * Wires the anchor to its card and builds its visual, collider and SIK components.
   * Called by BezierCard right after the component is created at runtime.
   */
  init(card: BezierCard, side: AnchorSide, radius: number, mesh: RenderMesh, material: Material, highlight: vec4): void {
    this.card = card
    this.side = side
    this.highlightColor = highlight

    // Visual: a small sphere on a child so the anchor object itself stays at scale 1 (colliders scale with the object).
    this.visual = global.scene.createSceneObject("Visual")
    this.visual.setParent(this.sceneObject)
    const rmv = this.visual.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = mesh
    this.visualMaterial = material.clone()
    this.baseColor = this.visualMaterial.mainPass.baseColor
    rmv.mainMaterial = this.visualMaterial
    const extent = mesh.aabbMax.sub(mesh.aabbMin)
    const diameter = radius * 2
    this.baseVisualScale = new vec3(diameter / extent.x, diameter / extent.y, diameter / extent.z)
    this.visual.getTransform().setLocalScale(this.baseVisualScale)

    // Drag target: a bare object the manipulation moves instead of the anchor.
    this.dragTargetObject = global.scene.createSceneObject(`DragTarget ${side}`)
    this.dragTargetObject.setParent(this.sceneObject)

    // Hit volume — generous so the dot is easy to target from a distance (Specs guideline: >= 4 cm targets).
    const collider = this.sceneObject.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createSphereShape()
    shape.radius = Math.max(radius * 2.2, 2.0)
    collider.fitVisual = false
    collider.shape = shape

    // SIK: Interactable receives pinch / hover, InteractableManipulation turns the pinch into a drag.
    this.interactable = this.sceneObject.createComponent(Interactable.getTypeName()) as Interactable
    this.interactable.targetingMode = TARGETING_DIRECT_AND_INDIRECT
    this.manipulation = this.sceneObject.createComponent(InteractableManipulation.getTypeName()) as InteractableManipulation
    this.manipulation.setCanRotate(false)
    this.manipulation.setCanScale(false)
    // The manipulation moves the drag target, never the anchor — same trick as the Whiteboard's BezierDragDummy.
    this.manipulation.setManipulateRoot(this.dragTargetObject.getTransform())

    BezierAnchor.registry.set(this.interactable, this)

    // The components above were created just now, so their event fields exist and can be subscribed immediately.
    this.interactable.onHoverEnter.add(() => this.setHighlight(true))
    this.interactable.onHoverExit.add(() => {
      if (!this.dragging) this.setHighlight(false)
    })
    this.interactable.onTriggerStart.add((e: InteractorEvent) => this.beginDrag(e))
    this.interactable.onTriggerEnd.add(() => this.endDrag())
    this.interactable.onTriggerEndOutside.add(() => this.endDrag())
    this.interactable.onTriggerCanceled.add(() => this.endDrag())
  }

  /** Finds the anchor that owns an Interactable (used to detect anchors under the drag cursor). */
  static fromInteractable(interactable: Interactable): BezierAnchor | null {
    return BezierAnchor.registry.get(interactable) ?? null
  }

  // ── Whiteboard handle rules ────────────────────────────────────────────────

  /** Configures the START of `line` to leave this anchor along its side's axis. */
  applyStart(line: BezierLine, handleLength: number, attachOffset: number): void {
    line.axisUseLocal = true
    line.startAxis = this.axis
    line.startCtrlOffset = this.direction * handleLength
    line.startAttachOffset = this.direction * attachOffset
    line.markDirty()
  }

  /** Configures the END of `line` to arrive at this anchor along its side's axis. */
  applyEnd(line: BezierLine, handleLength: number, attachOffset: number): void {
    BezierAnchor.configureEnd(line, this.side, handleLength, attachOffset)
  }

  /**
   * Configures the END of `line` as if it arrived at an anchor on `side`.
   * Used for the loose end of a live drag, which curves as if it were heading for the opposite side.
   */
  static configureEnd(line: BezierLine, side: AnchorSide, handleLength: number, attachOffset: number): void {
    const axis: "X" | "Y" = side === "Left" || side === "Right" ? "X" : "Y"
    const direction = side === "Right" || side === "Top" ? 1 : -1
    line.axisUseLocal = true
    line.endAxis = axis
    line.endCtrlOffset = direction * handleLength
    line.endAttachOffset = direction * attachOffset
    line.markDirty()
  }

  // ── Visual feedback ────────────────────────────────────────────────────────

  /** Grows the dot and tints it with the card color. */
  setHighlight(on: boolean): void {
    if (!this.visual) return
    const s = on ? HIGHLIGHT_SCALE : 1
    this.visual.getTransform().setLocalScale(this.baseVisualScale.uniformScale(s))
    if (this.visualMaterial) {
      this.visualMaterial.mainPass.baseColor = on ? this.highlightColor : this.baseColor
    }
  }

  // ── Drag-to-connect ────────────────────────────────────────────────────────

  private beginDrag(e: InteractorEvent): void {
    if (this.dragging) return
    this.dragging = true
    this.activeInteractor = e.interactor
    // Start the drag target exactly on the anchor so the new connector begins with zero length.
    const t = this.dragTargetObject.getTransform()
    t.setWorldPosition(this.transform.getWorldPosition())
    t.setWorldRotation(this.transform.getWorldRotation())
    t.setWorldScale(this.transform.getWorldScale())
    this.hovered = null
    this.setHighlight(true)
    this.updateEvent.enabled = true
    this._onDragStart.invoke(this)
  }

  private onUpdate(): void {
    if (!this.dragging || !this.activeInteractor) return
    const hovered = this.findHoveredAnchor()
    if (hovered !== this.hovered) {
      if (this.hovered) this.hovered.setHighlight(false)
      this.hovered = hovered
      if (this.hovered) this.hovered.setHighlight(true)
    }
    this._onDragUpdate.invoke({source: this, hovered})
  }

  /** Anchor of ANOTHER card under the interactor's cursor, or null. */
  private findHoveredAnchor(): BezierAnchor | null {
    const list = this.activeInteractor ? this.activeInteractor.hoveredInteractables : []
    for (const interactable of list) {
      const anchor = BezierAnchor.fromInteractable(interactable)
      if (anchor && anchor !== this && anchor.card !== this.card) return anchor
    }
    return null
  }

  private endDrag(): void {
    if (!this.dragging) return
    this.dragging = false
    this.updateEvent.enabled = false
    const target = this.hovered
    this.hovered = null
    if (target) target.setHighlight(false)
    this.setHighlight(false)
    const moved = this.dragTargetObject.getTransform().getWorldPosition().distance(this.transform.getWorldPosition())
    this._onDragEnd.invoke({source: this, target, isTap: !target && moved < TAP_DISTANCE_CM})
    this.activeInteractor = null
  }
}
