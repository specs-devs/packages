/**
 * Specs Inc. 2026
 * Demonstrates how to access components on a scene object. This script shows how to get references
 * to components attached to a specific scene object and check their types.
 */
@component
export class AccessComponentOnSceneObjectTS extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Scene Object Reference</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Reference to the scene object whose components you want to access</span>')

  @input
  @allowUndefined
  @hint("The object to access the component from")
  mySceneObject: SceneObject;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug Settings</span>')

  @input
  @allowUndefined
  @hint("Show logs in the console")
  debug: boolean;

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      this.onStart();
      this.debug && print("Start event triggered");
    });
  }

  onStart() {
    this.debug && print("onAwake");

    if (this.mySceneObject !== null) {
      this.debug && print("Scene object is not null");
      this.debug && print("Scene object name: " + this.mySceneObject.name);
    }

    if (
      this.mySceneObject
        .getComponent("Component.RenderMeshVisual")
        .getTypeName()
    ) {
      this.debug && print("Scene object has a RenderMeshVisual component");
    } else {
      this.debug &&
        print("Scene object does not have a RenderMeshVisual component");
    }
  }
}
