# HandAttacher troubleshooting

[← Agent usage index](../README.md)

## Use when

Something attached with Hand Attacher misbehaves. Generic scripting, scene and
rendering issues belong to the relevant CLAD skill (`lens-debug`,
`specs-debug`).

## Known issues

| Symptom | Package cause | Package fix |
|---|---|---|
| `Cannot find module 'HandAttacher.lspkg/HandAttacher'` | The script lives under `Scripts/` | Import `HandAttacher.lspkg/Scripts/HandAttacher` |
| A component created from code does nothing / the cast is wrong | It was created with `createComponent("Component.ScriptComponent")` | Use `createComponent(HandAttacher.getTypeName())` |
| The object follows the right hand for one frame although you set `handSide = "left"` | Older revisions resolved the hand only in `onAwake` (inside `createComponent`) | Fixed: a reassigned `handSide` is picked up on the next update. Use `setHand("left")` to apply it at once |
| Setting `targetObject` from code has no effect | Older revisions cached the target transform only in `onAwake` | Fixed: a reassigned `targetObject` is picked up on the next update. Use `setTarget(obj)` to apply it at once |
| The target never appears | The SIK prefab is missing (no hand is ever tracked), or the hand is not raised in Preview | Add the SIK prefab; in Preview, raise the configured hand |
| The target sits at the user's origin before a hand is seen | Older revisions only applied `hideWhenNotTracked` on a state change | Fixed in this revision: the first frame applies the tracking state. Update the package |
| The object is huge on the fingertip | Content is sized in scene cm under a scaled root (the old prefab box was 30 cm) | Size fingertip content at about 1–3 cm; the prefab box is 3 cm with a 2 cm offset |
| After a runtime hand swap, the old hand still shows/hides the target | Older revisions kept the previous hand's found/lost callbacks | Fixed: `setHand()` unsubscribes them. Always swap with `setHand()` |
| The target stays hidden after its own object was hidden | The target is the host, so hiding it also stops the update loop. Re-showing depends on SIK `onHandFound`; older revisions also stayed hidden after `setHand()` onto an already-tracked hand | Fixed: `setHand()` re-shows it, and a re-shown target snaps to the joint. A host + child target (the prefab layout) keeps the loop running |
| Nothing follows and nothing is logged | `handJoint` is not one of the `HandJoint` values (for example `"thumbUpperJoint"`) | Use a `HandJoint` member; turn on `enableLogging` to see `Joint '…' not found!` |
| The console floods with joint positions | `enableLogging` logs every frame | Use `debugMode` for found/lost lines only |
| Release in Preview does not hide the target | The simulated Preview hand can stay tracked after Release | Not a package bug; verify hide-on-lost on device |

## Verification

After a fix, preview with no hand (target hidden) and then with the hand raised
(target on the joint). Check that the logs show no `HandAttacher` errors.
