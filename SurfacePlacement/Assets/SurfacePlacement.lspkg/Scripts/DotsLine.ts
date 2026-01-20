@component
export class DotsLine extends BaseScriptComponent {
  @input lineEndObj: SceneObject;

  private lineStartTrans: Transform = null;
  private lineEndTrans: Transform = null;

  private rend = this.getSceneObject().getComponent(
    "Component.RenderMeshVisual"
  );

  onAwake() {
    this.lineStartTrans = this.getSceneObject().getTransform();
    this.lineEndTrans = this.lineEndObj.getTransform();
    this.createEvent("UpdateEvent").bind(this.onUpdate.bind(this));
  }

  onUpdate() {
    const distance = this.lineStartTrans
      .getWorldPosition()
      .distance(this.lineEndTrans.getWorldPosition());
    this.rend.mainPass.Length = MathUtils.remap(distance, 0, 150, 0, 25);
  }
}
