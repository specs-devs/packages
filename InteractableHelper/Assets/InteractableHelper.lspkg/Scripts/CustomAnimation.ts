/**
 * Specs Inc. 2026
 * Custom animation configuration for InteractableHelper. Allows triggering specific animation
 * clips or iterating through all available clips in sequence.
 */
@typedef
export class CustomAnimation
{
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Animation Selection</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Choose whether to play all animation clips or a specific named clip</span>')

    @input
    iterateThroughAllClips: boolean = true

    @input
    @showIf('iterateThroughAllClips', false)
    animationName: string
}