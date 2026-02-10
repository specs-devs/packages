/**
 * Specs Inc. 2026
 * Example script demonstrating animation lifecycle callbacks. Shows how to respond to animation
 * start and complete events for coordinating behaviors with animation timing.
 */
@component
export class DoOnStartComplete extends BaseScriptComponent
{
    public onAnimationStart()
    {
        print("Animation Started")
    }

    public onAnimationComplete()
    {
        print("Animation Completed")
    }
}
