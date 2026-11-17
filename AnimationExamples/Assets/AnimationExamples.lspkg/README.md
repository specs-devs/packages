# AnimationExamples

Eight focused Specs examples for `AnimationPlayer`: scale, keyframed depth, opacity callbacks, finish events, timestamp events, authored assets, an existing player, and frame sizing. Each prefab contains a UIKit Frame, an AnimationPlayer, and its example script. The manager instantiates and cycles through them at runtime.

Read the [longer guide](Docs/guide.md) for the original tutorial and background.

## Usage

This section ships with the package and describes the exact installed revision. Generic Lens scripting, scene construction, and Specs spatial design are out of scope here.

### Package identity

- Descriptor: `package.native` (holds the package version).
- Consumer import prefix: `AnimationExamples.lspkg/Scripts/`.
- Place-in-scene prefab: `AnimationExamples.lspkg/AnimationExamples__PLACE_IN_SCENE.prefab`. The prefab is self-contained: besides the `Examples` object (AnimationExamplesManager with the eight example prefabs) it carries the guide panel ("Ok, I understood") and the example carousel (Previous / Next / minimize), so dropping it into a Specs scene with a Camera and SIK gives the full demo.
- Demo scaffolding: `AnimationExamples.lspkg/Example/` holds the scripts the prefab uses for the guide and the carousel (`ExampleCarousel/`, `GuideDismissPanel/`). They are not part of the animation examples; see [components](Docs/components.md#demo-scaffolding-example).
- Declared companion packages: SnapDecorators, UIKit, InteractionKit, Motion, Icons (see `package_dependencies.json`). The examples import `UIKit.lspkg/...` (Frame, Button, ThemeService) and `SnapDecorators.lspkg/assert` (`ExistingPlayerExample`, `TweenExamples`); the `Example/` demo scripts also import `InteractionKit.lspkg/...`.

### Version and API status

[API status](Docs/api-status.md) lists the supported components, helper exports, and known evidence gaps for this revision.

### Applicability

Use this package to learn or reuse AnimationPlayer curve, clip, and event patterns for UIKit content. Use a dedicated interaction or layout package for non-animation UI behavior. `TweenExamples` is a source walkthrough; the eight focused example prefabs are the runnable demonstrations.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md): read first for setup and lifecycle rules.
- [Components](Docs/components.md): read for exact import paths, inputs, and manager methods.
- [Examples](Docs/examples.md): read to instantiate the prefab or drive its manager.
- [API status](Docs/api-status.md): read before relying on tutorial-only or unverified behavior.
- [Troubleshooting](Docs/troubleshooting.md): read when playback, placement, or preview input behaves unexpectedly.
- [Guide](Docs/guide.md): read for the longer animation tutorial.

### Verification

1. Compile with the installed package imports and explicit component types.
2. Confirm the manager reports eight spawned instances and Next/Previous changes the active one.
3. Confirm every example appears in front of the wearer and replay its TAP button.
4. Observe transform or opacity/frame-size changes at two timestamps; check finish and midpoint events with logging enabled.
5. Confirm the authored asset slot is configured when checking authored playback; an empty slot invokes a fallback.

Built with 👽 by the SPECS team.

---

[See more packages](https://github.com/specs-devs/packages)

