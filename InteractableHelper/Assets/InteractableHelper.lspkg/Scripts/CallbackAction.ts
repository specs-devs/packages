/**
 * Specs Inc. 2026
 * Callback action configuration for InteractableHelper. Defines callback behaviors including
 * custom script functions and object state changes in response to interaction events.
 */
@typedef
export class CallbackAction
{
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Action Type</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Choose whether to call a custom function or set object states</span>')

    @input
    @widget(
        new ComboBoxWidget([
            new ComboBoxItem('Custom Callback', 0),
            new ComboBoxItem('Set State', 1)
        ])
    )
    actionType: number = -1

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Custom Callback Settings</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Specify the script component and function name to call</span>')

    @input
    @showIf('actionType', 0)
    script: ScriptComponent
    @input
    @showIf('actionType', 0)
    functionName: string

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Set State Settings</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Define target objects and their enabled/disabled states</span>')

    @input
    @showIf('actionType', 1)
    targetObjects: CallbackTargetObjectAction[]
}

/**
 * Callback target object action configuration.
 */
@typedef
export class CallbackTargetObjectAction
{
    @input
    targetObject: SceneObject
    @input
    setValue: boolean
}