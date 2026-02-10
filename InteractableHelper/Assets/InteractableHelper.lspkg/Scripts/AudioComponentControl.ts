/**
 * Specs Inc. 2026
 * Audio component control configuration for InteractableHelper. Defines audio playback behaviors
 * including play once, play/stop toggle, and play/pause with optional delay.
 */
@typedef
export class AudioComponentControl
{
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Audio Behavior</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Choose how the audio component should respond to interaction events</span>')

    @input
    @widget(
        new ComboBoxWidget([
            new ComboBoxItem('Play Once', 0),
            new ComboBoxItem('Play / Stop', 1),
            new ComboBoxItem('Play / Pause', 2)
        ])
    )
    audioControlBehavior: number

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Timing Settings</span>')

    @input
    @showIf("audioControlBehavior", 0)
    delay: number = 0
}