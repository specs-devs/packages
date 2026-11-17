# BodyMesh cheat sheet

[← Agent usage index](../README.md)

## Use when

Read first before adding or changing this package's body-tracking setup.

1. **The setup prefab includes its own Camera.** Keep it or move `Effects` under your existing compatible camera after unpacking; do not leave accidental duplicate cameras. → [Prefab recipe](examples.md#prefab-recipe)
2. **Preserve Camera → Effects → 3D Body Tracking → Body Mesh.** Native tracking and rendering live on different components; the package does not ship a TypeScript tracking controller. → [Native setup](components.md#native-setup)
3. **Tracker index and body mesh index are both zero.** Changing only one can pair a pose with the wrong body geometry. → [Tracking and mesh assets](components.md#tracking-and-mesh-assets)
4. **Use the exact attachment labels.** This configuration contains 22 labels, with all prefab attached-object slots initially null. `TrackHand: false` does not mean hand geometry is disabled. → [Attachment labels](components.md#attachment-labels)
5. **A person in the camera feed is not proof of a tracked mesh.** Check native tracking and deformation at two poses. The shipped material has a zero opacity property; diagnose it separately from tracking before changing visual style. → [Absent effect](troubleshooting.md#person-visible-but-no-body-effect)
6. **The prefab includes a demo guide and example carousel** (scripts in `Example/`). Delete `Guide` and `ExampleCarousel` for your own Lens. If your own guide hides content until dismissed, keep the Camera active (hide `3D Body Tracking`, not the Camera). → [Onboarding UI](troubleshooting.md#onboarding-ui-hides-the-camera)
7. **Read installed dependencies, not historical README names.** The declared companions are InteractionKit, UIKit, Motion, and Icons. → [Revision status](api-status.md)
8. **The Lens Studio Preview may never acquire a body.** Treat on-device testing as the only acquisition proof. → [Preview never tracks](troubleshooting.md#preview-never-tracks-a-body)
