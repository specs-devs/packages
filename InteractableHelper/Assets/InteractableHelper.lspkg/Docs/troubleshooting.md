# InteractableHelper troubleshooting

[← Agent usage index](../README.md)

## Use when

A configured response doesn't play, plays wrongly, or throws. Generic SIK,
scene and scripting issues are outside this package's
scope.

## Known issues

| Symptom | Package cause | Package fix |
|---|---|---|
| Nothing reacts to hover/pinch | No SIK prefab in the scene, or the host's collider doesn't cover the visual (an auto-created collider isn't sized to it) | Add the SIK prefab; add a sized collider on the host (the prefab uses a 3 cm Box, FitVisual off) |
| `… is missing SceneObject in On … Event. Assign SceneObject` | A response has an empty `Scene Object` | Assign a target to every response |
| `… needs X to contain children SceneObjects …` at start | An *Iterate Through Children* target has no children | Add children; child 0 shows first |
| `… is missing AnimationPlayer / RenderMeshVisual / AudioComponent …` | The target lacks the component its response type needs | See the "Requires" column in [components](components.md) |
| `does not contain clip called …` / `… BlendShape …` | Name mismatch | Use the exact clip / blendshape name (field `blenshapeName`) |
| `provided Script does not have … function` / `missing Script for Custom Callback` | `functionName` doesn't match a **public** method, or `script` is unset | Fix the name (case-sensitive) and assign the script component |
| `MainMaterial … does not contain … property` | `propertyName` is the parameter title, not its script name | Use the shader's script name |
| `… is missing MaterialMeshVisual Component …` (Base Color) | The target has neither a mesh/Image nor a Text | Target an object with a RenderMeshVisual, Image or Text |
| Two Toggles (hover enter + hover exit) both go `a → b` | Each event list has its own counter | Use *Play From Current Value* for enter/exit pairs ([guide](guide.md)) |
| Audio is silent in Preview | Preview/tooling audio isn't audible | Verify on device |
| `execute is not a function` / `EventType.OnTriggerStart` doesn't exist | Code from the older README | See [api-status](api-status.md) |

## Verification

After a fix, preview and fire each configured event several times (for
Toggle/Iterate). Every response must play, with no `Interactable Helper on …`
errors in the log.
