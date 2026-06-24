/**
 * Specs Inc. 2026
 * Play an entirely Inspector-configured AnimationPlayer.
 * No runtime asset, no script-built curve — the developer wires the AnimationPlayer's
 * first clip in the Inspector and the script just starts it.
 */

import { assert } from "SnapDecorators.lspkg/assert";
import { buildFrameUI } from "./Helpers/AnimationHelpers";

@component
export class ExistingPlayerExample extends BaseScriptComponent {

    @ui.label('<span style="color: #F59E0B;">Setup required: AnimationPlayer</span>')
    @ui.label('<span style="color: #F59E0B; font-size: 11px;">1. Add an AnimationPlayer component on this SceneObject.</span>')
    @ui.label('<span style="color: #F59E0B; font-size: 11px;">2. Add one Clip — set its Name, drop an authored .animationAsset into its Animation Asset slot, and configure Playback Mode / Speed / Weight / Range.</span>')
    @ui.label('<span style="color: #F59E0B; font-size: 11px;">This script plays the first configured clip on awake.</span>')

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
     * Component awake — read the Inspector-configured clip and play it.
     */
    onAwake() {
        if (this.enableLoggingLifecycle) print(`[${this.sceneObject.name}] ExistingPlayerExample.onAwake`);
        buildFrameUI(this.sceneObject, { title: "Existing Player", buttonText: "TAP" });

        const player = this.sceneObject.getComponent("Component.AnimationPlayer") as AnimationPlayer;
        assert(player != null, `[${this.sceneObject.name}] ExistingPlayerExample requires an AnimationPlayer component on this SceneObject`);

        const firstClip = player.clips && player.clips.length > 0 ? player.clips[0] : null;
        if (!firstClip) {
            if (this.enableLogging) print(`[${this.sceneObject.name}] AnimationPlayer has no clips — add a Clip in the Inspector.`);
            return;
        }
        const clipName = firstClip.name;

        if (this.enableLogging) {
            player.onEvent.add((args) => print(`[${this.sceneObject.name}] Player event: ${args.eventName}`));
        }

        player.playClip(clipName);
        if (this.enableLogging) print(`[${this.sceneObject.name}] playing clip "${clipName}"`);
    }
}
