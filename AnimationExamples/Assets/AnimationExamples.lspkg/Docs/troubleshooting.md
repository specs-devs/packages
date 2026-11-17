# AnimationExamples troubleshooting

[← Agent usage index](../README.md)

## Use when

Read when an animation is invisible, already finished, or cannot be exercised.

| Symptom | Cause | Fix |
| --- | --- | --- |
| No examples appear | animationPrefabs is absent or empty | Bind the eight package prefabs; getCount should return eight |
| No playback | AnimationPlayer or its first clip is absent | Add the player and a clip; playFirstClip prints a setup message and returns null |
| Example snaps to the origin | Absolute TransformPosition track writes the animated object's local transform | Place a parent holder, not the animated object |
| Example is finished before shown | Playback began onAwake while the guide/navigator hid the example | bindReplay restarts the configured clip after enable; TAP explicitly replays |
| TAP has no effect in older source | buildFrameUI created the button but did not wire playback | Use this revision's bindReplay from each focused example |
| Opacity/frame sizing faults at startup | UIKit Frame internals have not initialized | Keep these examples' setup deferred to OnStart |
| Expected authored shake actually uses fallback | Consumer first clip asset slot is empty | The shipped prefab binds SHAKE, whose layer matches FromAnimationAssetExample; empty slots deliberately use the fallback |
| Existing authored clip looks static | Authored asset layer binding may not match the scene hierarchy | LIFT in this revision targets ExistingPlayerExample; preserve or update the asset layer when renaming the target |
| Finish/midpoint seems silent | Logging flags default to false | Enable enableLogging on the event example and watch AnimationPlayer.onEvent |
| Preview tool Pinch errors with getTransform of undefined | Installed interaction handler cannot resolve its synthetic hand | Record controls as unverified; use manual/device input, not a silent pass |
| Duplicate navigators | Demo carousel plus manager-generated UI are both active | Demo bridge disables manager UI; consumers can retain the manager UI alone |

QA used authored startIndex resets when synthetic input was unavailable. Screenshots establish layout and motion evidence only; they do not establish that hand controls work on device.
