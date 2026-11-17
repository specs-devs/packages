<p align="center">
  <img src="Docs/media/WorldQueryHit.png" width="250px" alt="WorldQueryHit"/>
</p>

# WorldQueryHit

WorldQueryHit combines WorldQueryModule hit testing and SpectaclesInteractionKit targeting to preview and copy SceneObjects onto detected surfaces. It includes semantic classification consumers, a billboard label and both TypeScript and JavaScript variants. Available categories and refined hits depend on the actual runtime.

## Usage

This section ships with the package and describes the exact installed revision. Generic Lens scripting, scene construction and SPECS spatial design live in the CLAD skills; package-specific inputs, lifecycle and behavior live here.

### Package identity

- Descriptor: `package.native`.
- Consumer import prefix: `WorldQueryHit.lspkg/Scripts/`.
- Companion dependencies: SnapDecorators, SpectaclesInteractionKit, Utilities, SpectaclesUIKit, Motion and Icons (`package_dependencies.json`). The `Scripts/` placement and classification scripts import SnapDecorators, SpectaclesInteractionKit and Utilities; the `Example/` demo scaffolding (guide and carousel) imports SpectaclesInteractionKit and SpectaclesUIKit. Motion and Icons are not imported.
- Entry prefab: `WorldQueryHit__PLACE_IN_SCENE.prefab`. It is self-contained: a guide panel (`Guide`), an `ExampleCarousel` and the `World Query Hit` example group, so dropping it into an empty SPECS scene (Camera + SIK) gives the full demo. The carousel starts minimized; pinch **Ok, I understood** on the guide to show the example.
- Demo scaffolding: `WorldQueryHit.lspkg/Example/` holds the guide and carousel scripts (`Example/GuideDismissPanel`, `Example/ExampleCarousel`) used only by the prefab. They are not WorldQueryHit API (see [components](Docs/components.md)); delete `Guide` / `ExampleCarousel` from your copy of the prefab if you only want the placement example.
- Built-in module: `require("LensStudio:WorldQueryModule")`; this is not a separately shipped package class.

### Version and API status

Read [API status](Docs/api-status.md) for exported names, TS/JS differences and runtime capability gaps.

### Applicability

Use this example for hand/controller-ray surface placement and semantic labels; its content is world-anchored (cursor and copies sit on real surfaces), so don't re-anchor it to the head. Use HitTestClassification when only classification events are needed. Category filtering affects labels, not placement permission. Actual environmental hits require supported WorldQuery tracking data; static source checks cannot establish it.

### Related CLAD skills

[specs-world-query](https://github.com/lens-studio-devs/ls-extensions/blob/main/plugins/ls-clad/skills/specs-world-query/SKILL.md). These skills cover the surrounding Lens workflow.

[Install CLAD](https://developers.specs.com/docs/clad/setup/setup-ai/) or browse its [source](https://github.com/lens-studio-devs/ls-extensions). Read the installed package docs for this revision’s APIs.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md): read first for names, wiring and placement limits.
- [Components](Docs/components.md): read when importing TS or wiring JS script inputs/public APIs.
- [Lifecycle and placement](Docs/lifecycle.md): read when handling freshness, smoothing, copies and runtime configuration.
- [Examples](Docs/examples.md): read when placing the prefab or consuming classification.
- [API status](Docs/api-status.md): read when comparing variants or category support.
- [Troubleshooting](Docs/troubleshooting.md): read when cursor, labels or selection behave unexpectedly.
- [Human tutorial](Docs/guide.md): preserved long-form background and historical examples with caveats.

### Verification

1. Compile clean with the installed companions; the TS placement class is `NewScript` (`Scripts/WorldQueryHitExampleTS`), no `as any` needed in consumers.
2. Preview: the Lens starts with no errors, `Objects to spawn [EDIT]` and the label stay hidden, `Plane` stays disabled, and nothing renders at the user's origin.
3. Preview: pinching your own UI buttons never creates a copy of the selected object.
4. Device: point at floor, wall and table. The cursor follows the surface aligned to its normal, the label names the category in its color, and releasing a pinch leaves a copy at the cursor pose.
5. Device: look away / lose the hand, then pinch. No copy is placed at the last position.

## Built with 👽 by the SPECS team








