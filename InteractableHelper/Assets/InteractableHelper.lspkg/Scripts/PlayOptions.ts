/**
 * Specs Inc. 2026
 * Play options configuration for animations. Defines how animations should behave when triggered
 * including playing from current state, resetting each time, or toggling between states.
 */
@typedef
export class PlayOptions
{
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Play Mode</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Choose how the animation should play when triggered</span>')

    @input
    @widget(
        new ComboBoxWidget([
            new ComboBoxItem('Play From Current Value', 0),
            new ComboBoxItem('Play Everytime', 1),
            new ComboBoxItem('Toggle', 2)
        ])
    )
    option: number = 0
}