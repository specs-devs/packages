import {ComponentUtils} from "Utilities.lspkg/Scripts/Utils/ComponentUtils"
import {Logger} from "Utilities.lspkg/Scripts/Utils/Logger"
import {SceneObjectUtils} from "Utilities.lspkg/Scripts/Utils/SceneObjectUtils"
import {ValidationUtils} from "Utilities.lspkg/Scripts/Utils/ValidationUtils"
import {createChild, createPanelText} from "./DemoText"

/**
 * Utilities demo 4: SceneObjectUtils and ComponentUtils run on a small rig built under this
 * object ("Rig" > "mixamorig:Hips" > "Spine"), and Logger writes the results to the Logger panel.
 */
@component
export class SceneComponentsDemo extends BaseScriptComponent {
  // Looked up by name with SceneObjectUtils.findScriptComponent.
  demoTag: string = "scene-components-demo"

  private log = new Logger("UtilitiesDemo")

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.build())
  }

  private build(): void {
    const rig = createChild(this.sceneObject, "Rig", vec3.zero())
    const hips = createChild(rig, "mixamorig:Hips", vec3.zero())
    const spine = createChild(hips, "Spine", vec3.zero())

    let visited = 0
    SceneObjectUtils.forEachSceneObjectInSubHierarchy(rig, () => visited++)
    const found = SceneObjectUtils.findSceneObjectByNameVariations(rig, "Hips")
    const root = SceneObjectUtils.getSceneRoot(spine)
    const camera = ComponentUtils.getRootCamera()
    const script = ComponentUtils.findInParents<ScriptComponent>(spine, "Component.ScriptComponent")
    const tagged = SceneObjectUtils.findScriptComponent(this.sceneObject, "demoTag")
    const first = SceneObjectUtils.getOrCreateComponent<Text>(spine, "Component.Text")
    const second = SceneObjectUtils.getOrCreateComponent<Text>(spine, "Component.Text")
    const scripts = ComponentUtils.getAllComponents(this.sceneObject, "Component.ScriptComponent").length
    const byTypeName = SceneObjectUtils.findComponentInHierarchy(this.sceneObject, String(SceneComponentsDemo.getTypeName()))
    const byClassName = SceneObjectUtils.findComponentInHierarchy(this.sceneObject, "SceneComponentsDemo")
    const cameraName = ValidationUtils.ifExists(camera, (c) => c.name) ?? "none"

    const lines = [
      "SceneObjectUtils",
      `  forEachSceneObjectInSubHierarchy(Rig) visited ${visited} objects`,
      `  findSceneObjectByNameVariations(Rig, "Hips") → "${found ? found.name : "null"}"`,
      `  getSceneRoot(Spine) → "${root.name}"`,
      `  findScriptComponent(this, "demoTag") → ${tagged === (this as ScriptComponent) ? "this demo" : "null"}`,
      `  getOrCreateComponent(Spine, Text) twice → same component: ${first === second}`,
      `  findComponentInHierarchy(this, getTypeName()) → ${byTypeName ? "found" : "null"}, ("SceneComponentsDemo") → ${byClassName ? "found" : "null"}`,
      "ComponentUtils",
      `  getRootCamera() → "${cameraName}"`,
      `  findInParents(Spine, ScriptComponent) → on "${script ? script.getSceneObject().name : "null"}"`,
      `  getAllComponents(this, ScriptComponent) → ${scripts}`,
    ]
    first.enabled = false

    const results = createPanelText(this.sceneObject, "Results", new vec3(0, 2, 0), 54, 44, 26)
    results.text = lines.join("\n")

    this.log.header("Utilities demo: scene and components")
    lines.forEach((line) => this.log.info(line.trim()))
    this.log.warn("A warning line")
    this.log.success("Logger writes one line per call: time | tag | level | message")
    this.log.setDebugEnabled(false)
    this.log.info("This line is not printed: setDebugEnabled(false) silences every level")
  }
}
