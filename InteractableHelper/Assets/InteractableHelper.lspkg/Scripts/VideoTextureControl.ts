import { CallbackAction } from "./CallbackAction"

@typedef
export class VideoTextureControl
{
    @input 
    @widget(
        new ComboBoxWidget([
            new ComboBoxItem('Play Once', 0),
            new ComboBoxItem('Loop', 1)
        ])
    )
    videoTextureControlBehavior: number
    
    @input
    @showIf("videoTextureControlBehavior", 0)
    delay: number = 0

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