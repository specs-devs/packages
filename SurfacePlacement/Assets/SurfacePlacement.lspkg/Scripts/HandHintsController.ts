@component
export class HandHintsController extends BaseScriptComponent {
  @input mobileDeviceObject: SceneObject;

  private desiredScale: vec3 = vec3.zero();
  private trans: Transform = null;
  private anchorTrans: Transform = null;
  private animationPlayer: AnimationPlayer = null;

  onAwake() {
    this.animationPlayer =
      this.getSceneObject().getComponent("AnimationPlayer");
    this.resetPlayer();
    this.trans = this.getSceneObject().getTransform();
    this.createEvent("UpdateEvent").bind(this.onUpdate.bind(this));

    this.enableHint(this.getSceneObject().getParent().getTransform());
    this.playHandTouchSurface();
  }

  private onUpdate() {
    this.trans.setWorldScale(
      vec3.lerp(
        this.trans.getWorldScale(),
        this.desiredScale,
        getDeltaTime() * 6
      )
    );
    if (this.anchorTrans != null) {
      this.trans.setWorldPosition(this.anchorTrans.getWorldPosition());
      this.trans.setWorldRotation(this.anchorTrans.getWorldRotation());
      this.trans.setLocalScale(this.anchorTrans.getLocalScale());
    }
  }

  private resetPlayer() {
    this.mobileDeviceObject.enabled = false;
    for (let i = 0; i < this.animationPlayer.clips.length; i++) {
      this.animationPlayer.clips[i].disabled = true;
    }
  }

  enableHint(anchor: Transform) {
    this.desiredScale = vec3.one();
    this.anchorTrans = anchor;
  }

  disableHint() {
    this.desiredScale = vec3.zero();
    this.trans.setWorldScale(vec3.zero());
    this.anchorTrans = null;
  }

  playMobileTap() {
    this.resetPlayer();
    this.mobileDeviceObject.enabled = true;
    this.animationPlayer.getClip("Controller_Tap").disabled = false;
  }

  playFarPinch() {
    this.resetPlayer();
    this.animationPlayer.getClip("Pinch_Far").disabled = false;
  }

  playHandTouchSurface() {
    this.resetPlayer();
    this.animationPlayer.getClip("Palm_Touch_Near").disabled = false;
  }

  playFarDrag() {
    this.resetPlayer();
    this.animationPlayer.getClip("Pinch_Move_X").disabled = false;
  }
}
