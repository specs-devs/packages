import { CallbackAction } from "./CallbackAction"
import { EasingData } from "./EasingData"

@typedef
export class ColorProperyAnimation
{
    @input
    @widget(new ColorWidget())
    endColor: vec4 = vec4.one()

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