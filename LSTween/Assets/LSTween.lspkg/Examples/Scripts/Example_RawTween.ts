/**
 * Specs Inc. 2026
 * Example demonstrating raw tween functionality with customizable parameters. Shows how to create
 * custom tweens with configurable easing, duration, delay, and lifecycle callbacks. Use this to
 * learn tween values (0-1) and experiment with different easing functions in real-time.
 */
import Easing from "../../TweenJS/Easing";
import { LSTween } from "../../LSTween";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent } from "SnapDecorators.lspkg/decorators";

@component
export class Example_RawTween extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Animation Settings</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure tween timing and behavior</span>')

  @input
  @hint("Duration of the tween in milliseconds (1000 = 1 second)")
  @widget(new SliderWidget(100, 5000, 100))
  duration: number = 1000;

  @input
  @hint("Delay before starting the tween in milliseconds")
  @widget(new SliderWidget(0, 2000, 100))
  delay: number = 0;

  @input
  @hint("Play tween automatically on start")
  autoPlay: boolean = true;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Easing Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Choose easing function for animation curve</span>')

  @input('int')
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem('Linear', 0),
      new ComboBoxItem('Quadratic In', 1),
      new ComboBoxItem('Quadratic Out', 2),
      new ComboBoxItem('Quadratic InOut', 3),
      new ComboBoxItem('Cubic In', 4),
      new ComboBoxItem('Cubic Out', 5),
      new ComboBoxItem('Cubic InOut', 6),
      new ComboBoxItem('Quartic In', 7),
      new ComboBoxItem('Quartic Out', 8),
      new ComboBoxItem('Quartic InOut', 9),
      new ComboBoxItem('Quintic In', 10),
      new ComboBoxItem('Quintic Out', 11),
      new ComboBoxItem('Quintic InOut', 12),
      new ComboBoxItem('Sinusoidal In', 13),
      new ComboBoxItem('Sinusoidal Out', 14),
      new ComboBoxItem('Sinusoidal InOut', 15),
      new ComboBoxItem('Exponential In', 16),
      new ComboBoxItem('Exponential Out', 17),
      new ComboBoxItem('Exponential InOut', 18),
      new ComboBoxItem('Circular In', 19),
      new ComboBoxItem('Circular Out', 20),
      new ComboBoxItem('Circular InOut', 21),
      new ComboBoxItem('Elastic In', 22),
      new ComboBoxItem('Elastic Out', 23),
      new ComboBoxItem('Elastic InOut', 24),
      new ComboBoxItem('Back In', 25),
      new ComboBoxItem('Back Out', 26),
      new ComboBoxItem('Back InOut', 27),
      new ComboBoxItem('Bounce In', 28),
      new ComboBoxItem('Bounce Out', 29),
      new ComboBoxItem('Bounce InOut', 30)
    ])
  )
  easingType: number = 4; // Cubic In

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Loop Settings</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure repeat and yoyo behavior</span>')

  @input
  @hint("Enable yoyo (back-and-forth) animation")
  enableYoyo: boolean = false;

  @input
  @hint("Number of times to repeat (-1 = infinite)")
  @widget(new SliderWidget(-1, 10, 1))
  repeatCount: number = 0;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Visual Feedback</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Optional target object to visualize tween value (0-1) as scale</span>')

  @input
  @allowUndefined
  @hint("(Optional) Object to scale based on tween value for visual feedback")
  targetObject: SceneObject;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug Output</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Enable console logging for tween lifecycle events</span>')

  @input
  @hint("Print tween start event to console")
  logStart: boolean = true;

  @input
  @hint("Print tween update events to console (verbose)")
  logUpdates: boolean = false;

  @input
  @hint("Print tween complete event to console")
  logComplete: boolean = true;

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
  private currentTween: any = null;

  /**
   * Called when component is initialized
   */
  onAwake(): void {
    // Initialize logger
    this.logger = new Logger("Example_RawTween", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }
  }

  @bindStartEvent
  onStart(): void {
    if (this.autoPlay) {
      this.playTween();
    }
  }

  /**
   * Get the selected easing function based on easingType
   */
  private getEasingFunction(): any {
    switch (this.easingType) {
      case 0: return Easing.Linear.None;
      case 1: return Easing.Quadratic.In;
      case 2: return Easing.Quadratic.Out;
      case 3: return Easing.Quadratic.InOut;
      case 4: return Easing.Cubic.In;
      case 5: return Easing.Cubic.Out;
      case 6: return Easing.Cubic.InOut;
      case 7: return Easing.Quartic.In;
      case 8: return Easing.Quartic.Out;
      case 9: return Easing.Quartic.InOut;
      case 10: return Easing.Quintic.In;
      case 11: return Easing.Quintic.Out;
      case 12: return Easing.Quintic.InOut;
      case 13: return Easing.Sinusoidal.In;
      case 14: return Easing.Sinusoidal.Out;
      case 15: return Easing.Sinusoidal.InOut;
      case 16: return Easing.Exponential.In;
      case 17: return Easing.Exponential.Out;
      case 18: return Easing.Exponential.InOut;
      case 19: return Easing.Circular.In;
      case 20: return Easing.Circular.Out;
      case 21: return Easing.Circular.InOut;
      case 22: return Easing.Elastic.In;
      case 23: return Easing.Elastic.Out;
      case 24: return Easing.Elastic.InOut;
      case 25: return Easing.Back.In;
      case 26: return Easing.Back.Out;
      case 27: return Easing.Back.InOut;
      case 28: return Easing.Bounce.In;
      case 29: return Easing.Bounce.Out;
      case 30: return Easing.Bounce.InOut;
      default: return Easing.Linear.None;
    }
  }

  /**
   * Play the tween with current settings
   * Can be called from buttons or other scripts
   */
  public playTween(): void {
    if (this.currentTween) {
      this.currentTween.stop();
    }

    const easing = this.getEasingFunction();

    this.currentTween = LSTween.rawTween(this.duration)
      .easing(easing)
      .delay(this.delay)
      .onStart((o) => {
        if (this.logStart) {
          this.logger.debug(`[RawTween] START - Value: ${o.t.toFixed(3)}`);
          if (this.enableLogging) {
            this.logger.info(`Tween started with duration=${this.duration}ms, delay=${this.delay}ms`);
          }
        }
      })
      .onUpdate((o) => {
        if (this.logUpdates) {
          this.logger.debug(`[RawTween] UPDATE - Value: ${o.t.toFixed(3)}`);
        }

        // Visual feedback: scale target object based on tween value
        if (this.targetObject) {
          const scale = 1 + (o.t * 2); // Scale from 1 to 3
          this.targetObject.getTransform().setLocalScale(new vec3(scale, scale, scale));
        }
      })
      .onComplete((o) => {
        if (this.logComplete) {
          this.logger.debug(`[RawTween] COMPLETE - Final Value: ${o.t.toFixed(3)}`);
          if (this.enableLogging) {
            this.logger.info("Tween completed");
          }
        }
      });

    // Apply loop settings
    if (this.enableYoyo) {
      this.currentTween.yoyo(true);
    }

    if (this.repeatCount !== 0) {
      const repeat = this.repeatCount === -1 ? Infinity : this.repeatCount;
      this.currentTween.repeat(repeat);
    }

    this.currentTween.start();

    if (this.enableLogging) {
      this.logger.info(`Tween started: duration=${this.duration}ms, easing=${this.easingType}, yoyo=${this.enableYoyo}, repeat=${this.repeatCount}`);
    }
  }

  /**
   * Stop the current tween
   * Can be called from buttons or other scripts
   */
  public stopTween(): void {
    if (this.currentTween) {
      this.currentTween.stop();
      if (this.enableLogging) {
        this.logger.info("Tween stopped");
      }
      this.logger.debug("[RawTween] Tween stopped by user");
    }
  }

  /**
   * Restart the tween from the beginning
   * Can be called from buttons or other scripts
   */
  public restartTween(): void {
    this.stopTween();
    this.playTween();
  }
}
