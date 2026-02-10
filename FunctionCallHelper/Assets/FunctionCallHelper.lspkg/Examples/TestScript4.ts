/**
 * Specs Inc. 2026
 * Example test script demonstrating function call helper pattern. Provides a callable
 * function that can be triggered from dynamically generated UI buttons or other components.
 */
@component
export class TestScript4 extends BaseScriptComponent 
{
    // Text component that will be updated when function is called
    @input
    @hint("Text component to display function call status")
    displayText: Text

    // Example function that can be triggered via button
    public triggerAction() 
    {
        if (this.displayText)
        {
            this.displayText.text = "triggerAction() called!"
        }
    }

    // Returns a beautified display name for the function
    public getFunctionName()
    {
        return "Trigger Action"
    }
}

