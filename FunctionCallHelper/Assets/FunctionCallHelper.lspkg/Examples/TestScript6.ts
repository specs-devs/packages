@component
export class TestScript6 extends BaseScriptComponent 
{
    // Text component that will be updated when function is called
    @input
    @hint("Text component to display function call status")
    displayText: Text

    // Example function that can be triggered via button
    public runOperation() 
    {
        if (this.displayText)
        {
            this.displayText.text = "runOperation() called!"
        }
    }

    // Returns a beautified display name for the function
    public getFunctionName()
    {
        return "Run Operation"
    }
}

