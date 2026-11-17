# InteractableHelper cheat sheet (load-bearing rules)

[← Agent usage index](../README.md)

## Use when

Read this **first**, and again right before you configure an Interactable Helper.

## The rules

1. **Configure in the Inspector; there is no `execute()` API.** Responses are
   `@typedef` arrays on the component (`onHoverEnter`, `onHoverExit`,
   `onPinchDown`, `onPinchUp_Select`). Older snippets using `execute()`,
   `eventType` or `new CallbackAction(fn)` don't compile. → [api-status](api-status.md)
2. **The component is at the package root.** Import it from
   `InteractableHelper.lspkg/InteractableHelper`; the data types are under
   `InteractableHelper.lspkg/Scripts/`. → [components](components.md)
3. **Give the host a sized collider.** The helper creates a `ColliderComponent`
   (in `onAwake`) and a SIK `Interactable` (in `OnStart`) only when they are
   missing. The auto-created collider isn't sized for your mesh, so add your own.
   The prefab uses a 3 cm Box, FitVisual off. The SIK prefab must be in the
   scene. → [troubleshooting](troubleshooting.md)
4. **Every response needs a target, and its required component.** If
   `sceneObject` is unset, or the target lacks its AnimationPlayer /
   RenderMeshVisual / AudioComponent / Image-with-video, the response **throws**
   when the event fires. *Iterate Through Children* needs children and throws
   already in `onAwake`. → [components](components.md)
5. **Callbacks call a public method by name.** `functionName` must exactly match
   a public method of the script on `script`. A missing script or a misspelled name
   **throws** when the event fires. → [examples](examples.md)
6. **Toggle/Iterate counters are per event list.** All Toggle/Iterate responses
   in one list share one counter, which advances once per event. → [guide](guide.md)
7. **`propertyName` is the shader parameter's script name**, not its title. If it
   is wrong, the response throws. Property and base color tweens clone the target's
   `mainMaterial` first, so shared materials are not changed. → [components](components.md)
8. **Easing values follow the combo labels** (`0` None … `33` Sinusoidal InOut).
   → [components](components.md)

## Verify

In Preview, hover and pinch each configured object. Every response must play
with no `Interactable Helper on … is missing …` error in the log.
