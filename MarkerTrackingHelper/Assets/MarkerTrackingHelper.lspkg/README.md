<p align="center">
  <img src="Docs/media/MarkerTrackingHelper.png" width="250px" alt="MarkerTrackingHelper"/>
</p>

# Marker Tracking Helper 

Marker Tracking Helper wraps Lens Studio's `MarkerTrackingComponent` for Specs.
It ships three ready prefabs: content that follows a printed image marker,
content resized to the marker with found/lost callbacks, and content that
detaches from the marker and stays anchored in the world once the marker has
been seen.

## Features

- **Simple tracking**: parents the tracking rig under the camera so content follows the marker
- **Resize to marker**: scales objects authored at unit size to the marker's physical size
- **Found / lost callbacks**: calls named functions on any script
- **World persistence**: after detection, re-parents the content to the world and stops tracking
- **Editable marker**: one `Image Marker [EDIT_ME].imgmarker` asset (21 cm tall by default)

## Usage

This section ships with the package and describes the exact installed revision.
Read it, then follow the links into `Docs/` for the topic you need. It is
written for both people and coding agents; generic Lens scripting, scene
construction, and Specs spatial design live in the CLAD skills, not here.

### Package identity

- Package descriptor: `MarkerTrackingHelper.lspkg/package.native` (holds the package version)
- Consumer import prefix: `MarkerTrackingHelper.lspkg/Scripts/`. File and class
  names differ: `Scripts/ExtendedMarkerTracking` exports
  `ExtendMarkerTrackingController`, and `Scripts/MarkerCallback` exports
  `MarkerCallbacks`. See [components](Docs/components.md).
- Prefab entry points: `MarkerTrackingHelper_Simple__PLACE_IN_SCENE.prefab`,
  `MarkerTrackingHelper_ResizableWithCallbacks__PLACE_IN_SCENE.prefab`,
  `MarkerTrackingHelper_Extended__PLACE_IN_SCENE.prefab`. Marker asset:
  `Image Marker [EDIT_ME].imgmarker`.
- Demo prefab: `MarkerTrackingHelper__PLACE_IN_SCENE.prefab` holds the full
  demo: a guide panel ("Ok, I understood"), an example carousel
  (Previous / Next / minimize), and one instance of each of the three prefabs
  above. Drag it into an empty Specs scene to get the whole demo. The guide and
  carousel scripts (`ExampleCarousel`, `GuideDismissPanel`) are demo
  scaffolding and ship in the `Example/` folder; they aren't part of the
  marker API. See [components](Docs/components.md#demo-scaffolding-example).
- Required companion packages (see `package_dependencies.json`): `Utilities`
  (`ComponentUtils`, `Logger`) and `SnapDecorators` (imported by the
  scripts), plus `SpectaclesInteractionKit`, `SpectaclesUIKit`, `Motion` and
  `Icons` (used by the demo scaffolding). The scene needs a root Camera. The
  Extended prefab also needs `DeviceTracking` in **World** mode on that camera.

### Version and API status

Read [API status](Docs/api-status.md) before reusing an older example. The
previous README showed `createComponent("ExtendMarkerTrackingController")` and
helper methods (`validateWorldTracking`, multi-marker state) that this revision
doesn't have.

### Applicability

Use Marker Tracking Helper when content must appear on a known printed or
displayed image. For content placed on real-world surfaces without a marker,
use surface placement / world query. For a fixed location that is known in
advance, use Custom Locations.

### Related CLAD skills

- [specs-world-query](https://github.com/lens-studio-devs/ls-extensions/tree/main/plugins/ls-clad/skills/specs-world-query):
  surface hits when no marker is involved.
- [specs-custom-locations](https://github.com/lens-studio-devs/ls-extensions/tree/main/plugins/ls-clad/skills/specs-custom-locations):
  location-anchored content.
- [lens-api](https://github.com/lens-studio-devs/ls-extensions/tree/main/plugins/ls-clad/skills/lens-api):
  generic scripting and the callback scripts.
- No CLAD? Setup: https://developers.specs.com/docs/clad/setup/setup-ai/ ·
  source: `github.com/lens-studio-devs/ls-extensions`.

### Package Docs (ship in `Docs/`)

Lens Studio auto-extracts these files into the project's install Cache on
import, so an agent can read them there. Treat only the members documented
here as supported API; never guess an import path.

- [cheat sheet](Docs/cheat-sheet.md) - load-bearing rules; read first
- [components](Docs/components.md) - the four scripts, `Utils`, the three prefabs, the demo prefab and its `Example/` scaffolding, and the marker asset
- [API status](Docs/api-status.md) - Current / Deprecated / Experimental / Removed / Internal
- [minimal examples](Docs/examples.md) - prefab setup, custom marker, callback script
- [guide and recipes](Docs/guide.md) - choosing a prefab, how each one behaves, multi-marker setup
- [troubleshooting](Docs/troubleshooting.md) - package-specific symptoms and fixes

### Verification

1. Compile with no TypeScript errors. Imports use the class names above.
2. Each prefab instance's `MarkerTrackingComponent.marker` is a marker asset
   whose texture resolves. The log must not show `Cannot get aspect ratio,
   missing provider`.
3. In Preview, set the input to the Lens Studio "Image Marker" media (the
   package's default marker image) and confirm that the content appears on the
   marker.
4. Extended prefab: the content stays in place after the marker leaves view.
   Resizable prefab: the found/lost functions run, and the "thank you"
   animation plays.

## Built with 👽 by the SPECS team
