# InteractableHelper API status

[← Agent usage index](../README.md)

## Use when

Check this file before reusing an older Interactable Helper example. It
describes the package revision that contains it.

## Status meanings

- **Current** — recommended public surface for new work.
- **Deprecated** — still present; migrate to the named replacement.
- **Experimental** — public, but compatibility is not guaranteed.
- **Removed** — unavailable in this revision.
- **Internal** — resolvable but not supported API.

## Current API

| Capability | Current surface |
|---|---|
| Event → response wiring | `InteractableHelper` inputs `onHoverEnter`, `onHoverExit`, `onPinchDown`, `onPinchUp_Select` (Inspector) |
| Response description | `EventResponseType` with `eventResponseType` 0–10 and its per-type data |
| Tween data | `TransformAnimation`, `MaterialPropertyAnimation`, `ColorProperyAnimation`, `BlendshapeAnimation`, `EasingData` |
| Media | `AudioComponentControl`, `VideoTextureControl` |
| Start/complete hooks | `CallbackAction` (`actionType` 0 callback / 1 set state), `CallbackTargetObjectAction` |
| Fire a configured response from code | `InteractableHelper.response(item, EventType.X)` |
| Ready-made examples | `InteractableHelper__PLACE_IN_SCENE.prefab` |

The serialized field names with typos (`materialProperyData`,
`colorProperyData`, `ColorProperyAnimation`, `blenshapeName`) are the Current
names; renaming them would break saved scenes.

## Deprecated

No surface is marked deprecated in the source.

## Experimental

No surface is designated Experimental in this revision.

## Removed

| Removed / never-shipped surface | Replacement |
|---|---|
| `EventResponseType.execute(...)`, `.eventType`, `.transformAnimation` (older README) | Configure the component's response arrays; trigger from code with `response(item, eventType)` |
| `EventType.OnTriggerStart` / `OnHoverStart` / `OnDown` / `OnMove` … (older README) | `EventType.HoverEnter`, `HoverExit`, `TriggerDown`, `TriggerUp` only |
| `new CallbackAction(() => …)` | `CallbackAction` is an Inspector typedef: `actionType`, `script`, `functionName`, `targetObjects` |
| `MaterialPropertyAnimation.materialPass` / `startValue` / `endValue` | `propertyName` + `valueType` + `start/end{Float,Vec3,Vec4}Value`; always `mainPass` |
| `AudioComponentControl.action` / `AudioAction` | `audioControlBehavior` 0/1/2 |
| `Scripts/GuideDismissPanel/GuideDismissPanel.ts` (old guide copy) | `Example/GuideDismissPanel/GuideDismissPanel.ts` (demo scaffolding used by the prefab) |

## Internal

- `Scripts/NativeTween` (`LSTween`, `Tween`, `Easing`, `mainGroup`) is the
  helper's own tween engine. It's resolvable, but not supported as a general
  tween API.
- `initialize()` is the OnStart hook; don't call it yourself.
- `Scripts/PlayOptions` is defined but not used by the component.
