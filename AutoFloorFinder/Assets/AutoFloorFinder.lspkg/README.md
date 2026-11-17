<p align="center">
  <img src="Docs/media/AutoFloorFinder.png" width="250px" alt="AutoFloorFinder"/>
</p>

# Auto Floor Finder

Automatic, self-calibrating floor-height estimation for SPECS. Batched WorldQuery raycasts, hit voting and height-jump hysteresis produce a committed floor Y. Calibration progresses from Acquiring through Tracking to Locked, then revalidates at a lower frequency. Optional targets follow that height without placement UI.

## Usage

This section ships with the package and describes the exact installed revision. Generic Lens scripting, scene construction and SPECS spatial design live in the CLAD skills, not here.

### Package identity

- Descriptor: `package.native`.
- Consumer import: `AutoFloorFinder.lspkg/Scripts/AutoFloorFinder`.
- Example: `AutoFloorFinder__PLACE_IN_SCENE.prefab`. It's self-contained: dropped into an empty SPECS scene (Camera, lighting, SIK/UIKit), it brings the guide panel, the example carousel and the `Floor Marker` plate. Rewire `worldCamera` to your scene camera.
- Demo scaffolding: `AutoFloorFinder.lspkg/Example/` holds the scripts only the demo uses (`ExampleCarousel/`, `GuideDismissPanel/`). Don't import them from your own code; delete `Guide` and `ExampleCarousel` from the prefab instance when you build your own Lens. See [components](Docs/components.md#demo-scaffolding-example).
- Runtime imports: `Scripts/AutoFloorFinder.ts` imports SnapDecorators and Utilities; the `Example/` demo scaffolding imports SpectaclesInteractionKit and SpectaclesUIKit. Declared companions in `package_dependencies.json`: SnapDecorators, Utilities, SpectaclesInteractionKit, SpectaclesUIKit, Motion and Icons.
- Requires a SPECS runtime with WorldQuery and usable surface hits. The Lens Studio Preview returns no WorldQuery hits, so floor acquisition is device-only (see troubleshooting).

### Version and API status

[Docs/api-status.md](Docs/api-status.md) identifies current query/callback APIs, public tuning fields and experimental classification options.

### Applicability

Use for automatic floor height and Y-pinned content. Use SurfacePlacement when the wearer should deliberately select and confirm a placement. This package does not choose X/Z, check occupancy or estimate arbitrary tabletop/wall anchors.

### Related CLAD skills

[specs-world-query](https://github.com/lens-studio-devs/ls-extensions/blob/main/plugins/ls-clad/skills/specs-world-query/SKILL.md). These skills cover the surrounding Lens workflow.

[Install CLAD](https://developers.specs.com/docs/clad/setup/setup-ai/) or browse its [source](https://github.com/lens-studio-devs/ls-extensions). Read the installed package docs for this revision’s APIs.

### Package Docs (ship in Docs/)

- [cheat-sheet.md](Docs/cheat-sheet.md): read first for required setup and common API mistakes.
- [api-status.md](Docs/api-status.md): check this revision's supported and experimental surfaces.
- [components.md](Docs/components.md): wire inputs, read exact defaults and subscribe to callbacks.
- [examples.md](Docs/examples.md): install prefab or build typed consumers; includes preserved setup/tuning recipes.
- [troubleshooting.md](Docs/troubleshooting.md): diagnose capability, hit acceptance, placement and calibration.
- [guide.md](Docs/guide.md): understand estimator voting, package alternatives and nonimplemented roadmap ideas.

### Verification

1. Compile the typed consumer with exact import paths and no `as any`.
2. Verify worldCamera and targetObjects bindings; before first commit, targets retain authored placement.
3. On SPECS with real surface data, look at open floor and confirm hasFloor, floor callback and Y updates.
4. Confirm Acquiring → Tracking → Locked callbacks and default 20-second revalidation; exercise drift/unlock.
5. In unsupported desktop simulation, confirm capability failure is reported without a script crash; this is not floor-calibration verification.

## Built with 👽 by the SPECS team
