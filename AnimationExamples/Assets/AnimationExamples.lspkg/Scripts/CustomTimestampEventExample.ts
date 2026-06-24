/**
 * Specs Inc. 2026
 * Fire a named event at an arbitrary timestamp inside the clip via AnimationAsset.createEvent.
 * Useful for syncing secondary effects (sounds, particles, state changes) to a specific moment.
 */

import { buildFrameUI, playFirstClip } from "./Helpers/AnimationHelpers";

@component
export class CustomTimestampEventExample extends BaseScriptComponent {

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
    @ui.label('<span style="color: #60A5FA;">Slide Poses (absolute position)</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">TransformPosition is absolute. Both vec3s drive X / Y / Z independently — leave a component equal in both poses to keep that axis still.</span>')

    @input("vec3", "{0, 0, 0}")
    startPosition: vec3 = new vec3(0, 0, 0);

    @input("vec3", "{1, 0, 0}")
    endPosition: vec3 = new vec3(1, 0, 0);

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Mid-Clip Event</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Named event fired at a specific time inside the runtime curve — sync sounds, particles, state changes here.</span>')

    @input("string", "midpoint")
    eventName: string = "midpoint";

    @input
    @hint("Timestamp (seconds) where the event fires.")
    @widget(new SliderWidget(0, 1, 0.05))
    eventTime: number = 0.5;

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
     * Component awake — resolve target, build the asset with a mid-clip event, and subscribe.
     */
    onAwake() {
        if (this.enableLoggingLifecycle) print(`[${this.sceneObject.name}] CustomTimestampEventExample.onAwake`);
        buildFrameUI(this.sceneObject, { title: "Custom Timestamp Event", buttonText: "TAP" });
        const target = this.target ?? this.sceneObject;
        playFirstClip(target, this.buildAsset(target), (args) => {
            if (args.eventName === this.eventName && this.enableLogging) {
                print(`[${this.sceneObject.name}] Reached "${args.eventName}" — spawn secondary effect here.`);
            }
        }, this.enableLogging);
    }

    /**
     * Build a position tween with a named event at eventTime.
     *
     * @param target - The SceneObject the asset layer is bound to (by name)
     * @returns The runtime-built AnimationAsset
     */
    private buildAsset(target: SceneObject): AnimationAsset {
        const curveX = AnimationCurve.createEasingCurve(this.startPosition.x, this.endPosition.x, 0.42, 0, 0.58, 1);
        const curveY = AnimationCurve.createEasingCurve(this.startPosition.y, this.endPosition.y, 0.42, 0, 0.58, 1);
        const curveZ = AnimationCurve.createEasingCurve(this.startPosition.z, this.endPosition.z, 0.42, 0, 0.58, 1);
        const posTrack = AnimationPropertyTrack.createVec3FromCurves(curveX, curveY, curveZ);

        const layer = AnimationPropertyLayer.create();
        layer.setProperty(AnimationPropertyLayer.TransformPosition, posTrack);

        const asset = AnimationAsset.create();
        asset.addLayer(target.name, layer);
        asset.createEvent(this.eventName, this.eventTime);
        return asset;
    }
}
