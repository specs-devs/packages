<p align="center">
  <img src="Documentation/CustomLocations.svg" width="250px" alt="CustomLocations"/>
</p>

# CustomLocations

CustomLocations adds proximity activation, scale/audio listeners, scan-mesh visibility and a status panel to native `LocatedAtComponent` / `CustomLocationGroupComponent` scenes. Its sample places animated characters at three scans of one group. Real localization must be checked on Specs at the scanned location; Editor simulation exercises content behavior without establishing tracking.

The full scanning tutorial is preserved in [Guide](Docs/guide.md).

## Usage

This section ships with the package and describes the exact installed revision represented by this source. Generic Lens scripting, scene construction and Specs spatial design are out of scope here; package-specific wiring, names, limitations and examples live here.

### Package identity

- Descriptor: [package.native](package.native) (holds the package version). The existing `ReadMe` reference is preserved. SetupScript is empty and no instantiable root is declared.
- Editable folder and consumer prefix: `Assets/CustomLocations.lspkg/` and `CustomLocations.lspkg/`, for example `CustomLocations.lspkg/Scripts/ActivateWhenInCameraView`.
- [package_dependencies.json](package_dependencies.json) declares InteractionKit, UIKit, Motion and Icons. These are manifest declarations, not a live installation check.
- Activation, scale, audio, mesh visibility and Logger modules import no companion package. The example status panel imports UIKit.
- Prefab entry point: `CustomLocations__PLACE_IN_SCENE.prefab`. The prefab is self-contained: it carries the guide
  panel ("Ok, I understood"), the example carousel, the `CustomLocations Status Panel` and the `Custom Locations` group
  (GroupId `JEHNXBBZ6JA9`) with its three scans, so dropping it into a Specs scene with a Camera and SIK gives the full
  demo. The scans only align at the scanned site; to use your own scans, follow [examples](Docs/examples.md#own-location-setup).
- Demo scaffolding: `CustomLocations.lspkg/Example/` holds the scripts the prefab uses (`ExampleCarousel/`,
  `GuideDismissPanel/`). They are not part of the CustomLocations API; see
  [components](Docs/components.md#demo-scaffolding-example).
- Individual model and audio prefabs stay in `Examples/` for building your own group.

### Version and API status

Read [API status](Docs/api-status.md) for the current public surfaces and behavior gaps. No package-owned deprecation or removal markers were found. Check native and framework compatibility against your installed version before accepting a full project compile.

### Applicability

Use these helpers when content belongs to a published Custom Location scan/group and should activate near it. This package does not scan or publish locations and does not provide GPS navigation. Native group/Located At components own tracking; package listeners own content responses.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md): read first for hierarchy and activation rules.
- [API status](Docs/api-status.md): check current revision, compatibility and source limitations.
- [Components](Docs/components.md): inputs, methods, getters and listener contract.
- [Examples](Docs/examples.md): listener snippet, runtime observations and sample wiring.
- [Troubleshooting](Docs/troubleshooting.md): localization, activation, scale/audio and mesh issues.
- [Guide](Docs/guide.md): preserved original long tutorial and historical environment notes.

### Verification

Checked in the demo project: clean TypeScript compile, no runtime errors from package scripts, status panel exercised in Preview. When you change the package or wire your own group:

1. Recompile: no errors, no `as any` around `LocatedAtComponent` / `CustomLocationGroupComponent` members.
2. Preview: walk the camera within `distanceForActivation` of a scan's center and look at it — its content scales in; walk beyond 1.5× and it scales out. Looking away alone keeps it on.
3. Status panel: rows show each scan's state and distance to its content center; **Scan meshes** toggles the scan visuals off and on; **Activate all** keeps every scan's content on until **Deactivate all**.
4. Audio: the AudioComponent's SceneObject is enabled (autoplay off) so `AudioLocatedObject` can play it.
5. On Specs at the scanned site: first `onFound` → `localize()`, content placement, scan meshes hidden, loss/reacquisition. Preview cannot prove these.

## Support

See the [Specs Developer Community](https://developers.specs.com), [Custom Locations documentation](https://developers.snap.com/spectacles/about-spectacles-features/apis/custom-locations) and Specs design documentation.

## Built with 👽 by the SPECS team <!-- -->

---

[See more packages](https://github.com/specs-devs/packages)
