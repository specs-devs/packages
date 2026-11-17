/**
 * SPECS Inc. 2027
 * Animates the placement circle in and out, and sets its loading fill and color.
 */
import animate, {
  CancelSet,
} from "InteractionKit.lspkg/Utils/animate";

const START_SIZE = 0;
const END_SIZE = 1;

@component
export class CircleAnimation extends BaseScriptComponent {
  private rend = this.getSceneObject().getComponent(
    "Component.RenderMeshVisual",
  );
  private completeCancel: CancelSet = new CancelSet();

  onAwake() {
    //animate() runs off a shared update that outlives this component, so a
    //detector stopped mid-animation must not leave it writing to the material
    this.createEvent("OnDestroyEvent").bind(() => this.cancelAnimations());
  }

  cancelAnimations() {
    this.completeCancel.cancel();
  }

  //amount is progress: 0 is an empty loader, 1 is a full one, matching the shader
  setLoadingAmount(amount: number) {
    this.rend.mainPass.InnerCircleMask = amount;
  }

  setCircleColor(color: vec4) {
    this.rend.mainPass.dotsColor = color;
  }

  reset() {
    this.rend.mainPass.Thickness = START_SIZE;
    //start empty rather than inheriting whatever the last run left on the material
    this.setLoadingAmount(0);
  }

  animateCircleOut(callback: () => void) {
    if (this.completeCancel) this.completeCancel.cancel();
    animate({
      easing: "ease-out-cubic",
      duration: 0.5,
      update: (t: number) => {
        this.rend.mainPass.Thickness = MathUtils.lerp(START_SIZE, END_SIZE, t);
      },
      ended: callback,
      cancelSet: this.completeCancel,
    });
  }

  animateCircleIn(callback: () => void) {
    if (this.completeCancel) this.completeCancel.cancel();
    animate({
      easing: "ease-in-cubic",
      duration: 0.5,
      update: (t: number) => {
        this.rend.mainPass.Thickness = MathUtils.lerp(END_SIZE, START_SIZE, t);
      },
      ended: callback,
      cancelSet: this.completeCancel,
    });
  }
}
