@typedef
export class CallbackAction
{
    @input
    @widget(
        new ComboBoxWidget([
            new ComboBoxItem('Custom Callback', 0),
            new ComboBoxItem('Set State', 1)
        ])
    )
    actionType: number = -1

    @input 
    @showIf('actionType', 0)
    script: ScriptComponent
    @input 
    @showIf('actionType', 0)
    functionName: string

    @input
    @showIf('actionType', 1)
    targetObjects: CallbackTargetObjectAction[]
}

@typedef
export class CallbackTargetObjectAction
{   
    @input
    targetObject: SceneObject
    @input
    setValue: boolean
}