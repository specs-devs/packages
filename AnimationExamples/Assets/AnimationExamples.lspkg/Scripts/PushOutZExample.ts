/**
 * Specs Inc. 2026
 * Push out in Z using explicit keyframes (AnimationCurve.createKeyFrame).
 * Lets you express motion a single-segment easing curve cannot — e.g. overshoot then settle.
 */

import { buildFrameUI, flatCurve, playFirstClip } from "./Helpers/AnimationHelpers";

@component
export class PushOutZExample extends BaseScriptComponent {

    @ui.label('<span style="color: #F59E0B;">Setup required: AnimationPlayer</span>')
    @ui.label('<span style="color: #F59E0B; font-size: 11px;">1. Add an AnimationPlayer component on this SceneObject.</span>')
    @ui.label('<span style="color: #F59E0B; font-size: 11px;">2. Add one Clip and configure Name / Playback Mode / Speed / Weight / Range.</span>')
    @ui.label('<span style="color: #F59E0B; font-size: 11px;">3. Leave the Clip\'s Animation Asset empty to use the runtime curve below — or drop in an authored .animationAsset to override.</span>')

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Target</span>')

    @input
    @allowUndefined
    target: SceneObject;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Push Poses (absolute Z position)</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">TransformPosition is absolute — set values relative to the target\'s parent space, not its current local offset.</span>')

    @input
    @hint("Start Z (absolute).")
    startZ: number = 0;

    @input
    @hint("Overshoot peak Z — how far past the end the push briefly reaches.")
    overshootZ: number = 1.2;

    @input
    @hint("End Z (absolute) — settle position after the overshoot.")
    endZ: number = 1;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Timing</span>')

    @input
    @hint("Total duration (seconds) of the programmatic curve.")
    @widget(new SliderWidget(0.1, 3.0, 0.05))
    duration: number = 0.6;

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
     * Component awake — spawn the Frame's UI children, resolve target, and drive the AnimationPlayer.
     */
    onAwake() {
        if (this.enableLoggingLifecycle) print(`[${this.sceneObject.name}] PushOutZExample.onAwake`);
        buildFrameUI(this.sceneObject, { title: "Push Out (Z)", buttonText: "TAP" });
        const target = this.target ?? this.sceneObject;
        playFirstClip(target, this.buildAsset(target), undefined, this.enableLogging);
    }

    /**
     * Build a Z-axis position track with overshoot keyframes; X and Y hold flat.
     *
     * @param target - The SceneObject the asset layer is bound to (by name)
     * @returns The runtime-built AnimationAsset
     */
    private buildAsset(target: SceneObject): AnimationAsset {
        const curveZ = AnimationCurve.create();

        const kf0 = AnimationCurve.createKeyFrame();
        kf0.time = 0.0;
        kf0.value = this.startZ;
        kf0.rightTangentType = TangentType.Clamped;
        curveZ.addKeyframe(kf0);

        const kf1 = AnimationCurve.createKeyFrame();
        kf1.time = this.duration * (2 / 3);
        kf1.value = this.overshootZ;
        kf1.leftTangentType = TangentType.Clamped;
        kf1.rightTangentType = TangentType.Clamped;
        curveZ.addKeyframe(kf1);

        const kf2 = AnimationCurve.createKeyFrame();
        kf2.time = this.duration;
        kf2.value = this.endZ;
        kf2.leftTangentType = TangentType.Clamped;
        curveZ.addKeyframe(kf2);

        const posTrack = AnimationPropertyTrack.createVec3FromCurves(flatCurve(), flatCurve(), curveZ);
        const layer = AnimationPropertyLayer.create();
        layer.setProperty(AnimationPropertyLayer.TransformPosition, posTrack);

        const asset = AnimationAsset.create();
        asset.addLayer(target.name, layer);
        return asset;
    }
}
