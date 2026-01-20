@typedef
export class CustomAnimation
{
    @input
    iterateThroughAllClips: boolean = true

    @input
    @showIf('iterateThroughAllClips', false)
    animationName: string
}