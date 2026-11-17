# AutoFloorFinder cheat sheet

[← Agent usage index](../README.md)

## Use when

Read before installing or generating a consumer.

1. Wire `worldCamera` explicitly to your Device Tracking camera; missing input throws in onAwake. → [Inputs](components.md)
2. WorldQuery is acquired internally. Requires SPECS runtime and usable surface data; desktop preview is not proof of real floor calibration. → [Troubleshooting](troubleshooting.md)
3. `targetObjects` pins only world Y, preserving each target's X/Z. Author content ahead of the wearer; positions remain unchanged before the first commit. → [Setup](examples.md)
4. Guard getters with `hasFloor()`: before acquisition they return `initialHeight` (-100cm), not a measured floor. → [Query API](components.md)
5. Default plausible camera-to-floor range is 90–250cm; lower the minimum for seated use. → [Inputs](components.md)
6. Use `addOnFloorUpdated` / `removeOnFloorUpdated` and `addOnCalibrationStateChanged` / `removeOnCalibrationStateChanged`; this revision has no `.onFloorUpdated.add` event property. → [API status](api-status.md)
7. Advanced fields, ray fan and experimental session options must be set before onAwake; the component caches transforms and session options. → [Tuning](components.md)
8. Locked revalidation defaults to 20 seconds. Classification/filter options are experimental and both disabled by default. → [API status](api-status.md)
9. Component owns one session and stops it in onDestroy. The package supplies no placement confirmation UI; use SurfacePlacement for deliberate user placement. → [Lifecycle](components.md)
