<p align="center">
  <img src="Docs/media/NavigationKit.png" width="250px" alt="NavigationKit"/>
</p>

# Navigation Kit

The Navigation Kit (SNK) is a set of components designed to simplify the development of navigation experiences for the SPECS platform in Lens Studio. SNK provides functionality for storing a set of places that can be navigated to, as well as visual assets that direct the user to those locations.

## Documentation and API Reference

- **Getting Started**: Learn how to use SNK by following the [Get Started Guide](https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-navigation-kit/getting-started).
- **API Reference**: Explore the full API documentation for SNK [here](https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-navigation-kit/component-list).
- A template of a complex navigation experience: [Navigation Kit Template](https://github.com/specs-devs/samples/tree/main/Navigation%20Template).

## Usage

This section ships with the package and describes the exact installed revision.
Read it, then follow the links into `Docs/` for the topic
you need. It is written for both people and coding agents; generic Lens scripting,
scene construction and Specs spatial design are out of scope here.

### Package identity

- Package descriptor: `NavigationKit.lspkg/package.native` (ReadMe = this file).
- Consumer import prefix: `NavigationKit.lspkg/NavigationDataComponent/<Module>` for the data
  layer (e.g. `NavigationKit.lspkg/NavigationDataComponent/NavigationDataComponent`) and
  `NavigationKit.lspkg/ARNavigationComponent/Scripts/ARNavigation` for the arrow. There is no
  `Scripts/` root for the data modules. Exact paths: [components](Docs/components.md).
- Required companion packages (package_dependencies.json): `InteractionKit`,
  `UIKit`, `Motion`, `Icons`. The data layer only needs SIK
  (`Utils/Event`, `Utils/LensConfig`, `Utils/NativeLogger`, `Utils/UpdateDispatcher`,
  `Utils/FunctionTimingUtils`); the example menu needs UIKit (`RectangleButton`, `Frame`).
- Runtime capabilities: `require("LensStudio:RawLocationModule")` (Location permission) for GPS,
  `LocatedAtComponent` / `LocationAsset` for Custom Location places.
- Drag-and-drop demo: `NavigationKit__PLACE_IN_SCENE.prefab` is self-contained. Besides the
  menu and the arrow (under `NavigationKitDemo`) it includes the guide panel (`Guide`, closed
  with "Ok, I understood") and the `ExampleCarousel` panel, so an empty Specs scene with SIK +
  UIKit gets the full demo. Their scripts ship in the package's `Example/` folder
  (`Example/ExampleCarousel/`, `Example/GuideDismissPanel/`); they are demo scaffolding, not
  NavigationKit API ([components](Docs/components.md#demo-scaffolding-example)).

### Version and API status

This README and `Docs/` ship in the package archive and describe that exact installed
revision. Read [API status](Docs/api-status.md) before reusing an older example; it lists
the Current, Experimental and Removed surfaces of this revision.

### Applicability

Use NavigationKit when a Lens must guide the wearer to one or more places — GPS coordinates,
Custom Location scans, Custom Location groups or plain scene objects — and show a direction
arrow with a distance readout. Use SIK/UIKit directly for the surrounding UI; use the
Navigation Kit Template for map tiles, place carousels and full wayfinding flows (those are
not part of this package).

### Package Docs (ship in `Docs/`)

Lens Studio installs packages packed but auto-extracts their files into the project's Cache
on import, so an agent can read these `Docs/` there (or from the package source). Treat only
documented public members as supported API: never guess an import path or reach into a
private field.

- [cheat sheet](Docs/cheat-sheet.md) - load-bearing rules; read first
- [components](Docs/components.md) - every public script, class, input, method and event, with import paths
- [API status](Docs/api-status.md) - Current / Experimental / Removed surfaces of this revision
- [examples](Docs/examples.md) - prefab drag-and-drop setup and minimal compile-correct TypeScript
- [troubleshooting](Docs/troubleshooting.md) - package-specific symptoms, causes and fixes (incl. QA findings)

### Verification

1. Compile the Lens with no TypeScript errors and no `as any` on package types.
2. In the Preview, pinch each entry of the example menu: the head-locked arrow and the
   distance text must appear (`ARNavigation` logs `mainMaterial is missing` when a mesh has no
   material — fix the asset, don't ignore it).
3. Select a place you already stand at (e.g. the example's "Start Position"): the arrow must
   spin out and the check mark scale in within 2 s, then everything hides after 3 s.
4. Check the Logger for `ExampleMenu: could not subscribe to button …` and
   `[Navigation Component]` errors; both mean the scene is mis-wired.
5. On device, confirm `NavigationDataComponent.getUserPosition().status` reaches
   `GeoLocalizationAvailable` before trusting GPS places.

## Built with 👽 by the SPECS team
