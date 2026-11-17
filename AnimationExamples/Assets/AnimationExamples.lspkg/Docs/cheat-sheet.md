# AnimationExamples cheat sheet

[← Agent usage index](../README.md)

## Use when

Read first when using the installed animation examples.

1. Instantiate the manager prefab or wire the example's AnimationPlayer with at least one clip. → [Examples](examples.md)
2. Runtime-built examples use the first clip's name, playback mode, speed, weight, range, offset, and blend/scale options. An assigned asset overrides the fallback. → [Components](components.md)
3. Position and scale tracks are absolute; move a parent when a track owns the example transform. → [Troubleshooting](troubleshooting.md)
4. UIKit Frame opacity and innerSize must be written after initialization; the opacity and sizing examples defer setup to OnStart. → [Components](components.md)
5. Replay is bound on OnStart and deferred on enable. Avoid subscribing repeatedly when showing an already initialized example. → [Components](components.md)
6. Named AnimationAsset events are the finish/midpoint hooks. Enable logging to observe them. → [API status](api-status.md)
7. The place-in-scene prefab ships a demo Guide and ExampleCarousel (scripts in `Example/`); the carousel hides the manager's own UI. Remove both objects to use the manager UI alone. → [Examples](examples.md)
