/**
 * Specs Inc. 2026
 * Scale squish using a CSS cubic-bezier easing preset (AnimationCurve.createEasingCurve).
 * The spring-out bezier (0.34, 1.56, 0.64, 1) overshoots then settles for a classic
 * "squish and release" feel without authoring keyframes.
 */

import { buildFrameUI, playFirstClip } from "./Helpers/AnimationHelpers";

@component
export class ScaleSquishExample extends BaseScriptComponent {

    @ui.label('<span style="color: #F59E0B;">Setup required: AnimationPlayer</span>')
    @ui.label('<span style="color: #F59E0B; font-size: 11px;">1. Add an AnimationPlayer component on this SceneObject.</span>')
    @ui.label('<span style="color: #F59E0B; font-size: 11px;">2. Add one Clip and configure Name / Playback Mode / Speed / Weight / Range.</span>')
    @ui.label('<span style="color: #F59E0B; font-size: 11px;">3. Leave the Clip\'s Animation Asset empty to use the runtime curve below — or drop in an authored .animationAsset to override.</span>')

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Target</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Which SceneObject\'s transform the curve drives. Defaults to this object.</span>')

    @input
    @allowUndefined
    target: SceneObject;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Squish Poses</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Start scale → end scale of the spring-out curve. For a snap-back feel set the AnimationPlayer\'s Playback Mode to PingPong.</span>')

    @input("vec3", "{1, 1, 1}")
    startScale: vec3 = new vec3(1, 1, 1);

    @input("vec3", "{1.4, 0.6, 1.4}")
    endScale: vec3 = new vec3(1.4, 0.6, 1.4);

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
     * Component awake — spawn the Frame's UI children, resolve the target,
     * build the runtime asset, and drive the AnimationPlayer's first clip.
     */
    onAwake() {
        if (this.enableLoggingLifecycle) print(`[${this.sceneObject.name}] ScaleSquishExample.onAwake`);
        buildFrameUI(this.sceneObject, { title: "Scale Squish", buttonText: "TAP" });
        const target = this.target ?? this.sceneObject;
        playFirstClip(target, this.buildAsset(target), undefined, this.enableLogging);
    }

    /**
     * Build a vec3 scale track between startScale and endScale using a spring-out easing curve.
     *
     * @param target - The SceneObject the asset layer is bound to (by name)
     * @returns The runtime-built AnimationAsset
     */
    private buildAsset(target: SceneObject): AnimationAsset {
        const curveX = AnimationCurve.createEasingCurve(this.startScale.x, this.endScale.x, 0.34, 1.56, 0.64, 1);
        const curveY = AnimationCurve.createEasingCurve(this.startScale.y, this.endScale.y, 0.34, 1.56, 0.64, 1);
        const curveZ = AnimationCurve.createEasingCurve(this.startScale.z, this.endScale.z, 0.34, 1.56, 0.64, 1);

        const scaleTrack = AnimationPropertyTrack.createVec3FromCurves(curveX, curveY, curveZ);
        const layer = AnimationPropertyLayer.create();
        layer.setProperty(AnimationPropertyLayer.TransformScale, scaleTrack);

        const asset = AnimationAsset.create();
        asset.addLayer(target.name, layer);
        return asset;
    }
}
