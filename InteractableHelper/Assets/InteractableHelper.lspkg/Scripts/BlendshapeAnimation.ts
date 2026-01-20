import { CallbackAction } from "./CallbackAction"
import { EasingData } from "./EasingData"

@typedef
export class BlendshapeAnimation
{
    @input 
    blenshapeName: string

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