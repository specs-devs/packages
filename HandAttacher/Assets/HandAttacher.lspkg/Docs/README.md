# Hand Attacher

## What it is
A package that makes any object follow one of the 25 Interaction Kit (SIK) hand joints of the left, right,
dominant or non-dominant hand. Use it for content that rides on the hand: fingertip cursors, rings, wrist displays
or hand-held tools. It only moves a transform; it does not detect gestures or make anything interactable.

## What it does
- Add the `HandAttacher` component and pick a `targetObject` (defaults to its own object), a `handSide` and a
  `handJoint` (default `indexTip` on the right hand).
- Every frame it writes the joint's world position and/or rotation to the target, plus a `positionOffset` and
  `rotationOffset` in the joint's local space. The target is not reparented to the hand.
- Position and rotation are smoothed with separate lerp / slerp speeds; the first write after the hand is found
  snaps straight to the joint.
- With `hideWhenNotTracked`, the target is disabled while the hand is not tracked and shown again when it returns.
- In the demo prefab, a 3 cm box sits on the right index fingertip once the guide panel is dismissed.

## Highlights
- 25 joints through the `HandJoint` enum: the wrist plus base, knuckle, mid and tip joints of each finger, and an
  upper joint on every finger except the thumb.
- `HandSide` covers `left`, `right`, `dominant` and `nondominant`.
- Follow position only, rotation only, or both (`enablePosition`, `enableRotation`).
- Reconfigure at runtime with `setHand()`, `setJoint()`, `setTarget()`, `setPositionOffset()` and
  `setRotationOffset()`; `isHandTracked()` reports the tracking state.
- Swapping hands with `setHand()` moves the found / lost subscriptions to the new hand.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/HandAttacher.ts` | The `HandAttacher` component and the `HandSide` / `HandJoint` enums. |
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | Demo guide panel; keeps the demo hidden until "Ok, I understood". |
| `Example/ExampleCarousel/ExampleCarousel.ts` | Demo carousel panel that frames the example. |

## Extra info
- **Requires:** InteractionKit, Utilities and SnapDecorators (imported by the script), plus UIKit, Motion and
  Icons for the demo. The scene needs the InteractionKit prefab, since hand data comes from `SIK.HandInputData`.- **Get started:** `HandAttacher__PLACE_IN_SCENE.prefab` in a Specs scene with a Camera and the InteractionKit
  prefab. Import the component from `HandAttacher.lspkg/Scripts/HandAttacher`.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - load-bearing rules; read first
  - [components.md](components.md) - `HandAttacher`, `HandSide`, `HandJoint`: inputs, defaults, methods
  - [api-status.md](api-status.md) - current, inert and internal members
  - [examples.md](examples.md) - prefab path and compiling snippets
  - [guide.md](guide.md) - longer recipes (tools, fingertip UI, wrist display, rings) and tuning tips
  - [troubleshooting.md](troubleshooting.md) - package-specific symptoms and fixes
