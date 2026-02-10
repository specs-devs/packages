/**
 * Specs Inc. 2026
 * Example script demonstrating data processing function calls. Shows how to create named
 * functions that can be invoked programmatically with visual feedback.
 */
@component
export class TestScript2 extends BaseScriptComponent
{
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">UI Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Text component to display status messages when the function is called</span>')

    // Text component that will be updated when function is called
    @input
    @hint("Text component to display function call status")
    displayText: Text

    // Example function that can be triggered via button
    public processData() 
    {
        if (this.displayText)
        {
            this.displayText.text = "processData() called!"
        }
    }

    // Returns a beautified display name for the function
    public getFunctionName()
    {
        return "Process Data"
    }
}

