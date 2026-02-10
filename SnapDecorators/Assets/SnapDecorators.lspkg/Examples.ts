/**
 * Specs Inc. 2026
 * Example script demonstrating all SnapDecorators functionality with lifecycle event decorators.
 * Shows @bindStartEvent, @bindEnableEvent, @bindDisableEvent, @bindUpdateEvent, @bindLateUpdateEvent,
 * and @bindDestroyEvent with frame counting, FPS tracking, and clean declarative event handling.
 */
import {
  bindStartEvent,
  bindDestroyEvent,
  bindEnableEvent,
  bindDisableEvent,
  bindUpdateEvent,
  bindLateUpdateEvent
} from "./decorators";

@component
export class ExampleScript extends BaseScriptComponent {
  private frameCount = 0;
  private startTime = 0;

  /**
   * Runs when the lens starts
   */
  @bindStartEvent
  onStart() {
    this.startTime = getTime();
    print("[START] @bindStartEvent triggered - Lens started at: " + this.startTime);
  }

  /**
   * Runs when the script component is enabled
   */
  @bindEnableEvent
  onEnabled() {
    print("[ENABLE] @bindEnableEvent triggered - Script enabled");
  }

  /**
   * Runs when the script component is disabled
   */
  @bindDisableEvent
  onDisabled() {
    print("[DISABLE] @bindDisableEvent triggered - Script disabled");
  }

  /**
   * Runs every frame
   */
  @bindUpdateEvent
  onUpdate() {
    this.frameCount++;

    // Log every 60 frames (~1 second at 60fps)
    if (this.frameCount % 60 === 0) {
      const elapsed = getTime() - this.startTime;
      const fps = this.frameCount / elapsed;
      print(`[UPDATE] @bindUpdateEvent - Frame: ${this.frameCount}, Elapsed: ${elapsed.toFixed(2)}s, FPS: ${fps.toFixed(1)}`);
    }
  }

  /**
   * Runs every frame after UpdateEvent
   */
  @bindLateUpdateEvent
  onLateUpdate() {
    // Log every 120 frames (~2 seconds at 60fps)
    if (this.frameCount % 120 === 0) {
      const elapsed = getTime() - this.startTime;
      print(`[LATE UPDATE] @bindLateUpdateEvent - Frame: ${this.frameCount}, Elapsed: ${elapsed.toFixed(2)}s`);
    }
  }

  /**
   * Runs when the script is destroyed
   */
  @bindDestroyEvent
  onDestroy() {
    const elapsed = getTime() - this.startTime;
    print("[DESTROY] @bindDestroyEvent triggered - Script destroyed");
    print("   Total frames rendered: " + this.frameCount);
    print("   Total time: " + elapsed.toFixed(2) + "s");
    print("   Average FPS: " + (this.frameCount / elapsed).toFixed(1));
  }

  /**
   * Traditional onAwake - setup tap event
   */
  onAwake() {
    print("[AWAKE] Traditional onAwake() - Setting up tap event");

    this.createEvent("TapEvent").bind(() => {
      const elapsed = getTime() - this.startTime;
      print("[TAP] Tapped! Elapsed time: " + elapsed.toFixed(2) + "s, Frame: " + this.frameCount);
    });
  }
}

/**
 * USAGE:
 *
 * 1. Add this script to any SceneObject in your scene
 * 2. Run the lens
 * 3. Open the Logger panel (View > Logger) to see decorator events
 * 4. Tap the screen to trigger the tap event
 * 5. Stop the lens to see the @bindDestroyEvent output
 *
 * WHAT YOU'LL SEE:
 *
 * On Start:
 *   [START] @bindStartEvent triggered
 *   [AWAKE] Traditional onAwake()
 *   [ENABLE] @bindEnableEvent triggered
 *
 * During Runtime:
 *   [UPDATE] @bindUpdateEvent - Every ~1 second
 *   [LATE UPDATE] @bindLateUpdateEvent - Every ~2 seconds
 *
 * On Tap:
 *   [TAP] Tapped! with current time and frame
 *
 * On Stop:
 *   [DESTROY] @bindDestroyEvent triggered with stats
 *
 * DECORATOR BENEFITS:
 *
 * Instead of writing:
 *   onAwake() {
 *     this.createEvent("OnStartEvent").bind(() => this.onStart());
 *     this.createEvent("UpdateEvent").bind(() => this.onUpdate());
 *     this.createEvent("OnDestroyEvent").bind(() => this.onDestroy());
 *   }
 *
 * Just write:
 *   @bindStartEvent onStart() { }
 *   @bindUpdateEvent onUpdate() { }
 *   @bindDestroyEvent onDestroy() { }
 *
 * Much cleaner and declarative!
 */
