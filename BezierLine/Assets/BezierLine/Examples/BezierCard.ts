/**
 * BezierCard — a grabbable "sticky note" with four BezierAnchor dots on its edges.
 *
 * Built entirely at runtime by `BezierCard.create()` (face, label, collider, SIK grab, anchors),
 * mirroring how the Whiteboard composes a moveable object with a BezierLineHolder and four nodes.
 * Move the card (pinch + drag) and every BezierLine attached to its anchors follows, because the
 * lines track the anchors' transforms.
 */
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractableManipulation} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import {ANCHOR_SIDES, AnchorSide, BezierAnchor} from "./BezierAnchor"

export interface BezierCardOptions {
  label: string
  color: vec4
  /** Card width / height in cm. */
  size: vec2
  /** Local position under the parent. */
  position: vec3
  cardMesh: RenderMesh
  cardMaterial: Material
  anchorMesh: RenderMesh
  anchorMaterial: Material
  anchorRadius: number
  /** `Component.Text.size` for the label. */
  labelTextSize: number
}

const CARD_THICKNESS_CM = 0.6
/** Anchors sit slightly in front of the face so the interaction ray hits them before the card. */
const ANCHOR_Z_OFFSET = 0.8
/** SIK Interactable targeting mode: 3 = Direct + Indirect. */
const TARGETING_DIRECT_AND_INDIRECT = 3

/** Scales `obj` so `mesh` spans exactly `size` (cm) on each axis. */
export function scaleMeshToSize(obj: SceneObject, mesh: RenderMesh, size: vec3): void {
  const extent = mesh.aabbMax.sub(mesh.aabbMin)
  obj.getTransform().setLocalScale(new vec3(size.x / extent.x, size.y / extent.y, size.z / extent.z))
}

/** Mixes a color toward white — used for the anchor highlight and the connector tint. */
export function lighten(color: vec4, amount: number): vec4 {
  return new vec4(
    color.x + (1 - color.x) * amount,
    color.y + (1 - color.y) * amount,
    color.z + (1 - color.z) * amount,
    color.w
  )
}

@component
export class BezierCard extends BaseScriptComponent {
  /** Builds a complete card under `parent` and returns its component. */
  static create(parent: SceneObject, options: BezierCardOptions): BezierCard {
    const obj = global.scene.createSceneObject(`Card ${options.label}`)
    obj.setParent(parent)
    obj.getTransform().setLocalPosition(options.position)
    const card = obj.createComponent(BezierCard.getTypeName()) as BezierCard
    card.init(options)
    return card
  }

  label: string = ""
  color: vec4 = new vec4(1, 1, 1, 1)
  size: vec2 = new vec2(16, 10)

  private anchorMap: Map<AnchorSide, BezierAnchor> = new Map()
  private faceMaterial: Material | null = null
  private labelText: Text | null = null
  private interactable: Interactable | null = null
  private manipulation: InteractableManipulation | null = null

  /** All four anchors, in Left / Right / Top / Bottom order. */
  get anchors(): BezierAnchor[] {
    return ANCHOR_SIDES.map((side) => this.anchorMap.get(side)!).filter((a) => a !== undefined)
  }

  getAnchor(side: AnchorSide): BezierAnchor {
    return this.anchorMap.get(side)!
  }

  /** Populates the card. Called by `create()`; call it yourself if you attach the component in the Inspector. */
  init(options: BezierCardOptions): void {
    this.label = options.label
    this.color = options.color
    this.size = options.size
    const w = options.size.x
    const h = options.size.y

    // Face
    const face = global.scene.createSceneObject("Face")
    face.setParent(this.sceneObject)
    const rmv = face.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = options.cardMesh
    this.faceMaterial = options.cardMaterial.clone()
    this.faceMaterial.mainPass.baseColor = options.color
    rmv.mainMaterial = this.faceMaterial
    scaleMeshToSize(face, options.cardMesh, new vec3(w, h, CARD_THICKNESS_CM))

    // Label — white text reads well on Specs' additive display over a saturated card.
    const labelObj = global.scene.createSceneObject("Label")
    labelObj.setParent(this.sceneObject)
    labelObj.getTransform().setLocalPosition(new vec3(0, 0, CARD_THICKNESS_CM * 0.5 + 0.1))
    this.labelText = labelObj.createComponent("Component.Text") as Text
    this.labelText.text = options.label
    this.labelText.size = options.labelTextSize
    ;(this.labelText as Text & {weight?: number}).weight = 700
    this.labelText.depthTest = true
    this.labelText.horizontalAlignment = HorizontalAlignment.Center
    this.labelText.verticalAlignment = VerticalAlignment.Center
    this.labelText.horizontalOverflow = HorizontalOverflow.Overflow
    this.labelText.verticalOverflow = VerticalOverflow.Overflow
    this.labelText.layoutRect = Rect.create(-w / 2, w / 2, -h / 2, h / 2)

    // Grab: box collider + Interactable + InteractableManipulation (translate only, like Whiteboard cards).
    const collider = this.sceneObject.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createBoxShape()
    shape.size = new vec3(w, h, 2)
    collider.fitVisual = false
    collider.shape = shape
    this.interactable = this.sceneObject.createComponent(Interactable.getTypeName()) as Interactable
    this.interactable.targetingMode = TARGETING_DIRECT_AND_INDIRECT
    this.manipulation = this.sceneObject.createComponent(InteractableManipulation.getTypeName()) as InteractableManipulation
    this.manipulation.setCanRotate(false)
    this.manipulation.setCanScale(false)

    // Anchors on the four edges.
    const highlight = lighten(options.color, 0.25)
    const positions: Record<AnchorSide, vec3> = {
      Left: new vec3(-w / 2, 0, ANCHOR_Z_OFFSET),
      Right: new vec3(w / 2, 0, ANCHOR_Z_OFFSET),
      Top: new vec3(0, h / 2, ANCHOR_Z_OFFSET),
      Bottom: new vec3(0, -h / 2, ANCHOR_Z_OFFSET),
    }
    for (const side of ANCHOR_SIDES) {
      const anchorObj = global.scene.createSceneObject(`Anchor ${side}`)
      anchorObj.setParent(this.sceneObject)
      anchorObj.getTransform().setLocalPosition(positions[side])
      const anchor = anchorObj.createComponent(BezierAnchor.getTypeName()) as BezierAnchor
      anchor.init(this, side, options.anchorRadius, options.anchorMesh, options.anchorMaterial, highlight)
      this.anchorMap.set(side, anchor)
    }
  }

  setLabel(label: string): void {
    this.label = label
    if (this.labelText) this.labelText.text = label
  }

  setColor(color: vec4): void {
    this.color = color
    if (this.faceMaterial) this.faceMaterial.mainPass.baseColor = color
  }

  /** Destroys the card and everything under it (anchors included). Remove its connections first. */
  destroyCard(): void {
    this.sceneObject.destroy()
  }
}
