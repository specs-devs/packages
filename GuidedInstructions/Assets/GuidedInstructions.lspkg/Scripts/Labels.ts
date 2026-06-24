/**
 * Specs Inc. 2026
 * Labels component for the Depth Cache Spectacles lens.
 */
// Preload ThemeService before any UIKit visual to break a circular-import init-order
// crash in the package (Visual.ts imports ThemeService before defining the Visual class +
// COLORS, and the theme chain reads them at module-load). Loading ThemeService first lets
// Visual.ts finish before any UIKit component (incl. scene-authored buttons) loads.
import "SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService";
import {Logger} from "Utilities.lspkg/Scripts/Utils/Logger"

@component
export class Labels extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Labels – instantiates world-space text labels</span><br/><span style="color: #94A3B8; font-size: 11px;">Parses JSON label data and places prefab labels in world space.</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @input
  @hint("Prefab instantiated for each label in the scene")
  labelPrefab: ObjectPrefab

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging</span>')
  @input
  @hint("Enable general logging")
  enableLogging: boolean = false

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy)")
  enableLoggingLifecycle: boolean = false

  private logger: Logger

  onAwake() {
    this.logger = new Logger("Labels", this.enableLogging || this.enableLoggingLifecycle, true)
    if (this.enableLoggingLifecycle) this.logger.debug("LIFECYCLE: onAwake()")
  }

  loadLables(pointCloud: any, labelString: any) {
    const labels = JSON.parse(labelString)
    for (let i = 0; i < labels.objects.length; i++) {
      const label = labels.objects[i]
      const labelLocalCamPos = new vec3(label.pos[0], label.pos[1], label.pos[2])
      const labelObj = this.labelPrefab.instantiate(this.getSceneObject())
      labelObj.getTransform().setWorldPosition(pointCloud.camLocalToWorld.multiplyPoint(labelLocalCamPos))
      const labelText = labelObj.getChild(0).getComponent("Component.Text")
      labelText.text = label.label
    }
  }
}
