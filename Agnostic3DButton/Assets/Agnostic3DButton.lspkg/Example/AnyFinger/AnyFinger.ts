/**
 * Example 5 — Any Finger: the button's "finger" is a grabbable ball, not a hand. Pinch the ball,
 * push it down onto the button and it presses it; let go and the ball floats back. The button's own
 * SIK fingertips are off here, to show that any object (anything with a transform) can press it.
 */
import {Interactable} from "InteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractableManipulation} from "InteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import {ButtonShape} from "../../Scripts/ButtonVolume"
import {createButton, createConsole} from "../Shared/ButtonFactory"
import {BODY_SIZE, createText, TITLE_SIZE} from "../Shared/DemoUI"

const BALL_RADIUS = 1.8

@component
export class AnyFinger extends BaseScriptComponent {
  @input capMaterial: Material
  @input glowMaterial: Material

  private ball: SceneObject
  /** Rest position in the example root's local space (the carousel may move the root). */
  private homeLocal: vec3
  private grabbed = false
  private releasedAt = -1e9
  private clicks = 0

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.build())
    this.createEvent("UpdateEvent").bind(() => this.update())
  }

  private build(): void {
    const root = this.sceneObject
    createText(root, "Title", new vec3(0, 12, 0), TITLE_SIZE, 30, 4, "Any finger")
    const info = createText(root, "Info", new vec3(0, 8.8, 0), BODY_SIZE, 32, 3, "Grab the ball and press the button with it")

    const deck = createConsole(root, "Console", new vec3(0, -4, 0))
    const made = createButton(deck, "BallButton", vec3.zero(), this.capMaterial, this.glowMaterial, {
      shape: ButtonShape.Cylinder,
      size: new vec2(9, 9),
      travel: 1.6,
      capHeight: 1.4,
      label: "BALL",
      theme: "Candy",
    })
    made.button.useSIKIndexTips = false
    made.button.hoverHeight = BALL_RADIUS * 2

    // The ball, resting a little above the button.
    const up = made.object.getTransform().up
    const homeWorld = made.object.getTransform().getWorldPosition().add(up.uniformScale(7))
    this.homeLocal = root.getTransform().getInvertedWorldTransform().multiplyPoint(homeWorld)
    this.ball = this.createBall(root)

    // The ball's lowest point along the button's up axis is the "fingertip".
    made.button.addFingerSource(() => {
      const p = this.ball.getTransform().getWorldPosition()
      return p.sub(made.object.getTransform().up.uniformScale(BALL_RADIUS))
    })
    made.button.onClick.add(() => {
      this.clicks++
      info.text = "Pressed by the ball × " + this.clicks
    })
  }

  private createBall(parent: SceneObject): SceneObject {
    const o = global.scene.createSceneObject("Ball")
    o.setParent(parent)
    o.getTransform().setLocalPosition(this.homeLocal)
    const visual = o.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = sphereMesh(BALL_RADIUS, 24, 16)
    visual.mainMaterial = this.capMaterial.clone()
    visual.mainMaterial.mainPass.baseColor = new vec4(0.47, 0.8, 0.76, 1)
    // The collider must exist before the Interactable is created.
    const collider = o.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createSphereShape()
    shape.radius = BALL_RADIUS * 1.2
    collider.shape = shape
    collider.fitVisual = false
    o.createComponent(Interactable.getTypeName())
    const manipulation = o.createComponent(InteractableManipulation.getTypeName()) as InteractableManipulation
    manipulation.setCanRotate(false)
    manipulation.setCanScale(false)
    manipulation.onManipulationStart.add(() => (this.grabbed = true))
    manipulation.onManipulationEnd.add(() => {
      this.grabbed = false
      this.releasedAt = getTime()
    })
    return o
  }

  private update(): void {
    if (!this.ball || this.grabbed) return
    // Float back home softly ~0.6 s after release.
    if (getTime() - this.releasedAt < 0.6) return
    const t = this.ball.getTransform()
    const k = 1 - Math.exp(-4 * getDeltaTime())
    t.setLocalPosition(vec3.lerp(t.getLocalPosition(), this.homeLocal, k))
  }
}

function sphereMesh(radius: number, segments: number, rings: number): RenderMesh {
  const builder = new MeshBuilder([
    {name: "position", components: 3},
    {name: "normal", components: 3, normalized: true},
    {name: "texture0", components: 2},
  ])
  builder.topology = MeshTopology.Triangles
  builder.indexType = MeshIndexType.UInt16
  const verts: number[] = []
  const indices: number[] = []
  for (let r = 0; r <= rings; r++) {
    const v = r / rings
    const phi = v * Math.PI
    for (let s = 0; s <= segments; s++) {
      const u = s / segments
      const theta = u * Math.PI * 2
      const x = Math.sin(phi) * Math.cos(theta)
      const y = Math.cos(phi)
      const z = Math.sin(phi) * Math.sin(theta)
      verts.push(x * radius, y * radius, z * radius, x, y, z, u, v)
    }
  }
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const a = r * (segments + 1) + s
      const b = a + segments + 1
      indices.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  builder.appendVerticesInterleaved(verts)
  builder.appendIndices(indices)
  builder.updateMesh()
  return builder.getMesh()
}
