import { CallbackAction } from "./CallbackAction"
import { EasingData } from "./EasingData"

@typedef
export class MaterialPropertyAnimation
{
    @input
    @hint('Parameter Script Name, not Title')
    propertyName: string
    
    @input
    @widget(
        new ComboBoxWidget([
            new ComboBoxItem('Float', 0),
            new ComboBoxItem('Vec3', 1),
            new ComboBoxItem('Vec4', 2)
        ])
    )
    valueType: number

    @input
    @showIf('valueType', 0)
    startFloatValue: number
    @input
    @showIf('valueType', 1)
    @widget(new ColorWidget())
    startVec3Value: vec3
    @input
    @showIf('valueType', 2)
    @widget(new ColorWidget())
    startVec4Value: vec4

    @input
    @showIf('valueType', 0)
    endFloatValue: number
    @input
    @showIf('valueType', 1)
    @widget(new ColorWidget())
    endVec3Value: vec3
    @input
    @showIf('valueType', 2)
    @widget(new ColorWidget())
    endVec4Value: vec4

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