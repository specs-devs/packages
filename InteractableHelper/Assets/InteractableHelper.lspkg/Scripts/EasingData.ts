/**
 * Specs Inc. 2026
 * Easing function configuration for animations. Provides a comprehensive set of easing curves
 * including linear, quadratic, cubic, elastic, bounce, and more for smooth animation transitions.
 */
@typedef
export class EasingData
{
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Easing Function</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Choose the easing curve for animation timing</span>')

    @input
    @widget(
    new ComboBoxWidget([
        new ComboBoxItem('None', 0),

        new ComboBoxItem('Linear In', 1),
        new ComboBoxItem('Linear Out', 2),
        new ComboBoxItem('Linear InOut', 3),

        new ComboBoxItem('Quadratic In', 4),
        new ComboBoxItem('Quadratic Out', 5),
        new ComboBoxItem('Quadratic InOut', 6),
        
        new ComboBoxItem('Cubic In', 7),
        new ComboBoxItem('Cubic Out', 8),
        new ComboBoxItem('Cubic InOut', 9),

        new ComboBoxItem('Quartic In', 10),
        new ComboBoxItem('Quartic Out', 11),
        new ComboBoxItem('Quartic InOut', 12),

        new ComboBoxItem('Quintic In', 13),
        new ComboBoxItem('Quintic Out', 14),
        new ComboBoxItem('Quintic InOut', 15),

        new ComboBoxItem('Exponential In', 16),
        new ComboBoxItem('Exponential Out', 17),
        new ComboBoxItem('Exponential InOut', 18),

        new ComboBoxItem('Circular In', 19),
        new ComboBoxItem('Circular Out', 20),
        new ComboBoxItem('Circular InOut', 21),

        new ComboBoxItem('Elastic In', 22),
        new ComboBoxItem('Elastic Out', 23),
        new ComboBoxItem('Elastic InOut', 24),

        new ComboBoxItem('Back In', 25),
        new ComboBoxItem('Back Out', 26),
        new ComboBoxItem('Back InOut', 27),

        new ComboBoxItem('Bounce In', 28),
        new ComboBoxItem('Bounce Out', 29),
        new ComboBoxItem('Bounce InOut', 30),

        new ComboBoxItem('Sinusoidal In', 31),
        new ComboBoxItem('Sinusoidal Out', 32),
        new ComboBoxItem('Sinusoidal InOut', 33)
        ])
    )
    easing: number
}