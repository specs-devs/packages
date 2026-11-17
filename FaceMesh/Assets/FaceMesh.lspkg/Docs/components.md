# FaceMesh components

[← Agent usage index](../README.md)

## Use when

Wire every MatchTransformTS input and preserve native prefab assets.

## MatchTransformTS

Import `FaceMesh.lspkg/Scripts/MatchTransform`.

| Input | Type / default | Meaning |
| --- | --- | --- |
| target | SceneObject / unset | Required for movement; absent target returns from Update |
| positionOffset | vec3 / (0,0,0) | Added to target world position |
| usePositionLerp | boolean / true | Position smoothing enabled |
| positionLerpSpeed | number / 1 | Position factor=min(1,speed*deltaTime) |
| rotationLerpSpeed | number / 1 | World rotation slerp factor=speed*deltaTime |
| scaleLerpSpeed | number / 1 | Scale lerp factor=min(1,speed*deltaTime) |
| constrainPositionX/Y/Z | boolean / false each | Preserve current corresponding world-position axis |
| constrainRotationX/Y/Z | boolean / false each | Preserve current corresponding Euler rotation axis before quaternion conversion |
| constrainScaleX/Y/Z | boolean / false each | Preserve current corresponding local-scale axis |
| enableLogging | boolean / false | Missing-target warning and general logs |
| enableLoggingLifecycle | boolean / false | Lifecycle logs, including every Update |

Public methods: `onAwake(): void`, `onStart(): void`, `onUpdate(): void`. Transform-update helpers are private; there is no match()/setTarget()/tracking event API. Runtime configuration uses the public input fields. onAwake creates Utilities Logger, Start warns for missing target when logging is enabled, and Update does nothing without target.

Position uses target and follower world positions. Rotation converts current/target world quaternions via Utilities MathUtils.quaternionToEuler, preserves selected axes, reconstructs with quat.fromEulerAngles and slerps. Scale reads target world scale but follower local scale, then writes local scale.

## Native prefab/assets

`FaceMesh__PLACE_IN_SCENE.prefab` (everything it references lives inside `FaceMesh.lspkg/`):

```text
FaceMesh__PLACE_IN_SCENE
├─ Guide [Frame, GuideDismissPanel]        (demo scaffolding)
├─ ExampleCarousel [ExampleCarousel]       (demo scaffolding)
└─ Camera [Camera, DeviceTracking]
   ├─ Effects
   │  └─ Head Binding [Head]
   │     └─ Face Mesh [RenderMeshVisual]
   └─ AmbientLight [LightSource]
```

| Object | Components | Notes |
| --- | --- | --- |
| `FaceMesh__PLACE_IN_SCENE` (root) | none | Plain group at the origin holding the demo scaffolding and the camera |
| `Camera` | Camera, DeviceTracking (World) | The scene camera. Perspective, renders to `FaceMesh.lspkg/Render/Render Target.renderTarget`. InteractionKit requires the DeviceTracking component on the main camera |
| `Camera / AmbientLight` | LightSource (Ambient, intensity 1, white, layer 1) | Lights the PBR face shader; without a light the mesh renders black, which is invisible on Specs |
| `Camera / Effects / Head Binding` | Head (HeadCenter, face index 0) | Follows the first tracked face |
| `Camera / Effects / Head Binding / Face Mesh` | RenderMeshVisual | Mesh `Meshes/Face Mesh.facemesh`, material `Materials/Face Mesh.mat` |

`Materials/Face Mesh.mat` uses `Shaders/face_mesh.graphShader` (PBR lit, Smooth Edges + Face + Base Texture defines) with `baseTex = Textures/Base.png` and `maskTex = Textures/FaceMeshTexture.jpg` (white face with soft edges and eye/mouth openings). The Face Mesh asset enables face geometry and eye corners; eyes/mouth/skull/ears geometry are disabled.

The prefab owns the camera: "UnpackUseYourCamera" means unpack it and move DeviceTracking/AmbientLight/Effects onto your own camera if your scene already has one, then delete the prefab's `Camera`, so the scene keeps exactly one main camera. MatchTransformTS is not attached anywhere in the prefab. `Guide` and `ExampleCarousel` are [demo scaffolding](#demo-scaffolding-example).

## Demo scaffolding (Example/)

Demo-only scripts shipped in `FaceMesh.lspkg/Example/` so the prefab works on its own. They aren't part of the package API. The prefab root holds, in order, `Guide`, `ExampleCarousel` and `Camera`; the guide and carousel sit outside the camera, so they stay where they were placed instead of following the head. Remove `Guide` and `ExampleCarousel` when you build your own Lens.

| File | Used by | Key inputs |
|---|---|---|
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | `Guide` | `buttonLabel` (`"Ok, I understood"`; only used in text-only mode, see below), `hideUntilDismissed: SceneObject[]` (`Effects`, `ExampleCarousel`): hidden while the guide shows, enabled when it's closed. The Camera is not listed, so the scene keeps rendering. |
| `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (`Effects`, shown with the title "Effects"), `exampleInfo: string[]`, `steps: SceneObject[]` (empty), `stepInfo: string[]` (empty; text per step, in the same order as `steps`, empty entries fall back to the example's info), `startIndex` (`0`), `previousLabel` / `nextLabel`, `examplesPushBack` (`20` cm), `anchorExamples` (`false`, the face mesh stays on the tracked face), `startMinimized` (`true`), `extraPanelDrop` (`0` cm) |

GuideDismissPanel has two modes. Authored (what the prefab uses): the `Guide` object carries a UIKit `Frame` with a child Text (`GuideText`) and a child UIKit Button (`OkButton`); the script places the panel in front of the user, fits the frame to the text and closes the guide when the button is pressed, so `buttonLabel` has no effect (edit the button's own label). Text-only: when the object has no `Frame`, the script builds the Frame, a copy of the child Text and a button labelled `buttonLabel` at runtime. In both modes `hideUntilDismissed` objects are disabled on awake and re-enabled when the guide closes.

With a single example the carousel shows only its title, the description and the minimize button; Previous / Next appear when `examples` lists more than one object.
