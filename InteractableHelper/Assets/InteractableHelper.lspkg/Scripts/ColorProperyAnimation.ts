/**
 * Specs Inc. 2026
 * Color property animation configuration for InteractableHelper. Defines color animations with
 * timing, easing, and callback options for material base color transitions.
 */
import { CallbackAction } from "./CallbackAction"
import { EasingData } from "./EasingData"

@typedef
export class ColorProperyAnimation
{
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Color Settings</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Define the target color for the animation</span>')

    @input
    @widget(new ColorWidget())
    endColor: vec4 = vec4.one()

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Timing Settings</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure animation duration, delay, and easing</span>')

    @input
    animationDurationInSeconds: number = 1.0

    @input
    delay: number

    @input
    easingData: EasingData

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