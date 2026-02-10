/**
 * Specs Inc. 2026
 * Example script demonstrating 3D hand hint animations for Spectacles. Shows single animation
 * playback and animation sequences with configurable demo options, animation end event binding,
 * and usage patterns for InteractionHintController integration.
 */
import { HandAnimationClipInfo, HandAnimationsLibrary, HandMode, InteractionHintController } from "./InteractionHintController"

@component
export class Example extends BaseScriptComponent
{
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Interaction Hint Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Controller and demo mode selection</span>')

    @input
    interactionHintController: InteractionHintController

    @input('int')
    @widget(
        new ComboBoxWidget([
            new ComboBoxItem('Demo Single Animation', 0),
            new ComboBoxItem('Demo Animation Sequence', 1)
        ])
    )
    demoOption: number = 0

    onAwake() 
    {
        switch(this.demoOption)
        {
            case 0:
                //play a single animation
                this.interactionHintController.playHintAnimation(HandMode.Both, HandAnimationsLibrary.Both.SystemTapExit, 2, 0.8)
                this.interactionHintController.animationEndEvent.bind(() => 
                {
                    this.interactionHintController.playHintAnimation(HandMode.Left, HandAnimationsLibrary.Left.PinchMoveY, 3)
                })
                break
            case 1: {
                //play sequence
                const sequence: HandAnimationClipInfo[] = []
                const itemA: HandAnimationClipInfo = new HandAnimationClipInfo(HandMode.Left, HandAnimationsLibrary.Left.PalmGrabY, new vec3(10, 0, 0))
                const itemB: HandAnimationClipInfo = new HandAnimationClipInfo(HandMode.Right, HandAnimationsLibrary.Right.PalmGrabX)
                sequence.push(itemA)
                sequence.push(itemB)
                this.interactionHintController.playHintAnimationSequence(sequence, 2)

                this.interactionHintController.animationEndEvent.bind(() =>
                {
                    print("Sequence looping completed")
                })
                break
            }
        }
    }
}
