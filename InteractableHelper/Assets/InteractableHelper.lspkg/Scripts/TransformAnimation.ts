/**
 * Specs Inc. 2026
 * Transform animation configuration for InteractableHelper. Defines position, rotation, and scale
 * animations with play modes, easing, timing, and coordinate space options.
 */
import { CallbackAction } from "./CallbackAction"
import { EasingData } from "./EasingData"

@typedef
export class TransformAnimation
{
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Animation Type</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Choose the type of transform animation (move, scale, or rotate)</span>')

    @input
    @widget(
        new ComboBoxWidget([
            new ComboBoxItem('Move Local', 0),
            new ComboBoxItem('Move World', 1),
            new ComboBoxItem('Scale Local', 2),
            new ComboBoxItem('Scale World', 3),
            new ComboBoxItem('Rotate Local', 4),
            new ComboBoxItem('Rotate World', 5),
        ])
    )
    animationType: number

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Animation Mode</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Choose how the transform animation should play</span>')

    @input
    @widget(
        new ComboBoxWidget([
            new ComboBoxItem('Play From Current Value', 0),
            new ComboBoxItem('Play Everytime', 1),
            new ComboBoxItem('Toggle', 2)
        ])
    )
    playOption: number 

    // @input
    // playOption: PlayOptions

    @input
    @showIf('playOption', 0)
    endVal: vec3

    @input
    @showIf('playOption', 1)
    startValue: vec3
    @input
    @showIf('playOption', 1)
    endValue: vec3

    @input
    @showIf('playOption', 2)
    a: vec3
    @input
    @showIf('playOption', 2)
    b: vec3
    
    @input
    animationDurationInSeconds: number = 1.0

    @input 
    delay: number = 0.0

    @input
    easingData: EasingData

    //On Start
    @input
    doOnStart: boolean = false

    @input 
    @showIf('doOnStart', true)
    onStartAction: CallbackAction
    
    //On Complete
    @input
    doOnComplete: boolean = false

    @input 
    @showIf('doOnComplete', true)
    onCompleteAction: CallbackAction
}