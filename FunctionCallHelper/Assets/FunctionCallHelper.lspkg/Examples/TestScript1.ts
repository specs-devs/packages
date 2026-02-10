/**
 * Specs Inc. 2026
 * Example script demonstrating function call helper pattern. Shows how to create callable
 * functions with display names that can be triggered from UI buttons or other components.
 */
@component
export class TestScript1 extends BaseScriptComponent
{
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">UI Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Text component to display status messages when the function is called</span>')

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

