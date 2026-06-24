/**
 * Specs Inc. 2026
 * Non-transform animation: drive the Frame's `innerSize` (vec2) directly.
 * Unlike the other examples that animate the SceneObject's Transform (which
 * cascades to children), this one resizes the Frame container itself in place.
 *
 * Animation timeline over one clip (loop for continuous demo):
 *   t = 0.00 → base (W, H)
 *   t = 0.25 → height peak  (W,        H + h_expand)
 *   t = 0.50 → base again
 *   t = 0.75 → width peak   (W + w_expand, H)
 *   t = 1.00 → base
 *
 * Frame.innerSize expands symmetrically around the Frame's pivot, so growing
 * height visibly extends both top and bottom (and similarly for width).
 *
 * Like OpacityCallbackExample, animation start is deferred to OnStartEvent
 * because `frame.innerSize` is only safe to write after Frame.initialize()
 * has run.
 */

// Preload ThemeService before any UIKit visual to break a circular-import init-order
// crash in the package (Visual.ts imports ThemeService before defining COLORS, and the
// theme chain reads COLORS at module-load). Loading ThemeService first lets Visual.ts
// finish initializing COLORS before the visual chain reads it.
import "SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService";
import { Frame } from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame";
import { buildFrameUI, playFirstClip } from "./Helpers/AnimationHelpers";

@component
export class FrameSizingExample extends BaseScriptComponent {

    @ui.label('<span style="color: #F59E0B;">Setup required: AnimationPlayer + Frame</span>')
    @ui.label('<span style="color: #F59E0B; font-size: 11px;">1. Add an AnimationPlayer component on this SceneObject.</span>')
    @ui.label('<span style="color: #F59E0B; font-size: 11px;">2. Add one Clip and configure Name / Playback Mode (Loop recommended) / Speed / Weight / Range.</span>')
    @ui.label('<span style="color: #F59E0B; font-size: 11px;">3. Leave the Clip\'s Animation Asset empty to use this script\'s runtime curve.</span>')
    @ui.label('<span style="color: #F59E0B; font-size: 11px;">4. Add a SpectaclesUIKit Frame ScriptComponent — its innerSize is what this example animates.</span>')

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Base Frame Dimensions</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">The resting Frame size in centimeters. Should match the Frame ScriptComponent\'s Inner Size.</span>')

    @input("vec2", "{7.5, 7.5}")
    baseSize: vec2 = new vec2(7.5, 7.5);

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Expansion Amounts</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">How much to grow each axis at peak. Expansion is symmetric — both sides grow equally.</span>')

    @input
    @hint("How much the height grows at its peak (centimeters).")
    @widget(new SliderWidget(0, 10, 0.1))
    heightExpansion: number = 4;

    @input
    @hint("How much the width grows at its peak (centimeters).")
    @widget(new SliderWidget(0, 10, 0.1))
    widthExpansion: number = 4;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

    @input
    @hint("Enable general logging (animation cycles, events, etc.)")
    enableLogging: boolean = false;

    @input
    @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
    enableLoggingLifecycle: boolean = false;

    private frame: Frame | null = null;

    /**
     * Component awake — spawn the Frame's UI children, grab the Frame
     * component, and defer animation start to OnStartEvent so the Frame has
     * finished initialize() before innerSize writes begin.
     */
    onAwake() {
        if (this.enableLoggingLifecycle) print(`[${this.sceneObject.name}] FrameSizingExample.onAwake`);

        buildFrameUI(this.sceneObject, { title: "Frame Sizing", buttonText: "TAP" });
        this.frame = this.sceneObject.getComponent(Frame.getTypeName()) as Frame;

        this.createEvent("OnStartEvent").bind(() => {
            if (this.enableLoggingLifecycle) print(`[${this.sceneObject.name}] FrameSizingExample.OnStartEvent`);
            playFirstClip(this.sceneObject, this.buildAsset(), undefined, this.enableLogging);
        });
    }

    /**
     * Build a float "phase" track that ramps 0 → 1 over the clip, and a
     * callback that maps that phase to a Frame innerSize.
     *
     * @returns The runtime-built AnimationAsset
     */
    private buildAsset(): AnimationAsset {
        // Linear ramp 0..1 — the shaping happens inside the callback so phases are crisp.
        const phaseCurve = AnimationCurve.createEasingCurve(0, 1, 0, 0, 1, 1);
        const phaseTrack = AnimationPropertyTrack.createFloatFromCurves(phaseCurve);

        const layer = AnimationPropertyLayer.create();
        layer.setCustomProperty("framePhase", phaseTrack, (_name, value) => {
            this.applyPhase(value as number);
        });

        const asset = AnimationAsset.create();
        asset.addLayer(this.sceneObject.name, layer);
        return asset;
    }

    /**
     * Map a normalized phase value in [0, 1] to a Frame innerSize.
     *
     * Phase layout:
     *   [0.00, 0.50) — height pulse (grows then shrinks)
     *   [0.50, 1.00] — width pulse (grows then shrinks)
     *
     * Each pulse uses a triangle wave: rises to peak at the quarter mark, falls
     * back to base at the half mark. Smooth (cosine) easing inside applyPulse
     * gives it a nicer breathing feel.
     *
     * @param t - Normalized animation phase in [0, 1]
     */
    private applyPhase(t: number): void {
        if (!this.frame) return;

        let width = this.baseSize.x;
        let height = this.baseSize.y;

        if (t < 0.5) {
            // Height phase: 0..0.5 maps to a 0→1→0 pulse.
            const pulse = this.pulse((t - 0) / 0.5);
            height = this.baseSize.y + this.heightExpansion * pulse;
        } else {
            // Width phase: 0.5..1.0 maps to a 0→1→0 pulse.
            const pulse = this.pulse((t - 0.5) / 0.5);
            width = this.baseSize.x + this.widthExpansion * pulse;
        }

        this.frame.innerSize = new vec2(width, height);
    }

    /**
     * Smooth 0 → 1 → 0 pulse on input [0, 1]. Uses 0.5 - 0.5 * cos(2πx).
     *
     * @param x - Pulse phase in [0, 1]
     * @returns Pulse amplitude in [0, 1]
     */
    private pulse(x: number): number {
        return 0.5 - 0.5 * Math.cos(2 * Math.PI * x);
    }
}
