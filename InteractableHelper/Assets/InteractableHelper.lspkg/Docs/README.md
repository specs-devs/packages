# Interactable Helper

## What it is
A no-code package that wires Interaction Kit (SIK) hover and pinch events to visual and audio responses. You add
one component to an object and configure everything in the Inspector. It is for designers and developers who
want simple reactions on a single object without writing interaction scripts.

## What it does
1. Add the `InteractableHelper` component to an object (or start from the prefab examples).
2. In `onAwake` it gets or creates a `ColliderComponent`; on start it gets or creates a SIK `Interactable` and
   subscribes to its events.
3. You list responses under four event arrays: `onHoverEnter`, `onHoverExit`, `onPinchDown`
   (`onTriggerStart`) and `onPinchUp_Select` (`onTriggerEnd`).
4. When an event fires, every response in that list runs in order: set state, toggle, iterate children,
   transform tweens, animation clips, material property or base color tweens, script callbacks, blendshapes,
   audio and video textures.
5. Toggle and Iterate responses in one list share a counter that advances once per event.

## Highlights
- Eleven response types, several per event, all configured as `@typedef` arrays in the Inspector.
- Easing, delay and duration for every tween; play modes Play From Current Value, Play Everytime and Toggle.
- On start / on complete actions that call a public script method by name or set objects on or off.
- Property and base color tweens clone the target's `mainMaterial` first, so shared materials are not changed.
- Self-contained tween engine (`NativeTween`) built on Lens Studio runtime primitives only.
- `response(item, eventType)` runs a single configured response from code.

## Core scripts
| Script | What it does |
|---|---|
| `InteractableHelper.ts` | The component: creates collider/`Interactable`, subscribes events and runs the response lists. |
| `Scripts/EventResponseType.ts` | One response entry: type, target and per-type settings. |
| `Scripts/TransformAnimation.ts` | Position / rotation / scale tween settings. |
| `Scripts/MaterialPropertyAnimation.ts` | Shader property tween settings (`propertyName` is the script name). |
| `Scripts/CallbackAction.ts` | Calls a public method by name on a target script. |
| `Scripts/EasingData.ts` | Easing, delay and duration for tweens. |
| `Scripts/NativeTween.ts` | Internal tween engine driving all animations. |
| `Examples/ChangeTextScript.ts` | Example callback target used by the demo. |

## Extra info
- **Requires:** InteractionKit, Utilities, SnapDecorators, UIKit, Motion, Icons. The Interaction Kit (SIK)
  prefab must be in the scene or no hover/pinch event fires. Give the host your own sized collider (the
  auto-created one is not fitted to your mesh). Each response target needs its required component
  (AnimationPlayer, RenderMeshVisual, AudioComponent, Image with a video texture), or the response throws.
- **Get started:** `InteractableHelper__PLACE_IN_SCENE.prefab` (12 example groups, one per response type, plus
  the guide and example carousel). There is no `execute()` scripting API.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) — load-bearing rules; read first
  - [components.md](components.md) — the component and every response data type: fields, combo values, defaults
  - [api-status.md](api-status.md) — Current / Deprecated / Experimental / Removed / Internal
  - [examples.md](examples.md) — prefab path, Inspector setup, callback scripts, triggering from code
  - [guide.md](guide.md) — what each response type does, plus chained, staggered and toggle recipes
  - [troubleshooting.md](troubleshooting.md) — package-specific symptoms and fixes
