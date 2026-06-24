/**
 * Specs Inc. 2026
 * Subscribe to clip completion via a named event planted at the end timestamp.
 * AnimationPlayer has no built-in onFinish callback — createEvent at t=1.0 acts as one.
 */

import { buildFrameUI, playFirstClip } from "./Helpers/AnimationHelpers";

@component
export class SubscribeToFinishExample extends BaseScriptComponent {

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
    @ui.label('<span style="color: #60A5FA;">Scale Poses (absolute)</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">TransformScale is absolute, not a multiplier. Match your object\'s current scale here.</span>')

    @input("vec3", "{1, 1, 1}")
    startScale: vec3 = new vec3(1, 1, 1);

    @input("vec3", "{1.5, 1.5, 1.5}")
    endScale: vec3 = new vec3(1.5, 1.5, 1.5);

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Finish Event</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Named event placed at the end of the runtime curve — fires through onEvent when playback completes.</span>')

    @input("string", "finished")
    finishedEventName: string = "finished";

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
     * Component awake — spawn the Frame's UI children, resolve the target, build the asset,
     * and subscribe to the finish event.
     */
    onAwake() {
        if (this.enableLoggingLifecycle) print(`[${this.sceneObject.name}] SubscribeToFinishExample.onAwake`);
        buildFrameUI(this.sceneObject, { title: "Subscribe To Finish", buttonText: "TAP" });
        const target = this.target ?? this.sceneObject;
        playFirstClip(target, this.buildAsset(target), (args) => {
            if (args.eventName === this.finishedEventName && this.enableLogging) {
                print(`[${this.sceneObject.name}] "${this.finishedEventName}" — trigger follow-on logic here.`);
            }
        }, this.enableLogging);
    }

    /**
     * Build a uniform scale tween with a finish event planted at t=1.0.
     *
     * @param target - The SceneObject the asset layer is bound to (by name)
     * @returns The runtime-built AnimationAsset
     */
    private buildAsset(target: SceneObject): AnimationAsset {
        const curveX = AnimationCurve.createEasingCurve(this.startScale.x, this.endScale.x, 0, 0, 0.58, 1);
        const curveY = AnimationCurve.createEasingCurve(this.startScale.y, this.endScale.y, 0, 0, 0.58, 1);
        const curveZ = AnimationCurve.createEasingCurve(this.startScale.z, this.endScale.z, 0, 0, 0.58, 1);
        const scaleTrack = AnimationPropertyTrack.createVec3FromCurves(curveX, curveY, curveZ);

        const layer = AnimationPropertyLayer.create();
        layer.setProperty(AnimationPropertyLayer.TransformScale, scaleTrack);

        const asset = AnimationAsset.create();
        asset.addLayer(target.name, layer);
        asset.createEvent(this.finishedEventName, 1.0);
        return asset;
    }
}
