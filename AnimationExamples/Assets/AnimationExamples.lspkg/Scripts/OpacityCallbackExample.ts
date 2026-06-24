/**
 * Specs Inc. 2026
 * Fade the entire UIKit Frame stack (Frame + Button + Text labels) via
 * AnimationPropertyLayer.setCustomProperty. Demonstrates how to drive a value
 * through a callback every frame and apply it to multiple UI surfaces.
 *
 * Opacity propagation notes (verified against SpectaclesUIKit source):
 *   - Frame.opacity cascades to Button children via UIKit's internal handler.
 *   - Text components do NOT inherit — must write textFill.color.a manually.
 *   - Frame.opacity is only valid after the Frame's initialize() runs, so this
 *     example defers playFirstClip to OnStartEvent.
 */

// Preload ThemeService before any UIKit visual to break a circular-import init-order
// crash in the package (Visual.ts imports ThemeService before defining COLORS, and the
// theme chain reads COLORS at module-load). Loading ThemeService first lets Visual.ts
// finish initializing COLORS before the visual chain reads it.
import "SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService";
import { Frame } from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame";
import { buildFrameUI, FrameUI, playFirstClip } from "./Helpers/AnimationHelpers";

@component
export class OpacityCallbackExample extends BaseScriptComponent {

    @ui.label('<span style="color: #F59E0B;">Setup required: AnimationPlayer + Frame</span>')
    @ui.label('<span style="color: #F59E0B; font-size: 11px;">1. Add an AnimationPlayer component on this SceneObject.</span>')
    @ui.label('<span style="color: #F59E0B; font-size: 11px;">2. Add one Clip and configure Name / Playback Mode / Speed / Weight / Range.</span>')
    @ui.label('<span style="color: #F59E0B; font-size: 11px;">3. Leave the Clip\'s Animation Asset empty to use this script\'s runtime curve.</span>')
    @ui.label('<span style="color: #F59E0B; font-size: 11px;">4. Add a SpectaclesUIKit Frame ScriptComponent on this SceneObject — its opacity cascades to Button children automatically.</span>')

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Opacity Curve</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Start → end alpha (0..1) applied to the Frame and every Text in the stack each frame.</span>')

    @input
    @widget(new SliderWidget(0, 1, 0.01))
    startOpacity: number = 0.0;

    @input
    @widget(new SliderWidget(0, 1, 0.01))
    endOpacity: number = 1.0;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

    @input
    @hint("Enable general logging (animation cycles, events, etc.)")
    enableLogging: boolean = false;

    @input
    @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
    enableLoggingLifecycle: boolean = false;

    private ui: FrameUI | null = null;
    private frame: Frame | null = null;

    /**
     * Component awake — spawn the Frame's UI children, grab the Frame
     * component, and defer animation start to OnStartEvent so the Frame has
     * finished initialize() before opacity is written.
     */
    onAwake() {
        if (this.enableLoggingLifecycle) print(`[${this.sceneObject.name}] OpacityCallbackExample.onAwake`);

        this.ui = buildFrameUI(this.sceneObject, { title: "Opacity Callback", buttonText: "TAP" });
        this.frame = this.sceneObject.getComponent(Frame.getTypeName()) as Frame;

        this.createEvent("OnStartEvent").bind(() => {
            if (this.enableLoggingLifecycle) print(`[${this.sceneObject.name}] OpacityCallbackExample.OnStartEvent`);
            playFirstClip(this.sceneObject, this.buildAsset(), undefined, this.enableLogging);
        });
    }

    /**
     * Build a float track for the opacity value driven via setCustomProperty.
     *
     * @returns The runtime-built AnimationAsset
     */
    private buildAsset(): AnimationAsset {
        const opacityCurve = AnimationCurve.createEasingCurve(this.startOpacity, this.endOpacity, 0.42, 0, 0.58, 1);
        const opacityTrack = AnimationPropertyTrack.createFloatFromCurves(opacityCurve);

        const layer = AnimationPropertyLayer.create();
        layer.setCustomProperty("opacity", opacityTrack, (_name, value) => {
            this.applyOpacity(value as number);
        });

        const asset = AnimationAsset.create();
        asset.addLayer(this.sceneObject.name, layer);
        return asset;
    }

    /**
     * Apply an alpha value to every visible surface in the stack:
     *  - Frame.opacity (its own background)
     *  - Button.opacity directly (Frame's internal handler doesn't reliably
     *    cascade to children spawned at runtime, so set it ourselves)
     *  - Each Text's textFill.color.a (Text components don't inherit opacity)
     *
     * @param t - Alpha value in [0, 1]
     */
    private applyOpacity(t: number): void {
        if (this.frame) this.frame.opacity = t;
        if (this.ui) {
            this.ui.button.opacity = t;
            for (let i = 0; i < this.ui.allTexts.length; i++) {
                const text = this.ui.allTexts[i];
                const c = text.textFill.color;
                text.textFill.color = new vec4(c.x, c.y, c.z, t);
            }
        }
    }
}
