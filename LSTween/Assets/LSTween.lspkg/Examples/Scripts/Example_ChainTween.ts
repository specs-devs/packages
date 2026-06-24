/**
 * Specs Inc. 2026
 * Example demonstrating chained tween animations with customizable parameters. Shows how to
 * sequence multiple tweens where one animation starts automatically after the previous one
 * completes. Perfect for creating complex multi-step animations with rotation, scale, and movement.
 */
import Easing from "../../TweenJS/Easing";
import { LSTween } from "../../LSTween";
import { RotationInterpolationType } from "../../RotationInterpolationType";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent } from "SnapDecorators.lspkg/decorators";

@component
export class Example_ChainTween extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Target Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Specify which object to animate (defaults to this object)</span>')

  @input
  @allowUndefined
  @hint("(Optional) Target object to animate. Leave empty to animate this object.")
  targetObject: SceneObject;

  @input
  @hint("Play chain automatically on start")
  autoPlay: boolean = true;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Rotation Tween Settings</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">First animation in chain - rotates the object</span>')

  @input
  @hint("Rotation angle in degrees")
  @widget(new SliderWidget(-360, 360, 15))
  rotationAngle: number = 45;

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
  @hint("Duration of rotation in milliseconds")
  @widget(new SliderWidget(100, 5000, 100))
  rotationDuration: number = 1000;

  @input('int')
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem('LERP (Spherical)', 0),
      new ComboBoxItem('SLERP (Linear)', 1)
    ])
  )
  rotationInterpolation: number = 0; // LERP

  @input('int')
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem('Linear', 0),
      new ComboBoxItem('Cubic In', 1),
      new ComboBoxItem('Cubic Out', 2),
      new ComboBoxItem('Cubic InOut', 3),
      new ComboBoxItem('Elastic Out', 4),
      new ComboBoxItem('Bounce Out', 5),
      new ComboBoxItem('Back InOut', 6)
    ])
  )
  rotationEasing: number = 3; // Cubic InOut

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Scale Tween Settings</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Second animation in chain - scales the object</span>')

  @input
  @hint("Scale multiplier (1.0 = no change, 2.0 = double size)")
  @widget(new SliderWidget(0.1, 5.0, 0.1))
  scaleMultiplier: number = 2.0;

  @input
  @hint("Duration of scaling in milliseconds")
  @widget(new SliderWidget(100, 5000, 100))
  scaleDuration: number = 1000;

  @input('int')
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem('Linear', 0),
      new ComboBoxItem('Cubic In', 1),
      new ComboBoxItem('Cubic Out', 2),
      new ComboBoxItem('Cubic InOut', 3),
      new ComboBoxItem('Elastic Out', 4),
      new ComboBoxItem('Bounce Out', 5),
      new ComboBoxItem('Back InOut', 6)
    ])
  )
  scaleEasing: number = 4; // Elastic Out

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Movement Tween Settings</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Third animation in chain - moves the object (optional)</span>')

  @input
  @hint("Enable movement animation in the chain")
  enableMovement: boolean = false;

  @input
  @showIf("enableMovement", true)
  @hint("Movement offset in local space")
  movementOffset: vec3 = new vec3(0, 20, 0);

  @input
  @showIf("enableMovement", true)
  @hint("Duration of movement in milliseconds")
  @widget(new SliderWidget(100, 5000, 100))
  movementDuration: number = 1000;

  @input('int')
  @showIf("enableMovement", true)
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem('Linear', 0),
      new ComboBoxItem('Cubic In', 1),
      new ComboBoxItem('Cubic Out', 2),
      new ComboBoxItem('Cubic InOut', 3),
      new ComboBoxItem('Elastic Out', 4),
      new ComboBoxItem('Bounce Out', 5),
      new ComboBoxItem('Back InOut', 6)
    ])
  )
  movementEasing: number = 2; // Cubic Out

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Chain Behavior</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control how the chain loops and behaves</span>')

  @input
  @hint("Create infinite loop (chain back to first tween)")
  loopChain: boolean = true;

  @input
  @hint("Reset scale to original at start of each rotation")
  resetScaleOnLoop: boolean = true;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug Output</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Enable console logging for chain events</span>')

  @input
  @hint("Print when each tween in the chain starts")
  logChainEvents: boolean = true;

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
  private rotateTween: any = null;
  private scaleTween: any = null;
  private moveTween: any = null;
  private targetTransform: Transform;
  private initialScale: vec3;
  private initialPosition: vec3;

  /**
   * Called when component is initialized
   */
  onAwake(): void {
    // Initialize logger
    this.logger = new Logger("Example_ChainTween", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }

    // Get target transform (use this object if no target specified)
    const target = this.targetObject || this.getSceneObject();
    this.targetTransform = target.getTransform();

    // Store initial values
    this.initialScale = this.targetTransform.getLocalScale();
    this.initialPosition = this.targetTransform.getLocalPosition();
  }

  @bindStartEvent
  onStart(): void {
    if (this.autoPlay) {
      this.playChain();
    }
  }

  /**
   * Get the selected easing function
   */
  private getEasing(easingType: number): any {
    switch (easingType) {
      case 0: return Easing.Linear.None;
      case 1: return Easing.Cubic.In;
      case 2: return Easing.Cubic.Out;
      case 3: return Easing.Cubic.InOut;
      case 4: return Easing.Elastic.Out;
      case 5: return Easing.Bounce.Out;
      case 6: return Easing.Back.InOut;
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
   * Play the tween chain with current settings
   * Can be called from buttons or other scripts
   */
  public playChain(): void {
    // Stop any existing tweens
    this.stopChain();

    const axis = this.getRotationAxisVector();
    const rotation = quat.angleAxis(MathUtils.DegToRad * this.rotationAngle, axis);
    const interpType = this.rotationInterpolation === 0
      ? RotationInterpolationType.LERP
      : RotationInterpolationType.SLERP;

    // Create rotation tween
    this.rotateTween = LSTween.rotateOffset(
      this.targetTransform,
      rotation,
      this.rotationDuration,
      interpType
    )
    .easing(this.getEasing(this.rotationEasing))
    .onEveryStart((o) => {
      if (this.resetScaleOnLoop) {
        this.targetTransform.setLocalScale(this.initialScale);
      }
      if (this.logChainEvents) {
        this.logger.debug(`[ChainTween] Rotation started - ${this.rotationAngle}° around ${['Y', 'X', 'Z'][this.rotationAxis]} axis`);
      }
    });

    // Create scale tween
    this.scaleTween = LSTween.scaleOffset(
      this.targetTransform,
      vec3.one().uniformScale(this.scaleMultiplier),
      this.scaleDuration
    )
    .easing(this.getEasing(this.scaleEasing))
    .onStart((o) => {
      if (this.logChainEvents) {
        this.logger.debug(`[ChainTween] Scale started - multiplier: ${this.scaleMultiplier}x`);
      }
    });

    // Chain rotation to scale
    this.rotateTween.chain(this.scaleTween);

    // Create and chain movement tween if enabled
    if (this.enableMovement) {
      this.moveTween = LSTween.moveOffset(
        this.targetTransform,
        this.movementOffset,
        this.movementDuration
      )
      .easing(this.getEasing(this.movementEasing))
      .onStart((o) => {
        if (this.logChainEvents) {
          this.logger.debug(`[ChainTween] Movement started - offset: (${this.movementOffset.x}, ${this.movementOffset.y}, ${this.movementOffset.z})`);
        }
      })
      .onComplete((o) => {
        // Reset position after movement
        this.targetTransform.setLocalPosition(this.initialPosition);
      });

      // Chain scale to movement
      this.scaleTween.chain(this.moveTween);

      // If looping, chain movement back to rotation
      if (this.loopChain) {
        this.moveTween.chain(this.rotateTween);
      }
    } else {
      // If no movement, chain scale back to rotation for loop
      if (this.loopChain) {
        this.scaleTween.chain(this.rotateTween);
      }
    }

    // Start the chain
    this.rotateTween.start();

    if (this.enableLogging) {
      const chain = this.enableMovement ? "Rotation → Scale → Movement" : "Rotation → Scale";
      this.logger.info(`Chain started: ${chain} (loop: ${this.loopChain})`);
    }

    if (this.logChainEvents) {
      this.logger.debug(`[ChainTween] ====== CHAIN STARTED ======`);
      this.logger.debug(`[ChainTween] Sequence: Rotation (${this.rotationDuration}ms) → Scale (${this.scaleDuration}ms)${this.enableMovement ? ` → Movement (${this.movementDuration}ms)` : ''}`);
      this.logger.debug(`[ChainTween] Loop enabled: ${this.loopChain}`);
    }
  }

  /**
   * Stop all tweens in the chain
   * Can be called from buttons or other scripts
   */
  public stopChain(): void {
    if (this.rotateTween) {
      this.rotateTween.stop();
      this.rotateTween = null;
    }
    if (this.scaleTween) {
      this.scaleTween.stop();
      this.scaleTween = null;
    }
    if (this.moveTween) {
      this.moveTween.stop();
      this.moveTween = null;
    }

    if (this.enableLogging) {
      this.logger.info("Chain stopped");
    }

    if (this.logChainEvents) {
      this.logger.debug("[ChainTween] Chain stopped by user");
    }
  }

  /**
   * Restart the chain from the beginning
   * Can be called from buttons or other scripts
   */
  public restartChain(): void {
    // Reset to initial state
    this.targetTransform.setLocalScale(this.initialScale);
    this.targetTransform.setLocalPosition(this.initialPosition);

    this.stopChain();
    this.playChain();
  }
}
