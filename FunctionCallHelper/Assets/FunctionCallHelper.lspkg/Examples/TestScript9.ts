@component
export class TestScript9 extends BaseScriptComponent 
{
    // Text component that will be updated when function is called
    @input
    @hint("Text component to display function call status")
    displayText: Text

    // Example function that can be triggered via button
    public updateStatus() 
    {
        if (this.displayText)
        {
            this.displayText.text = "updateStatus() called!"
        }
    }

    public getFunctionName()
    {
        return "Update Status"
    }
}

