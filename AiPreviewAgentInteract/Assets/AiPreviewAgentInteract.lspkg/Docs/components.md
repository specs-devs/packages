# AiPreviewAgentInteract components

[← Agent usage index](../README.md)

## Use when

Read when you need the exact public surface: the component, every command with its
fields and defaults, and the replies. Everything here comes from the package source.

## AgentInteractScript

Import: `import {AgentInteractScript} from "AiPreviewAgentInteract.lspkg/AgentInteractScript"`

- `@component`, extends `BaseScriptComponent`. **No `@input`s, no public members.**
- `onAwake` (editor only):
  1. starts loading the SIK hand rig for both hands (sets their `HandVisual` mesh type to Full).
  2. looks for `AgentInspectScript` on its own object, then on each parent.
  3. if found with a `publisher`, builds `InteractionHandler`, which subscribes the eight
     commands below on that publisher. If not, logs an error (Leaf logger
     `AgentInteractScript`) and returns.
- The hand interactors are created lazily on the first command for each hand. Creation
  retries for up to 120 frames while SIK registers its `HandInteractor`s and the rig loads.

## Targeting

Pinch, Hover, Poke and Drag take one of:

| Field | Meaning |
|---|---|
| `uniqueId` | `SceneObject.uniqueIdentifier` of the Interactable's object. Checked first. |
| `name` (+ `parentName`) | First Interactable whose object has this name (and whose direct parent has `parentName`). Used when `uniqueId` is missing or doesn't resolve. |
| `worldPosition` `{x, y, z}` | Free-space action at a point (cm). Used only when neither `uniqueId` nor `name` is given. No target validation. |

Before acting on a target, the handler checks:

1. it exists (`not_found`, with up to 40 available names);
2. it is enabled (`disabled`);
3. a scrollable ancestor's `ScreenTransform` contains its position (`clipped`);
4. a ray from the world camera to it hits the target, an ancestor, or something under a
   shared Interactable ancestor (`obstructed`, naming the blocker).

During a targeted Pinch, Poke or Hover the colliders of Interactable **ancestors** (for
example a UIKit ScrollWindow) are disabled, and the target's own colliders are enabled. Both
are restored afterwards.

## Commands (`AiPreviewAgentInteract.lspkg/AgentMessages`)

All commands have `type` and `commandId: string`. `handType` is `"left" | "right"`.

| Command | Fields (default) | What it does |
|---|---|---|
| `PinchCommand` `"Pinch"` | target; `handType` ("right"); `hold` (false); `durationMs` (none: release at once) | Pinch pose, approach from 4 cm in front of the target (along its `forward`), pinch down, wait for `onTriggerStart`; unless `hold`, pinch up and wait for `onTriggerEnd`. |
| `HoverCommand` `"Hover"` | target; `handType` ("right"); `durationMs` (200) | Relaxed pose, approach from 4 cm in front, wait for `onHoverEnter`, stay `durationMs`, retreat, wait for `onHoverExit`. With `worldPosition`: just move there and back. |
| `PokeCommand` `"Poke"` | target; `handType` ("right"); `durationMs` (200) | Relaxed index finger from 4 cm in front into the target, wait for `onTriggerStart`, retract along `forward`. |
| `DragCommand` `"Drag"` | target or free space; **`worldPosition`** (required, destination); `handType` ("right"); `durationMs` (1000); `hold` (false); `releaseMidDrag` (false) | Pinch the target with hold (skipped if this hand already holds it), move the fingertip linearly to `worldPosition`; unless `hold`, release at the end. `releaseMidDrag` releases at 80 % of the path (a throw) and overrides `hold`. |
| `GestureCommand` `"Gesture"` | **`handType`**; **`gesture`** `pinch \| fist \| palm \| backhand \| relaxed \| neutral`; `worldPosition` (optional); `durationMs` (500) | Move the hand (if given) and play the pose. It sends no pinch down / up to SIK; only the pose (and the pinch strength fed to SIK each frame) changes. |
| `ReleaseCommand` `"Release"` | **`handType`** | Pinch up on a holding hand. |
| `RotateCommand` `"Rotate"` | **`handType`**; **`rotation`** `{x, y, z}` degrees; `durationMs` (500) | Rotate a holding hand by the Euler delta; SIK manipulation turns the held object. |
| `WaitCommand` `"Wait"` | **`durationMs`** (≤ 60000) | Reply `CommandSuccess` after the delay (≤ 0: at once). |

After every action that ends a trigger (Pinch without hold, Poke on a target, Drag without
hold, Release) the reply waits 250 ms more so SIK can re-arm before the next command.

## Replies

- `CommandSuccessResponse {type: "CommandSuccess", commandId, resolvedUniqueId?, handState}`.
  `resolvedUniqueId` is set for targeted actions, and for Release / Rotate of a held object.
- `CommandErrorResponse` (from `AiPreviewAgentInspect.lspkg/AgentMessages`)
  `{type: "CommandError", commandId, message, reason, handState}`.
- `HandState {left, right}`, each `HandStateEntry {status: "free" | "holding", objectId?, objectName?}`.
  Free-space holds have no `objectId`.

| `reason` | Produced when |
|---|---|
| `not_found` | No Interactable matches `uniqueId` / `name`. The message lists available names. |
| `disabled` | The Interactable is disabled. |
| `clipped` | The target is outside a scroll view's visible area. |
| `obstructed` | Another collider is between the camera and the target. |
| `interactor_busy` | Pinch / Hover / Poke / Gesture on a holding hand; Drag on a hand holding something else; Release / Rotate on a free hand. |
| `invalid_params` | Missing target, non-finite vectors, unknown gesture, Wait over 60000 ms. |
| `internal_error` | Any exception, including a SIK event that didn't fire within 5 s (`Timed out waiting for onTriggerStart for "<name>" … SIK target at failure: "<name>"`). |

The `unreachable` reason exists in Inspect's shared union but is never produced here.

## Internal classes

`InteractionHandler`, `AiHandInteractor`, `AiBaseInteractor`, `Hand`, `TrackedHandWrapper`,
`requestHandRig`, `validateInteractable`: see [API status](api-status.md#internal-no-stable-api).

## Demo scaffolding (`Example/`)

These scripts ship in `AiPreviewAgentInteract.lspkg/Example/` and are wired inside
`AiPreviewAgentInteract__PLACE_IN_SCENE.prefab` (order: `AgentInspectScript`, Guide,
ExampleCarousel, `AgentInteractDemo`). They only present the demo; they are not part of
the hand-action bridge, and you don't need them in your own Lens.

| Object / script | Class | Key inputs |
|---|---|---|
| `Guide` — `Example/GuideDismissPanel/GuideDismissPanel.ts` | `GuideDismissPanel` | `hideUntilDismissed: SceneObject[]` — hidden until "Ok, I understood" is pressed (here: ExampleCarousel and AgentInteractDemo); `buttonLabel: string = "Ok, I understood"` (only used when the panel is built at runtime) |
| `ExampleCarousel` — `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (here only `AgentInteractDemo`, so no Previous / Next), `exampleInfo: string[]` (one line per example), `steps: SceneObject[]`, `stepInfo: string[] = []` (one line per step, same order as `steps`; empty entries fall back to the example info), `startIndex: number = 0`, `previousLabel: string = "Previous"` / `nextLabel: string = "Next"`, `examplesPushBack: number = 20`, `anchorExamples: boolean = true`, `startMinimized: boolean = false`, `extraPanelDrop: number = 0` |
| `Pinch target` / `Drag target` — `Example/InteractDemoTarget/InteractDemoTarget.ts` | `InteractDemoTarget` | `label: Text` (shows the counts), `title: string = "Pinch me"` (first label line). Counts the triggers, hovers and drags that reach the object's `Interactable` |

The `AgentInspectScript` object sits directly under the prefab root, outside
`AgentInteractDemo`, so the guide never hides the broker. The agent tools reuse this one
Inspect + Interact pair instead of adding an "AiPreviewAgent Handler" (keep a single
pair per scene).
