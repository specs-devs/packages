/**
 * Specs Inc. 2026
 * Event response type configuration for InteractableHelper. Defines the complete set of response
 * options for interaction events including state changes, animations, callbacks, and media control.
 */
import { AudioComponentControl } from "./AudioComponentControl"
import { BlendshapeAnimation } from "./BlendshapeAnimation"
import { ColorProperyAnimation } from "./ColorProperyAnimation"
import { CustomAnimation } from "./CustomAnimation"
import { MaterialPropertyAnimation } from "./MaterialPropertyAnimation"
import { TransformAnimation } from "./TransformAnimation"
import { VideoTextureControl } from "./VideoTextureControl"

@typedef
export class EventResponseType
{
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Target Object</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Specify the scene object to apply the response to</span>')

    @input
    sceneObject: SceneObject

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Response Type</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Choose what action should occur when the event is triggered</span>')

    @input
    @widget(
        new ComboBoxWidget([
            new ComboBoxItem('SetState', 0),
            new ComboBoxItem('Toggle', 1),
            new ComboBoxItem('Iterate Through Children', 2),
            new ComboBoxItem('Transform Animation', 3),
            new ComboBoxItem('Custom Animation', 4),
            new ComboBoxItem('Material Property Animation', 5),
            new ComboBoxItem('Material Base Color Animation', 6),
            new ComboBoxItem('Custom Callback', 7),
            new ComboBoxItem('BlendShape Animation', 8),
            new ComboBoxItem('Play Audio Clip', 9),
            new ComboBoxItem('Play Video Texture', 10)
        ])
    )
    eventResponseType: number

    //Set State
    @input
    @showIf("eventResponseType", 0)
    @widget(
        new ComboBoxWidget([
            new ComboBoxItem('On', 0),
            new ComboBoxItem('Off', 1)
        ])
    )
    state: number

    @input
    @showIf("eventResponseType", 0)
    delay: number = 0

    //Animate
    @input
    @showIf("eventResponseType", 3)
    animations: TransformAnimation[]

    //Custom Animation
    @input
    @showIf('eventResponseType', 4)
    customAnimationData: CustomAnimation

    //Material Property Animation
    @input 
    @showIf('eventResponseType', 5)
    materialProperyData: MaterialPropertyAnimation

    //Material Color Animation
    @input
    @showIf('eventResponseType', 6)
    colorProperyData: ColorProperyAnimation

    //Callback
    @input
    @showIf('eventResponseType', 7)
    script: ScriptComponent
    @input
    @showIf('eventResponseType', 7)
    functionName: string

    //BlendShape
    @input
    @showIf('eventResponseType', 8)
    blendShapeData: BlendshapeAnimation

    //Play Audio Clip
    @input 
    @showIf('eventResponseType', 9)
    audioControl: AudioComponentControl

    //Play Video Texture
    @input
    @showIf('eventResponseType', 10)
    videoTextureControl: VideoTextureControl
}