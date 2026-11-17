# AnchorExamples

AnchorExamples persists content in named real-world areas on Specs using native AnchorModule sessions and AnchorComponent tracking. `Scripts/AnchorController.ts` is the reusable controller; the supplied prefab contains a complete local storage and Note/Watch/Photo widget demo.

## Features

- Open one anchor session per area; create, save, resolve and delete anchors.
- Track a SceneObject through AnchorComponent state and uncertainty events.
- Show content only while its anchor is tracking within an uncertainty budget, and restore it next launch by stored id or nearby discovery (`Examples/Native/PersistentAnchorExample.ts`).
- Read the latitude / longitude of a Custom Location anchor through AnchorLocationModule.
- Store widget transforms relative to the anchored parent.
- Preview remembered-pose simulation, with real anchors verified on hardware.
- UIKit demo screens, keyboard note fields, clocks, static photos and surface snapping.

## Usage

This section ships with the package and describes the exact installed revision. Generic Lens scripting, scene construction and Specs spatial design are out of scope here; this package owns its API, prefab wiring and limitations.

### Package identity

- Descriptor: `AnchorExamples.lspkg/package.native`.
- Consumer import prefix: `AnchorExamples.lspkg/`; reusable controller: `AnchorExamples.lspkg/Scripts/AnchorController`.
- Prefab entry point: `AnchorExamples__PLACE_IN_SCENE.prefab`. The prefab is self-contained: it carries the guide panel ("Ok, I understood"), the example carousel (minimize) and the `AnchorExample` group with the app, so dropping it into a Specs scene with a Camera and SIK gives the full demo.
- Demo scaffolding: `AnchorExamples.lspkg/Example/` holds the scripts the prefab uses for the guide and carousel (`ExampleCarousel/`, `GuideDismissPanel/`). They are not part of the anchor API; see [components](Docs/components.md#demo-scaffolding-example).
- Companion dependencies from `package_dependencies.json`: InteractionKit, UIKit, Motion and Icons.
- Native API prerequisite: AnchorModule on Specs. Preview has no anchor service.

### Version and API status

Read [Docs/api-status.md](Docs/api-status.md) for current wrapper APIs, migration removals and device verification gaps. The descriptor version governs the installed source revision.

### Applicability

Use this package for native persistent anchors and named widget areas. Use its controller alone for your own anchored target; use the full prefab for the app. Surface placement without persistence and location-locked sites are separate use cases.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md): read first for session, tracking and storage rules.
- [API status](Docs/api-status.md): check this revision and platform limits.
- [Components and API](Docs/components.md): wire inputs and locate every exported class.
- [Examples](Docs/examples.md): drop in the prefab or anchor your own target; retains the detailed tutorial.
- [Troubleshooting](Docs/troubleshooting.md): diagnose Preview, notes, navigation, mapping and snapping.

### Verification

1. Compile the wired prefab without adding casts to consumer code.
2. In Preview, create an area and spawn Note/Watch/Photo widgets; inspect each field/display.
3. Minimize then Release; Exit Area and select the saved area in My Areas; confirm three widgets return.
4. On Specs, map and save an anchor, relaunch, resolve it and confirm tracking restores the layout.
5. On Specs, submit a note and test right-hand surface snapping; observe state and uncertainty events.

## Getting started

Drag `AnchorExamples__PLACE_IN_SCENE.prefab` into a scene containing the SIK prefab. Keep its widget, UI root, widget-parent and WorldQuery references. Pinch New Area, map the surroundings and create widgets. Exit and re-enter through My Areas.

The prefab's `Guide` panel hides the carousel and the app until "Ok, I understood" is pressed; the `ExampleCarousel` starts minimized and leaves the app where it is. Delete both for your own Lens. [Detailed setup and controller example](Docs/examples.md).

## Support

[Specs Developer Community](https://developers.specs.com). Maintained by the Specs team.

## Built with 👽 by the SPECS team <!-- -->

---

[See more packages](https://github.com/specs-devs/packages)
