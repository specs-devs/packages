/**
 * Specs Inc. 2026
 * Blendshape animation configuration for InteractableHelper. Defines blendshape animation behaviors
 * including play modes, value ranges, easing, and timing for morph target animations.
 */
import { CallbackAction } from "./CallbackAction"
import { EasingData } from "./EasingData"

@typedef
export class BlendshapeAnimation
{
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Blendshape Target</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Specify the blendshape name to animate</span>')

    @input
    blenshapeName: string

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Animation Mode</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Choose how the blendshape animation should play</span>')

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
    endVal: number

    @input
    @showIf('playOption', 1)
    startValue: number
    @input
    @showIf('playOption', 1)
    endValue: number

    @input
    @showIf('playOption', 2)
    a: number
    @input
    @showIf('playOption', 2)
    b: number

    @input
    animationDurationInSeconds: number = 1.0
    
    @input 
    delay: number

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