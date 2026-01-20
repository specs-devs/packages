@component
export class TestScript8 extends BaseScriptComponent 
{
    // Text component that will be updated when function is called
    @input
    @hint("Text component to display function call status")
    displayText: Text

    // Example function that can be triggered via button
    public handleEvent() 
    {
        if (this.displayText)
        {
            this.displayText.text = "handleEvent() called!"
        }
    }

    // Returns a beautified display name for the function
    public getFunctionName()
    {
        return "Handle Event"
    }
}

