import {MeshUtils} from "Utilities.lspkg/Scripts/Utils/MeshUtils"
import {ACCENT_COLOR, createChild, GREEN_COLOR, WARM_COLOR} from "./DemoText"

/**
 * Utilities demo 2: MeshUtils builds a filled circle and a line strip with round joints at
 * runtime and shows them with addRenderMeshVisual.
 */
@component
export class MeshShapesDemo extends BaseScriptComponent {
  @input
  @hint("Unlit material the generated meshes are drawn with (cloned per shape)")
  material: Material

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.build())
  }

  private build(): void {
    const circle = createChild(this.sceneObject, "Circle", new vec3(-13, 3, 0))
    MeshUtils.addRenderMeshVisual(circle, MeshUtils.makeCircle2DMesh(vec3.zero(), 6), this.tinted(ACCENT_COLOR), 0)

    const points = [new vec3(-9, -4, 0), new vec3(-3, 6, 0), new vec3(3, -4, 0), new vec3(9, 6, 0)]
    const line = createChild(this.sceneObject, "LineStrip", new vec3(8, 2, 0))
    MeshUtils.addRenderMeshVisual(line, MeshUtils.makeLineStrip2DMeshWithJoints(points, 2), this.tinted(WARM_COLOR), 0)

    // A second strip with a sharp turn: every joint must be a full round cap.
    const hook = [new vec3(-6, 0, 0), new vec3(0, 0, 0), new vec3(0, -4, 0), new vec3(6, -4, 0)]
    const hookObject = createChild(this.sceneObject, "Hook", new vec3(8, -9, 0))
    MeshUtils.addRenderMeshVisual(hookObject, MeshUtils.makeLineStrip2DMeshWithJoints(hook, 1.5), this.tinted(GREEN_COLOR), 0)
  }

  private tinted(color: vec4): Material {
    const material = this.material.clone()
    material.mainPass.baseColor = color
    return material
  }
}
