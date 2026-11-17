# Body Mesh

## What it is
A package you drop into a Specs project to get a ready-made 3D body tracking setup: a native body tracking
configuration, a full-body mesh, its material and shader, and a camera-inclusive prefab. It is for developers
building pose-driven effects or attaching accessories to a person seen by the camera. Body tracking is provided by
native Lens components; the package ships no TypeScript tracking manager.

## What it does
- Drop `BodyMesh__PLACE_IN_SCENE.prefab` into the scene. It brings a Camera with World Device Tracking and the
  hierarchy `Camera` → `Effects` → `3D Body Tracking` (ObjectTracking3D) → `Body Mesh` (RenderMeshVisual).
- When a fully visible person is in the camera input, the native tracker follows their pose and proportions and the
  full-body mesh (body, head and both hands geometry) deforms with them.
- The tracking configuration defines 22 attachment labels (`Hips`, `Head`, `LeftHand`, `RightFoot`, ...), so your
  own scripts can attach accessories with the native `addAttachmentPoint` API.
- The prefab also carries an onboarding `Guide` ("Ok, I understood") that hides `3D Body Tracking` and the
  `ExampleCarousel` until dismissed; the carousel starts minimized.

## Highlights
- Native-only setup: no package import needed; read `isTracking()` on the ObjectTracking3D from your own script.
- Tracker object index and body mesh index are both 0 and must stay aligned for the single-body setup.
- `TrackHand` is off in the tracking configuration, while hand mesh geometry is still enabled.
- `Materials/Body Mesh.mat` uses the PBR `Shaders/body_mesh.graphShader` exposing `baseColor`, `metallic` and
  `roughness`.
- The demo guide and carousel never hide the Camera, so the scene keeps rendering.

## Core scripts
| Script | What it does |
|---|---|
| `3D Body Tracking.bodyTracking3D` | Native tracking asset (not a script): 22 attachment labels, hand tracking off. |
| `Mesh/Full Body Mesh.bodyMesh` | Native body mesh asset for body index 0. |
| `Materials/Body Mesh.mat` | Material for the mesh, backed by `Shaders/body_mesh.graphShader`. |
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | Demo guide panel that hides listed objects until "Ok, I understood" is pressed. |
| `Example/ExampleCarousel/ExampleCarousel.ts` | Demo carousel panel describing the example; starts minimized here. |

## Extra info
- **Requires:** InteractionKit, UIKit, Motion and Icons (used by the demo scripts in `Example/`; the native body
  setup needs none of them). Body acquisition must be verified on Specs: the Lens Studio Preview may never acquire a
  body, even with a full-body video. A visible person in the camera feed is not proof that the mesh is tracking.
- **Get started:** `BodyMesh__PLACE_IN_SCENE.prefab`. Keep its Camera, or unpack it and move `Effects` under your
  existing camera so only one camera renders. Delete `Guide` and `ExampleCarousel` for your own Lens.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md): camera ownership, index pairing and required hierarchy.
  - [api-status.md](api-status.md): what ships in this revision and known gaps.
  - [components.md](components.md): native components, assets, attachment labels and material defaults.
  - [examples.md](examples.md): reading tracking state and attaching an accessory to `Head`.
  - [troubleshooting.md](troubleshooting.md): missing body effect, Preview tracking and camera conflicts.
