<p align="center">
  <img src="Docs/media/HandAttacher.png" width="250px" alt="HandAttacher"/>
</p>

# Hand Attacher 

Hand Attacher makes an object follow one of the 25 SIK hand joints (wrist,
knuckles, mid/upper joints, tips) of the left, right, dominant or non-dominant
hand. The object is not parented to the hand: it follows the joint in world
space, with an optional joint-local position/rotation offset, optional
smoothing, and automatic hiding while the hand is not tracked.

## Features

- **25 Joint Support**: wrist plus base, knuckle, mid and tip joints of each finger, and an upper joint on every finger except the thumb
- **Hand Side Selection**: left, right, dominant or non-dominant hand
- **Joint-Local Offsets**: position and rotation offsets in the joint's local space
- **Smooth Interpolation**: separate lerp/slerp speeds for position and rotation
- **Tracking State Awareness**: hide the object while the hand is not tracked
- **Selective Updates**: follow only position or only rotation
- **Runtime Reconfiguration**: switch hand, joint and offsets from script

## Usage

This section ships with the package and describes the exact installed revision.
Read it, then follow the links into `Docs/` for the topic you need. It is
written for both people and coding agents; generic Lens scripting, scene
construction, and Specs spatial design are out of scope here.

### Package identity

- Package descriptor: `HandAttacher.lspkg/package.native` (holds the package version)
- Consumer import prefix: `HandAttacher.lspkg/Scripts/` — the component is
  `HandAttacher.lspkg/Scripts/HandAttacher` (not `HandAttacher.lspkg/HandAttacher`).
  See [components](Docs/components.md).
- Prefab entry point: `HandAttacher__PLACE_IN_SCENE.prefab` (a 3 cm box on the
  right index fingertip). It is self-contained: drop it into a Specs scene
  (Camera + SIK) and you get the guide, the example carousel and the demo
  (`HandAttacherDemo` group).
- Demo scaffolding: `HandAttacher.lspkg/Example/` holds `ExampleCarousel` and
  `GuideDismissPanel`. The prefab uses them to present the demo; the
  HandAttacher script doesn't depend on them.
- Required companion packages (`package_dependencies.json`):
  `InteractionKit`, `Utilities` and `SnapDecorators`
  (imported by the script), plus `UIKit`, `Motion` and
  `Icons`. The scene needs the SIK prefab, since hand data comes from
  `SIK.HandInputData`.

### Version and API status

Read [API status](Docs/api-status.md) before reusing an older Hand Attacher
example. It lists the Current surface and the members that exist but are
inert or internal in this revision.

### Applicability

Use Hand Attacher to make content ride on a hand joint: fingertip cursors,
rings, wrist displays, hand-held tools. It only moves a transform. It does not
detect gestures (use SIK's hand events), make anything interactable (SIK
`Interactable`), or place UI on the palm with a hand-menu layout (SIK / UIKit).

### Hand-tracking permission (upcoming)

Hand Attacher reads raw hand-joint positions and rotations every frame
(through `SIK.HandInputData`). An upcoming Specs OS release treats raw
hand-joint data as sensitive and gates it behind an explicit user permission,
so a Lens that uses Hand Attacher is expected to show a one-time permission
prompt, and joint data (and so the attachment) is unavailable until the user
allows it. Basic gestures (pinch, poke, grab) are not expected to need the
prompt. The release and the exact behavior are not final yet; this package
will be updated when they are. Until then, plan for the prompt: keep
`hideWhenNotTracked` on, and if the Lens must stay usable when the user
declines, don't make its core flow depend on hand-attached content.

### Package Docs (ship in `Docs/`)

Lens Studio auto-extracts these files into the project's install Cache on
import, so an agent can read them there. Treat only the members documented
here as supported API; never guess an import path.

- [cheat sheet](Docs/cheat-sheet.md) - load-bearing rules; read first
- [components](Docs/components.md) - `HandAttacher`, `HandSide`, `HandJoint`: inputs, defaults, methods
- [API status](Docs/api-status.md) - Current / Deprecated / Experimental / Removed / Internal
- [minimal examples](Docs/examples.md) - prefab path and compiling snippets
- [guide and recipes](Docs/guide.md) - longer patterns (tools, fingertip UI, wrist display, rings) and tuning tips
- [troubleshooting](Docs/troubleshooting.md) - package-specific symptoms and fixes

### Verification

1. Compile with no TypeScript errors and no `as any`; the import is
   `HandAttacher.lspkg/Scripts/HandAttacher`.
2. Preview with the SIK prefab in the scene: before any hand is tracked, the
   target is hidden (with `hideWhenNotTracked`), not sitting at the origin.
3. Raise the configured hand: the target sits on the chosen joint, offset in the
   joint's local space, and follows it when the hand moves.
4. If you swap hands at runtime, call `setHand()` and confirm that only the new
   hand's found/lost events toggle the target.

## Built with 👽 by the SPECS team <!-- --> <!-- --> <!-- --> <!-- -->

---

[See more packages](https://github.com/specs-devs/packages)

  
