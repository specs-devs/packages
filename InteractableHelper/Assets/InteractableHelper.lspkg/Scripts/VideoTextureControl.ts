/**
 * Specs Inc. 2026
 * Video texture control configuration for InteractableHelper. Manages video playback behaviors
 * including play once, loop, delay, and callbacks for video texture interactions.
 */
import { CallbackAction } from "./CallbackAction"

@typedef
export class VideoTextureControl
{
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Playback Behavior</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Choose how the video texture should play</span>')

    @input
    @widget(
        new ComboBoxWidget([
            new ComboBoxItem('Play Once', 0),
            new ComboBoxItem('Loop', 1)
        ])
    )
    videoTextureControlBehavior: number

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Timing Settings</span>')

    @input
    @showIf("videoTextureControlBehavior", 0)
    delay: number = 0

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">On Start Callback</span>')

    //On Start
    @input
    doOnStart: boolean = false

    @input
    @showIf('doOnStart', true)
    onStartAction: CallbackAction

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">On Complete Callback</span>')

    //On Complete
    @input
    doOnComplete: boolean = false

    @input
    @showIf('doOnComplete', true)
    onCompleteAction: CallbackAction
}