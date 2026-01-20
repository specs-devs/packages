@typedef
export class AudioComponentControl
{  
    @input 
    @widget(
        new ComboBoxWidget([
            new ComboBoxItem('Play Once', 0),
            new ComboBoxItem('Play / Stop', 1),
            new ComboBoxItem('Play / Pause', 2)
        ])
    )
    audioControlBehavior: number
    
    @input
    @showIf("audioControlBehavior", 0)
    delay: number = 0
}