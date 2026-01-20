@component
export class ChangeTextScript extends BaseScriptComponent 
{
    public changeText() 
    {
        this.getSceneObject().getComponent("Text").text = "Woof"
    }
}
