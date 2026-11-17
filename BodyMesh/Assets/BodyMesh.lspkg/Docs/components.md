# BodyMesh components

[← Agent usage index](../README.md)

## Use when

Inspect or wire the prefab's native assets and components.

## Native setup

The prefab asset is `BodyMesh.lspkg/BodyMesh__PLACE_IN_SCENE.prefab`. Its surviving hierarchy is:

```text
BodyMesh__PLACE_IN_SCENE
├─ Guide [Frame, GuideDismissPanel]        (demo scaffolding)
├─ ExampleCarousel [ExampleCarousel]       (demo scaffolding)
└─ Camera [Camera, DeviceTracking]
   └─ Effects
      └─ 3D Body Tracking [ObjectTracking3D]
         └─ Body Mesh [RenderMeshVisual]
```

These native components do not require a package TypeScript import. The Camera renders to `BodyMesh.lspkg/Render/Render Target.renderTarget`. `Guide` and `ExampleCarousel` are [demo scaffolding](#demo-scaffolding-example).

| Component | Serialized setup defaults |
|---|---|
| Camera | Perspective, render order 0, render layer mask 1, near 1, far 1000, FOV about 63.541 degrees; clear color None and clear depth Value 1. The included Camera is authored at `(0, 0, 40)` cm. |
| DeviceTracking | World mode. |
| ObjectTracking3D | `objectIndex: 0`, `trackingMode: ProportionsAndPose`, `trackPosition: true`, tracking asset `3D Body Tracking.bodyTracking3D`; all 22 attached-object slots start null. |
| RenderMeshVisual | Mesh `Mesh/Full Body Mesh.bodyMesh`, material `Materials/Body Mesh.mat`, render order 0, blend shapes enabled, blend normals disabled, skin null. |

The native runtime component exposes `isTracking()` and attachment-point operations through Lens API; the package adds no custom methods, properties, or event wrapper around it. Use the [examples](examples.md) for a typed observer and a configured label.

## Tracking and mesh assets

| Asset | Serialized values |
|---|---|
| `3D Body Tracking.bodyTracking3D` | 22 hierarchical attachment points; `TrackHand: false`; `TrackingScope: null`. |
| `Mesh/Full Body Mesh.bodyMesh` | `BodyIndex: 0`; body, head, left hand, and right hand geometry enabled; `TrackingScope: null`; external mesh null. |
| External mesh options | External pose TPose, matching mode Proximity, matching maximum distance 0.5 and count 3, identity external transform, UV map Texcoord0. These stored options do not establish a configured external mesh. |

Body tracking and native mesh body indices are separate serialized settings; align them if you change the selected body.

## Attachment labels

The exact labels and parent labels in the tracking asset are:

| Label | Parent |
|---|---|
| Hips | None |
| Spine | Hips |
| Spine1 | Spine |
| Spine2 | Spine1 |
| Neck | Spine2 |
| Head | Neck |
| LeftShoulder | Spine2 |
| LeftArm | LeftShoulder |
| LeftForeArm | LeftArm |
| LeftHand | LeftForeArm |
| RightShoulder | Spine2 |
| RightArm | RightShoulder |
| RightForeArm | RightArm |
| RightHand | RightForeArm |
| LeftUpLeg | Hips |
| LeftLeg | LeftUpLeg |
| LeftFoot | LeftLeg |
| LeftToeBase | LeftFoot |
| RightUpLeg | Hips |
| RightLeg | RightUpLeg |
| RightFoot | RightLeg |
| RightToeBase | RightFoot |

`TrackHand: false` in the tracking configuration and enabled left/right hand *mesh geometry* are different settings. Do not promise detailed hand tracking from geometry flags.

## Material and shader

`BodyMesh.lspkg/Materials/Body Mesh.mat` references `BodyMesh.lspkg/Shaders/body_mesh.graphShader`. The graph exposes `baseColor`, `metallic`, and `roughness` and routes its PBR node to the graph's final color.

Serialized material defaults include white `baseColor`, metallic 0, roughness 0, white emissive/AO/specular-AO properties, `Port_Opacity_N023: 0`, and `PreviewEnabled: 0`. Depth test/write are enabled; blend mode is Disabled and culling is Back. These are source values, not a claim that changing a single property guarantees visible rendering. Use a project material instance when experimenting, and verify real native tracking separately.

## Demo scaffolding (Example/)

Demo-only scripts shipped in `BodyMesh.lspkg/Example/` so the prefab works on its own. They aren't part of the package API. The prefab root holds, in order, `Guide`, `ExampleCarousel` and `Camera`. Remove `Guide` and `ExampleCarousel` when you build your own Lens.

| File | Used by | Key inputs |
|---|---|---|
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | `Guide` | `buttonLabel` (`"Ok, I understood"`), `hideUntilDismissed: SceneObject[]` (`3D Body Tracking`, `ExampleCarousel`): hidden while the guide shows, enabled when it's closed. The Camera is not listed, so the scene keeps rendering. |
| `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (`3D Body Tracking`), `exampleInfo: string[]`, `steps: SceneObject[]` (empty), `stepInfo: string[]` (empty; one line per step, same order as `steps`, an empty entry falls back to the step's example info), `startIndex` (`0`), `previousLabel` / `nextLabel`, `examplesPushBack` (`20` cm), `anchorExamples` (`false`, the tracked body mesh stays on the person), `startMinimized` (`true`), `extraPanelDrop` (`10` cm) |

Values in parentheses are the prefab's; the script defaults differ for `anchorExamples` (`true`), `startMinimized` (`false`) and `extraPanelDrop` (`0`).

With a single example the carousel shows only its title, the description and the minimize button; Previous / Next appear when `examples` lists more than one object.
