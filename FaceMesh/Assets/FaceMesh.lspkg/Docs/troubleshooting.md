# FaceMesh troubleshooting

[← Agent usage index](../README.md)

## Use when

Diagnose a missing or black face mesh, Lens start errors, stationary followers and transform drift.

| Symptom | Cause to check | Fix |
| --- | --- | --- |
| Lens stops at start: "Your main camera is currently missing a 'Device Tracking Component'", then "Rendering failed 5 times in a row" | Main camera without DeviceTracking (older prefab revisions, or your own camera) | Add DeviceTracking (World) to the single main camera; this revision's prefab `Camera` has it |
| Face is tracked (Head Binding moves) but no mesh is visible on Specs | Lit PBR shader with no light renders black, and black is transparent on the additive display | Keep the prefab's `AmbientLight`, or light the mesh's layer yourself |
| Mesh missing or untextured after importing the package | Older revisions referenced a material/facemesh outside the package folder, and the package material's mask texture was missing | Use this revision: the prefab points at `Materials/Face Mesh.mat` and `Meshes/Face Mesh.facemesh` inside the package |
| Everything goes black when hiding the effect | The prefab root or its `Camera` was disabled | Disable `Effects` or `Head Binding` instead |
| Nothing on the face in the Preview | Interactive Preview scenes contain no face | Switch the Preview to Multimedia with a face video (e.g. `Idle/Facial Expressions`) |
| Two cameras render / doubled content | Prefab camera added next to an existing camera | Unpack the prefab and keep one camera (see [Components](components.md)) |
| Camera renders nowhere in a new project | The prefab camera renders to `FaceMesh.lspkg/Render/Render Target.renderTarget`, not your project's output target | Point the prefab camera at your project's render target (or set that render target as the project output) |
| Follower stays still | target unset or target has not moved | Assign target explicitly; no mainCamera fallback exists |
| Follower created from code does nothing | `createComponent("Component.ScriptComponent")` makes an empty ScriptComponent | Use `createComponent(MatchTransformTS.getTypeName())` |
| Offset does not rotate with head | Offset is applied in world axes | Compute a rotated world offset in your consumer if needed |
| Follower scales twice under parent | Target world scale written to local scale | Keep parent scale identity or verify an explicit conversion before modifying source |
| Tracking disappears but follower stays | No tracking-loss handling in follower | Gate follower behavior from native tracking state in consumer |
| Locked axis seems frozen | constrain flag preserves current value | Disable only the axes that should match target |
| Rotation jumps at high speed | Unclamped slerp factor and Euler constraints | Test sensible positive speeds and constraint transitions |

The native prefab contains no MatchTransformTS component, so changing the follower script alone does not alter the built-in face-mesh setup.
