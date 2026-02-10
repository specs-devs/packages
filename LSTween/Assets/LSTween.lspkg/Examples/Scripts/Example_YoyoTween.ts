/**
 * Specs Inc. 2026
 * Example demonstrating yoyo tween animation. Shows how to create back-and-forth animations
 * that automatically reverse direction and repeat infinitely with easing curves.
 */
import Easing from "../../TweenJS/Easing";
import { LSTween } from "./LSTween";

@component
export class Example_YoyoTween extends BaseScriptComponent {
  onAwake() {
    const transform = this.getTransform();
    const startPosition = transform.getLocalPosition();
    const destinationPosition = startPosition.add(new vec3(50, 0, 0));
    LSTween.moveFromToLocal(
      this.getTransform(),
      startPosition,
      destinationPosition,
      1500
    )
      .easing(Easing.Cubic.InOut)
      .delay(100) // There is a bug in TweenJS where the yoyo value will jump if no delay is set.
      .yoyo(true)
      .repeat(Infinity)
      .start();
  }
}
