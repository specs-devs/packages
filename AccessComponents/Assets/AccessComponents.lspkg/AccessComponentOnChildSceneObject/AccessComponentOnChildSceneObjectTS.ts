/**
 * Specs Inc. 2026
 * Demonstrates how to access components on child scene objects. This script shows how to navigate
 * the scene hierarchy to find and access components on child objects of a parent scene object.
 */
@component
export class AccessComponentOnChildSceneObjectTS extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Scene Object Reference</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Reference to the parent scene object whose child components you want to access</span>')

  @input
  @allowUndefined
  @hint("The parent component")
  parentSceneobject: SceneObject;

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

    if (
      this.parentSceneobject !== null &&
      this.parentSceneobject.getChild(0) !== null
    ) {
      this.debug && print("Parent scene object is not null");
      this.debug &&
        print("Parent scene object name: " + this.parentSceneobject.name);
      this.debug &&
        print(
          "Parent child object name: " + this.parentSceneobject.getChild(0).name
        );
    }

    if (
      this.parentSceneobject
        .getChild(0)
        .getComponent("Component.RenderMeshVisual")
        .getTypeName()
    ) {
      this.debug &&
        print("Parent child object has a RenderMeshVisual component");
    } else {
      this.debug &&
        print("Parent child object does not have a RenderMeshVisual component");
    }
  }
}
