# Face Mesh

## What it is
A package you drop into a Specs project to render a textured face mesh on a tracked face and to make objects follow
other objects. It ships a native face-mesh prefab (camera, light and Head Binding) and a reusable component,
`MatchTransformTS`, that follows an explicitly assigned target. It is for developers building face effects or
attaching content to tracked points.

## What it does
- Drop `FaceMesh__PLACE_IN_SCENE.prefab` into a scene with no other camera. It brings a `Camera` with World Device
  Tracking, an `AmbientLight`, and `Effects` → `Head Binding` (face index 0) → `Face Mesh`.
- When a face is tracked, the Head Binding follows it and the mesh renders a white, soft-edged mask with eye and
  mouth openings over the face.
- Add `MatchTransformTS` to any object and assign `target`: every frame it follows the target's world position
  (plus a world-space `positionOffset`), rotation and scale, with per-axis constraints and separate smoothing.
- The prefab also carries an onboarding `Guide` that hides `Effects` and the `ExampleCarousel` until
  "Ok, I understood" is pressed; the carousel starts minimized.

## Highlights
- Self-contained prefab: every mesh, material, shader and texture lives inside `FaceMesh.lspkg/`.
- The face shader is lit PBR, so the `AmbientLight` is load-bearing; unlit, the mesh renders black and is invisible
  on Specs.
- `MatchTransformTS` constrain flags preserve the follower's current axis value rather than zeroing it.
- Position smoothing can be turned off (`usePositionLerp`) for immediate following; rotation and scale always lerp.
- The follower has no default target and no landmark discovery; use native `Head` components set to an
  `AttachmentPointType` as targets for face points.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/MatchTransform.ts` | `MatchTransformTS`: follows a target's position, rotation and scale with per-axis constraints and lerp speeds. |
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | Demo guide panel that hides listed objects until "Ok, I understood" is pressed. |
| `Example/ExampleCarousel/ExampleCarousel.ts` | Demo carousel panel describing the example; starts minimized here. |

## Extra info
- **Requires:** SnapDecorators, Utilities, InteractionKit, UIKit, Motion and Icons. The main camera needs a World
  Device Tracking component (the prefab's `Camera` has one). In the Lens Studio Preview, use Multimedia input with a
  face video; interactive scenes contain no face.
- **Get started:** `FaceMesh__PLACE_IN_SCENE.prefab`. If your scene already has a camera, unpack the prefab, move
  Device Tracking, `AmbientLight` and `Effects` onto your camera and delete the prefab's `Camera`. Toggle `Effects`,
  not the prefab root or `Camera`, to hide the effect. Delete `Guide` and `ExampleCarousel` for your own Lens.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md): camera, lighting, target and coordinate rules.
  - [api-status.md](api-status.md): prefab contents, follower behavior and verification gaps.
  - [components.md](components.md): every `MatchTransformTS` input and the prefab hierarchy.
  - [examples.md](examples.md): a minimal follower consumer and toggling the effect.
  - [guide.md](guide.md): offset, axis-constraint and face-point follower recipes.
  - [troubleshooting.md](troubleshooting.md): black or missing mesh, start errors and follower drift.
