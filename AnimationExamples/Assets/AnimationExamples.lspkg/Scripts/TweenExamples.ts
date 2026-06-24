/**
 * Specs Inc. 2026
 * Comprehensive walkthrough of every AnimationPlayer pattern in one component.
 * Uncomment the matching example call in onAwake() to run it in isolation.
 */

import { assert } from "SnapDecorators.lspkg/assert";

@component
export class TweenExamples extends BaseScriptComponent {
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Animation Asset</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Used by exampleFromAnimationAsset(). Drop an authored .animationAsset here.</span>')

    @input
    @allowUndefined
    @hint("AnimationAsset created in the GUI; consumed by exampleFromAnimationAsset().")
    animationAsset: AnimationAsset;

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
     * Component awake — uncomment a single example below to run it.
     */
    onAwake() {
        if (this.enableLoggingLifecycle) print(`[${this.sceneObject.name}] TweenExamples.onAwake`);
        // Uncomment whichever example you want to run:
        // this.exampleScaleSquish();
        // this.examplePushOutZ();
        // this.exampleOpacityCallback();
        // this.exampleSubscribeToFinish();
        // this.exampleCustomTimestampEvent();
        // this.exampleFromAnimationAsset();
        // this.exampleExistingPlayerByClipName();
    }

    // ─── 1: Scale squish using CSS easing presets ────────────────────────────────
    //
    // Uses AnimationCurve.createEasingCurve, which accepts CSS cubic-bezier control
    // points (x1, y1, x2, y2). Common presets:
    //   ease-in-out : (0.42, 0, 0.58, 1)
    //   ease-out    : (0, 0, 0.58, 1)
    //   spring-out  : (0.34, 1.56, 0.64, 1)  ← overshoot, snaps back
    /**
     * Scale a SceneObject with a spring-out easing curve.
     */
    private exampleScaleSquish(): void {
        const CLIP_NAME = "squish";

        const curveX = AnimationCurve.createEasingCurve(1.0, 1.4, 0.34, 1.56, 0.64, 1);
        const curveY = AnimationCurve.createEasingCurve(1.0, 0.6, 0.34, 1.56, 0.64, 1);
        const curveZ = AnimationCurve.createEasingCurve(1.0, 1.4, 0.34, 1.56, 0.64, 1);

        const scaleTrack = AnimationPropertyTrack.createVec3FromCurves(curveX, curveY, curveZ);

        const layer = AnimationPropertyLayer.create();
        layer.setProperty(AnimationPropertyLayer.TransformScale, scaleTrack);

        const asset = AnimationAsset.create();
        asset.addLayer(this.sceneObject.name, layer);

        const clip = AnimationClip.createFromAnimation(CLIP_NAME, asset);
        clip.playbackMode = PlaybackMode.Single;

        const player = this.sceneObject.createComponent("Component.AnimationPlayer") as AnimationPlayer;
        player.addClip(clip);
        player.playClip(CLIP_NAME);

        if (this.enableLogging) print(`[${this.sceneObject.name}] exampleScaleSquish playing clip "${CLIP_NAME}"`);
    }

    // ─── 2: Push out in Z using explicit keyframes ───────────────────────────────
    //
    // Builds an AnimationCurve by placing individual AnimationKeyFrames at specific
    // timestamps, allowing precise control over the motion path — including overshoot
    // that a single-segment easing curve cannot express.
    /**
     * Translate along Z with explicit overshoot keyframes.
     */
    private examplePushOutZ(): void {
        const CLIP_NAME = "pushZ";
        const DURATION = 0.6;

        const curveZ = AnimationCurve.create();

        const kf0 = AnimationCurve.createKeyFrame();
        kf0.time = 0.0;
        kf0.value = 0;
        kf0.rightTangentType = TangentType.Clamped;
        curveZ.addKeyframe(kf0);

        const kf1 = AnimationCurve.createKeyFrame();
        kf1.time = 0.4;
        kf1.value = 1.2;
        kf1.leftTangentType = TangentType.Clamped;
        kf1.rightTangentType = TangentType.Clamped;
        curveZ.addKeyframe(kf1);

        const kf2 = AnimationCurve.createKeyFrame();
        kf2.time = DURATION;
        kf2.value = 1;
        kf2.leftTangentType = TangentType.Clamped;
        curveZ.addKeyframe(kf2);

        const flatCurve = AnimationCurve.createEasingCurve(0, 0, 0, 0, 1, 1);
        const posTrack = AnimationPropertyTrack.createVec3FromCurves(flatCurve, flatCurve, curveZ);

        const layer = AnimationPropertyLayer.create();
        layer.setProperty(AnimationPropertyLayer.TransformPosition, posTrack);

        const asset = AnimationAsset.create();
        asset.addLayer(this.sceneObject.name, layer);

        const clip = AnimationClip.createFromAnimation(CLIP_NAME, asset);
        clip.playbackMode = PlaybackMode.Single;

        const player = this.sceneObject.createComponent("Component.AnimationPlayer") as AnimationPlayer;
        player.addClip(clip);
        player.playClip(CLIP_NAME);

        if (this.enableLogging) print(`[${this.sceneObject.name}] examplePushOutZ playing clip "${CLIP_NAME}"`);
    }

    // ─── 3: Opacity tween via setCustomProperty + callback ──────────────────────
    //
    // setCustomProperty drives any value through a user callback, enabling animation
    // of properties not natively tracked by the AnimationPropertyLayer.
    /**
     * Fade an Image component's mainMaterial baseColor alpha via callback.
     */
    private exampleOpacityCallback(): void {
        const CLIP_NAME = "fadeIn";
        const image = this.sceneObject.getComponent("Component.Image") as Image;
        assert(image != null, "exampleOpacityCallback requires an Image component on this SceneObject");

        const opacityCurve = AnimationCurve.createEasingCurve(0.0, 1.0, 0.42, 0, 0.58, 1);
        const opacityTrack = AnimationPropertyTrack.createFloatFromCurves(opacityCurve);

        const layer = AnimationPropertyLayer.create();
        layer.setCustomProperty("opacity", opacityTrack, (_name, value) => {
            const pass = image.mainMaterial.mainPass;
            const baseColor = pass.baseColor as vec4;
            pass.baseColor = new vec4(baseColor.x, baseColor.y, baseColor.z, value as number);
        });

        const asset = AnimationAsset.create();
        asset.addLayer(this.sceneObject.name, layer);

        const clip = AnimationClip.createFromAnimation(CLIP_NAME, asset);
        clip.playbackMode = PlaybackMode.Single;

        const player = this.sceneObject.createComponent("Component.AnimationPlayer") as AnimationPlayer;
        player.addClip(clip);
        player.playClip(CLIP_NAME);

        if (this.enableLogging) print(`[${this.sceneObject.name}] exampleOpacityCallback playing clip "${CLIP_NAME}"`);
    }

    // ─── 4: Subscribe to animation playback finishing ───────────────────────────
    //
    // AnimationPlayer has no built-in "done" callback, but AnimationAsset.createEvent
    // lets you plant a named event at any timestamp.
    /**
     * Plant a "finished" event at clip end and react via onEvent.
     */
    private exampleSubscribeToFinish(): void {
        const CLIP_NAME = "scaleUp";
        const FINISHED_EVENT = "finished";

        const curve = AnimationCurve.createEasingCurve(1.0, 1.5, 0, 0, 0.58, 1);
        const scaleTrack = AnimationPropertyTrack.createVec3FromCurves(curve, curve, curve);

        const layer = AnimationPropertyLayer.create();
        layer.setProperty(AnimationPropertyLayer.TransformScale, scaleTrack);

        const asset = AnimationAsset.create();
        asset.addLayer(this.sceneObject.name, layer);
        asset.createEvent(FINISHED_EVENT, 1.0);

        const clip = AnimationClip.createFromAnimation(CLIP_NAME, asset);
        clip.playbackMode = PlaybackMode.Single;

        const player = this.sceneObject.createComponent("Component.AnimationPlayer") as AnimationPlayer;
        player.addClip(clip);

        player.onEvent.add((args: AnimationPlayerOnEventArgs) => {
            if (args.eventName === FINISHED_EVENT && this.enableLogging) {
                print(`[${this.sceneObject.name}] Scale-up finished — trigger follow-on logic here.`);
            }
        });

        player.playClip(CLIP_NAME);
    }

    // ─── 5: Subscribe to an event at a custom timestamp ─────────────────────────
    /**
     * Plant a mid-clip event and react via onEvent.
     */
    private exampleCustomTimestampEvent(): void {
        const CLIP_NAME = "slideRight";
        const MIDPOINT_EVENT = "midpoint";

        const curvePosX = AnimationCurve.createEasingCurve(0, 1, 0.42, 0, 0.58, 1);
        const flatCurve = AnimationCurve.createEasingCurve(0, 0, 0, 0, 1, 1);
        const posTrack = AnimationPropertyTrack.createVec3FromCurves(curvePosX, flatCurve, flatCurve);

        const layer = AnimationPropertyLayer.create();
        layer.setProperty(AnimationPropertyLayer.TransformPosition, posTrack);

        const asset = AnimationAsset.create();
        asset.addLayer(this.sceneObject.name, layer);
        asset.createEvent(MIDPOINT_EVENT, 0.5);

        const clip = AnimationClip.createFromAnimation(CLIP_NAME, asset);
        clip.playbackMode = PlaybackMode.Single;

        const player = this.sceneObject.createComponent("Component.AnimationPlayer") as AnimationPlayer;
        player.addClip(clip);

        player.onEvent.add((args: AnimationPlayerOnEventArgs) => {
            if (args.eventName === MIDPOINT_EVENT && this.enableLogging) {
                print(`[${this.sceneObject.name}] Reached midpoint at t=0.5 — spawn secondary effect here.`);
            }
        });

        player.playClip(CLIP_NAME);
    }

    // ─── 6: Build an AnimationPlayer from an AnimationAsset input ───────────────
    /**
     * Play an authored AnimationAsset assigned via the Inspector.
     */
    private exampleFromAnimationAsset(): void {
        const CLIP_NAME = "SHAKE";
        assert(this.animationAsset != null, "exampleFromAnimationAsset requires animationAsset to be assigned in the Inspector");

        const clip = AnimationClip.createFromAnimation(CLIP_NAME, this.animationAsset);
        clip.playbackMode = PlaybackMode.Single;

        const player = this.sceneObject.createComponent("Component.AnimationPlayer") as AnimationPlayer;
        player.addClip(clip);

        player.onEvent.add((args: AnimationPlayerOnEventArgs) => {
            if (this.enableLogging) print(`[${this.sceneObject.name}] Asset event: ${args.eventName}`);
        });

        player.playClip(CLIP_NAME);
    }

    // ─── 7: Get an existing AnimationPlayer from the GUI and play a clip by name ─
    /**
     * Play a clip that was configured on an existing AnimationPlayer component.
     */
    private exampleExistingPlayerByClipName(): void {
        const CLIP_NAME = "LIFT";
        const player = this.sceneObject.getComponent("Component.AnimationPlayer") as AnimationPlayer;
        assert(player != null, "exampleExistingPlayerByClipName requires an AnimationPlayer component on this SceneObject");

        if (!player.getClip(CLIP_NAME)) {
            if (this.enableLogging) print(`[${this.sceneObject.name}] Clip "${CLIP_NAME}" not found — verify the clip name in the Inspector.`);
            return;
        }

        player.playClip(CLIP_NAME);
        if (this.enableLogging) print(`[${this.sceneObject.name}] playing existing clip "${CLIP_NAME}"`);
    }
}
