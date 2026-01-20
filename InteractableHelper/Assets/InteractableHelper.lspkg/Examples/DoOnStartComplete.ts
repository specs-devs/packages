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
