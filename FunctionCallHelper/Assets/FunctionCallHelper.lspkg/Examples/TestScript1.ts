@component
export class TestScript1 extends BaseScriptComponent 
{
    // Text component that will be updated when function is called
    @input
    @hint("Text component to display function call status")
    displayText: Text

    // Example function that can be triggered via button
    public activateSystem() 
    {
        print("activateSystem() function called!")
        if (this.displayText)
        {
            this.displayText.text = "activateSystem() called!"
            print("Text updated successfully")
        }
        else
        {
            print("Warning: displayText is not assigned")
        }
    }

    // Returns a beautified display name for the function
    public getFunctionName()
    {
        return "Activate System"
    }
}

