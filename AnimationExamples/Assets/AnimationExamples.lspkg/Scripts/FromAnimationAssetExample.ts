/**
 * Specs Inc. 2026
 * Use an authored .animationAsset by dropping it on the AnimationPlayer's clip.
 * Falls back to a small programmatic multi-track shake if the clip's asset slot is empty,
 * so the example runs either way.
 */

import { buildFrameUI, playFirstClip } from "./Helpers/AnimationHelpers";

@component
export class FromAnimationAssetExample extends BaseScriptComponent {

    @ui.label('<span style="color: #F59E0B;">Setup required: AnimationPlayer</span>')
    @ui.label('<span style="color: #F59E0B; font-size: 11px;">1. Add an AnimationPlayer component on this SceneObject.</span>')
    @ui.label('<span style="color: #F59E0B; font-size: 11px;">2. Add one Clip and configure Name / Playback Mode / Speed / Weight / Range.</span>')
    @ui.label('<span style="color: #F59E0B; font-size: 11px;">3. Drop an authored .animationAsset onto the Clip\'s Animation Asset slot (this example\'s focus), or leave empty for the fallback shake.</span>')

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Target</span>')

    @input
    @allowUndefined
    target: SceneObject;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Fallback Shake (used only if Clip 0\'s Animation Asset is empty)</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">TransformPosition is absolute. Shake offsets are added around 0 — set the target\'s base position to where you want it to oscillate.</span>')

    @input
    @hint("Horizontal shake amplitude.")
    @widget(new SliderWidget(0, 10, 0.5))
    shakeAmplitudeX: number = 2;

    @input
    @hint("Vertical shake amplitude.")
    @widget(new SliderWidget(0, 10, 0.5))
    shakeAmplitudeY: number = 2;

    @input
    @hint("Depth shake amplitude.")
    @widget(new SliderWidget(0, 10, 0.5))
    shakeAmplitudeZ: number = 0;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

    @input
    @hint("Enable general logging (animation cycles, events, etc.)")
    enableLogging: boolean = false;

    @input
    @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
    enableLoggingLifecycle: boolean = false;

    /**
     * Component awake — resolve target, build the fallback shake asset, and drive the player.
     */
    onAwake() {
        if (this.enableLoggingLifecycle) print(`[${this.sceneObject.name}] FromAnimationAssetExample.onAwake`);
        buildFrameUI(this.sceneObject, { title: "From Animation Asset", buttonText: "TAP" });
        const target = this.target ?? this.sceneObject;
        playFirstClip(target, this.buildShakeFallback(target), (args) => {
            if (this.enableLogging) print(`[${this.sceneObject.name}] Asset event: ${args.eventName}`);
        }, this.enableLogging);
    }

    /**
     * Build a 3-axis shake fallback for when no authored asset is provided.
     *
     * @param target - The SceneObject the asset layer is bound to (by name)
     * @returns The runtime-built AnimationAsset
     */
    private buildShakeFallback(target: SceneObject): AnimationAsset {
        const shake = (amp: number) => {
            const c = AnimationCurve.create();
            const steps = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
            const values = [0, amp, -amp, amp * 0.5, -amp * 0.5, 0];
            for (let i = 0; i < steps.length; i++) {
                const kf = AnimationCurve.createKeyFrame();
                kf.time = steps[i];
                kf.value = values[i];
                c.addKeyframe(kf);
            }
            return c;
        };

        const posTrack = AnimationPropertyTrack.createVec3FromCurves(
            shake(this.shakeAmplitudeX),
            shake(this.shakeAmplitudeY),
            shake(this.shakeAmplitudeZ),
        );
        const layer = AnimationPropertyLayer.create();
        layer.setProperty(AnimationPropertyLayer.TransformPosition, posTrack);

        const asset = AnimationAsset.create();
        asset.addLayer(target.name, layer);
        return asset;
    }
}
