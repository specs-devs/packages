/**
 * Specs Inc. 2026
 * Example demonstrating yoyo tween animation with customizable parameters. Shows how to create
 * back-and-forth animations that automatically reverse direction with configurable movement,
 * rotation, and scale. Perfect for creating oscillating, bouncing, or breathing effects.
 */
import Easing from "../../TweenJS/Easing";
import { LSTween } from "../../LSTween";
import { RotationInterpolationType } from "../../RotationInterpolationType";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent } from "SnapDecorators.lspkg/decorators";

@component
export class Example_YoyoTween extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Target Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Specify which object to animate (defaults to this object)</span>')

  @input
  @allowUndefined
  @hint("(Optional) Target object to animate. Leave empty to animate this object.")
  targetObject: SceneObject;

  @input
  @hint("Play animation automatically on start")
  autoPlay: boolean = true;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Animation Type</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Choose what property to animate with yoyo effect</span>')

  @input('int')
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem('Position (Movement)', 0),
      new ComboBoxItem('Rotation (Spinning)', 1),
      new ComboBoxItem('Scale (Breathing)', 2),
      new ComboBoxItem('Position + Rotation', 3),
      new ComboBoxItem('Position + Scale', 4),
      new ComboBoxItem('All Three', 5)
    ])
  )
  animationType: number = 0; // Position

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Position Animation</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure movement back-and-forth (used for Position, Position+Rotation, Position+Scale, All)</span>')

  @input
  @hint("Movement offset (how far to move)")
  movementOffset: vec3 = new vec3(50, 0, 0);

  @input
  @hint("Duration for one direction in milliseconds")
  @widget(new SliderWidget(100, 5000, 100))
  movementDuration: number = 1500;

  @input('int')
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem('Linear', 0),
      new ComboBoxItem('Cubic InOut', 1),
      new ComboBoxItem('Sinusoidal InOut', 2),
      new ComboBoxItem('Elastic InOut', 3),
      new ComboBoxItem('Bounce InOut', 4),
      new ComboBoxItem('Back InOut', 5)
    ])
  )
  movementEasing: number = 1; // Cubic InOut

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Rotation Animation</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure spinning back-and-forth (used for Rotation, Position+Rotation, All)</span>')

  @input
  @hint("Rotation angle in degrees (will rotate this amount then back)")
  @widget(new SliderWidget(-360, 360, 15))
  rotationAngle: number = 90;

  @input('int')
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem('Up (Y-Axis)', 0),
      new ComboBoxItem('Right (X-Axis)', 1),
      new ComboBoxItem('Forward (Z-Axis)', 2)
    ])
  )
  rotationAxis: number = 0; // Up

  @input
  @hint("Duration for one direction in milliseconds")
  @widget(new SliderWidget(100, 5000, 100))
  rotationDuration: number = 1500;

  @input('int')
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem('Linear', 0),
      new ComboBoxItem('Cubic InOut', 1),
      new ComboBoxItem('Sinusoidal InOut', 2),
      new ComboBoxItem('Elastic InOut', 3),
      new ComboBoxItem('Bounce InOut', 4),
      new ComboBoxItem('Back InOut', 5)
    ])
  )
  rotationEasing: number = 1; // Cubic InOut

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Scale Animation</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure breathing/pulsing back-and-forth (used for Scale, Position+Scale, All)</span>')

  @input
  @hint("Target scale multiplier (1.0 = original, 2.0 = double)")
  @widget(new SliderWidget(0.1, 5.0, 0.1))
  scaleMultiplier: number = 1.5;

  @input
  @hint("Duration for one direction in milliseconds")
  @widget(new SliderWidget(100, 5000, 100))
  scaleDuration: number = 1500;

  @input('int')
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem('Linear', 0),
      new ComboBoxItem('Cubic InOut', 1),
      new ComboBoxItem('Sinusoidal InOut', 2),
      new ComboBoxItem('Elastic InOut', 3),
      new ComboBoxItem('Bounce InOut', 4),
      new ComboBoxItem('Back InOut', 5)
    ])
  )
  scaleEasing: number = 2; // Sinusoidal InOut

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Yoyo Behavior</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure repeat and timing behavior</span>')

  @input
  @hint("Number of yoyo cycles (-1 = infinite)")
  @widget(new SliderWidget(-1, 20, 1))
  repeatCount: number = -1; // Infinite

  @input
  @hint("Delay before starting in milliseconds (fixes TweenJS yoyo jump bug)")
  @widget(new SliderWidget(0, 1000, 50))
  initialDelay: number = 100;

  @input
  @hint("Delay between yoyo cycles in milliseconds")
  @widget(new SliderWidget(0, 2000, 100))
  repeatDelay: number = 0;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug Output</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Enable console logging for yoyo events</span>')

  @input
  @hint("Print when yoyo direction changes")
  logYoyoEvents: boolean = true;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

  @input
  @hint("Enable general logging (operations, events, etc.)")
  enableLogging: boolean = false;

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
  enableLoggingLifecycle: boolean = false;

  private logger: Logger;
  private currentTweens: any[] = [];
  private targetTransform: Transform;
  private initialPosition: vec3;
  private initialRotation: quat;
  private initialScale: vec3;

  /**
   * Called when component is initialized
   */
  onAwake(): void {
    // Initialize logger
    this.logger = new Logger("Example_YoyoTween", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }

    // Get target transform (use this object if no target specified)
    const target = this.targetObject || this.getSceneObject();
    this.targetTransform = target.getTransform();

    // Store initial values
    this.initialPosition = this.targetTransform.getLocalPosition();
    this.initialRotation = this.targetTransform.getLocalRotation();
    this.initialScale = this.targetTransform.getLocalScale();
  }

  @bindStartEvent
  onStart(): void {
    if (this.autoPlay) {
      this.playYoyo();
    }
  }

  /**
   * Get the selected easing function
   */
  private getEasing(easingType: number): any {
    switch (easingType) {
      case 0: return Easing.Linear.None;
      case 1: return Easing.Cubic.InOut;
      case 2: return Easing.Sinusoidal.InOut;
      case 3: return Easing.Elastic.InOut;
      case 4: return Easing.Bounce.InOut;
      case 5: return Easing.Back.InOut;
      default: return Easing.Linear.None;
    }
  }

  /**
   * Get rotation axis vector
   */
  private getRotationAxisVector(): vec3 {
    switch (this.rotationAxis) {
      case 0: return vec3.up();
      case 1: return vec3.right();
      case 2: return vec3.forward();
      default: return vec3.up();
    }
  }

  /**
   * Play the yoyo animation with current settings
   * Can be called from buttons or other scripts
   */
  public playYoyo(): void {
    // Stop any existing tweens
    this.stopYoyo();

    const repeat = this.repeatCount === -1 ? Infinity : this.repeatCount;

    // Create tweens based on animation type
    switch (this.animationType) {
      case 0: // Position only
        this.createPositionYoyo(repeat);
        break;
      case 1: // Rotation only
        this.createRotationYoyo(repeat);
        break;
      case 2: // Scale only
        this.createScaleYoyo(repeat);
        break;
      case 3: // Position + Rotation
        this.createPositionYoyo(repeat);
        this.createRotationYoyo(repeat);
        break;
      case 4: // Position + Scale
        this.createPositionYoyo(repeat);
        this.createScaleYoyo(repeat);
        break;
      case 5: // All three
        this.createPositionYoyo(repeat);
        this.createRotationYoyo(repeat);
        this.createScaleYoyo(repeat);
        break;
    }

    if (this.logYoyoEvents) {
      const types = ['Position', 'Rotation', 'Scale', 'Position+Rotation', 'Position+Scale', 'All'];
      this.logger.debug(`[YoyoTween] ====== YOYO STARTED ======`);
      this.logger.debug(`[YoyoTween] Type: ${types[this.animationType]}`);
      this.logger.debug(`[YoyoTween] Repeat: ${this.repeatCount === -1 ? 'Infinite' : this.repeatCount}`);
    }

    if (this.enableLogging) {
      this.logger.info(`Yoyo animation started: type=${this.animationType}, repeat=${this.repeatCount}`);
    }
  }

  /**
   * Create position yoyo tween
   */
  private createPositionYoyo(repeat: number): void {
    const startPos = this.initialPosition;
    const endPos = startPos.add(this.movementOffset);

    const tween = LSTween.moveFromToLocal(
      this.targetTransform,
      startPos,
      endPos,
      this.movementDuration
    )
    .easing(this.getEasing(this.movementEasing))
    .delay(this.initialDelay)
    .yoyo(true)
    .repeat(repeat);

    if (this.repeatDelay > 0) {
      tween.repeatDelay(this.repeatDelay);
    }

    if (this.logYoyoEvents) {
      tween.onRepeat(() => {
        this.logger.debug(`[YoyoTween] Position yoyo direction changed`);
      });
    }

    tween.start();
    this.currentTweens.push(tween);
  }

  /**
   * Create rotation yoyo tween
   */
  private createRotationYoyo(repeat: number): void {
    const axis = this.getRotationAxisVector();
    const rotation = quat.angleAxis(MathUtils.DegToRad * this.rotationAngle, axis);

    const tween = LSTween.rotateOffset(
      this.targetTransform,
      rotation,
      this.rotationDuration,
      RotationInterpolationType.LERP
    )
    .easing(this.getEasing(this.rotationEasing))
    .delay(this.initialDelay)
    .yoyo(true)
    .repeat(repeat);

    if (this.repeatDelay > 0) {
      tween.repeatDelay(this.repeatDelay);
    }

    if (this.logYoyoEvents) {
      tween.onRepeat(() => {
        this.logger.debug(`[YoyoTween] Rotation yoyo direction changed`);
      });
    }

    tween.start();
    this.currentTweens.push(tween);
  }

  /**
   * Create scale yoyo tween
   */
  private createScaleYoyo(repeat: number): void {
    const scaleOffset = this.initialScale.uniformScale(this.scaleMultiplier - 1);

    const tween = LSTween.scaleOffset(
      this.targetTransform,
      scaleOffset,
      this.scaleDuration
    )
    .easing(this.getEasing(this.scaleEasing))
    .delay(this.initialDelay)
    .yoyo(true)
    .repeat(repeat);

    if (this.repeatDelay > 0) {
      tween.repeatDelay(this.repeatDelay);
    }

    if (this.logYoyoEvents) {
      tween.onRepeat(() => {
        this.logger.debug(`[YoyoTween] Scale yoyo direction changed`);
      });
    }

    tween.start();
    this.currentTweens.push(tween);
  }

  /**
   * Stop all yoyo animations
   * Can be called from buttons or other scripts
   */
  public stopYoyo(): void {
    for (const tween of this.currentTweens) {
      if (tween) {
        tween.stop();
      }
    }
    this.currentTweens = [];

    if (this.enableLogging) {
      this.logger.info("Yoyo animation stopped");
    }

    if (this.logYoyoEvents) {
      this.logger.debug("[YoyoTween] Yoyo stopped by user");
    }
  }

  /**
   * Restart the yoyo from the beginning
   * Can be called from buttons or other scripts
   */
  public restartYoyo(): void {
    // Reset to initial state
    this.targetTransform.setLocalPosition(this.initialPosition);
    this.targetTransform.setLocalRotation(this.initialRotation);
    this.targetTransform.setLocalScale(this.initialScale);

    this.stopYoyo();
    this.playYoyo();
  }
}
