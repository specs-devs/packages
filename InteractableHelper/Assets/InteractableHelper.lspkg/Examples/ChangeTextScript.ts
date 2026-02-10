/**
 * Specs Inc. 2026
 * Example script demonstrating text change callback. Simple example showing how to create
 * callable functions that modify text components in response to interaction events.
 */
@component
export class ChangeTextScript extends BaseScriptComponent
{
    public changeText()
    {
        this.getSceneObject().getComponent("Text").text = "Woof"
    }
}
