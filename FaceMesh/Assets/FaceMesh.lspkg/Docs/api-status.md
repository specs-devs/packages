# FaceMesh api-status

[← Agent usage index](../README.md)

## Use when

Check exact installed behavior and verification gaps before relying on the prefab or the follower.

| Status | API / behavior | Evidence / limit |
| --- | --- | --- |
| Current | MatchTransformTS | `Scripts/MatchTransform.ts`; generic, explicitly assigned target |
| Current | onAwake/onStart/onUpdate | SnapDecorators binds Start and Update; no external ready or tracking event |
| Current | Native face prefab | Plain root → Guide, ExampleCarousel (demo scaffolding, scripts in `Example/`), Camera + DeviceTracking (World) → AmbientLight, Effects/Head Binding (face index 0)/Face Mesh; all mesh/material/shader/texture assets inside `FaceMesh.lspkg/`. MatchTransformTS is not attached in this prefab |
| Deprecated | None declared | No aliases or explicit migration removals |
| Experimental | Hierarchy-independent scale matching | Source mixes target world scale with follower local scale |
| Changed | Guide and carousel | The prefab's old `GUIDE_ReadAndDisable` is gone; the prefab now carries the onboarding `Guide` (`Example/GuideDismissPanel/`) and the `ExampleCarousel` (`Example/ExampleCarousel/`). The camera moved from the prefab root to its `Camera` child |

No mainCamera fallback, landmark discovery or tracking-loss handler exists in MatchTransformTS. Position lerp factor is capped above at 1, rotation slerp factor is not capped, and scale lerp is capped above at 1. Negative speeds are not validated.

Verified 2026-10-01 in the Lens Studio Preview (SPECS 27, InteractionKit): the prefab compiles and runs without errors, and over the `Idle/Facial Expressions` face video the mesh tracks the face and renders the white soft-edged mask. Not verified: on-device rendering, multiple faces, and the MatchTransformTS recipes in [guide.md](guide.md).
