# AnchorExamples cheat sheet

[← Agent usage index](../README.md)

## Use when

Read first before changing the installed package.

1. Import the reusable controller from `AnchorExamples.lspkg/Scripts/AnchorController`; it is a singleton helper, not a script component. → [API](components.md)
2. Open the area session before create/save/resolve; persist `Anchor.id` only after saving succeeds. → [Examples](examples.md)
3. Track the parent with `track(parent, anchor)` and save children in parent-local coordinates. Tracking state belongs to AnchorComponent, not Anchor. → [API status](api-status.md)
4. Preview simulates remembered layouts; native anchor mapping, relocalization and uncertainty require Specs hardware. → [Troubleshooting](troubleshooting.md)
5. Use `AnchorExamples__PLACE_IN_SCENE.prefab` for the full app; keep SIK in the host scene and preserve the supplied widget references. → [Components](components.md)
6. The demo uses System 3.0 UIKit and awaits deferred startup. Note prefab must reference the installed TextInputField asset. → [Troubleshooting](troubleshooting.md)
7. Surface snapping tracks newly spawned widgets, not all existing ones; only the active right-hand interactor supplies hits. → [Components](components.md)
8. Minimize is temporary. Release restores the original local transforms; exit saves the current widget transforms. → [Examples](examples.md)
9. Show anchored content only while `Tracking` and inside an uncertainty budget; `PersistentAnchorExample` is the minimal reference. Anchors are immutable: move = create + save + delete. → [Examples](examples.md)
10. `getGeoPosition` answers for Custom Location anchors only, needs the user's location permission, and needs no tracker. → [API status](api-status.md)
