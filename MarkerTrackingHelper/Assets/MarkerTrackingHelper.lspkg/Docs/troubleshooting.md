# MarkerTrackingHelper troubleshooting

[← Agent usage index](../README.md)

## Use when

Marker content doesn't appear, appears at the wrong size, or a script throws.
Generic camera, tracking and rendering issues belong to the relevant CLAD
skill (`specs-debug`, `camera-and-rendering`).

## Known issues

| Symptom | Package cause | Package fix |
|---|---|---|
| `Camera not found in scene. Please add a camera to your scene.` | No root object with a Camera | Keep the main camera at the scene root |
| `You are missing a DeviceTrackingComponent with World tracking mode…` (Extended) | The camera has no `DeviceTracking`, or its actual mode isn't World | Add Device Tracking = World on the camera |
| The marker is never detected; `Cannot get aspect ratio, missing provider` | The marker asset has no texture (older revisions shipped a dangling texture reference) | Fixed in this revision; for your own marker, set the texture on the `.imgmarker` |
| Resized content is invisible or flat | Marker height read as 0 (no texture), or the targets were not unit-sized | Fix the marker texture; author `resizeObjectArray` objects 1 × 1 cm |
| Simple prefab: the marker is found but no cube | Older revision: dangling Box mesh reference | Fixed; re-instantiate the prefab (scene instances don't pick up prefab fixes) |
| Extended prefab: decorations are missing | Older revision: dangling holiday mesh references | Fixed; re-instantiate |
| `TypeError: undefined is not a function` in `MarkerCallback` on found | Older revision: the Image had a static texture | Fixed: `onMarkerFound()` checks for an animated texture and warns instead |
| The "thank you" animation draws nothing in the Mac Preview | Older revision: ETC2 `.pvr` atlas | Fixed: the atlas is now `atlas_0.png` |
| Found/lost functions don't run | `Edit Event Callbacks` is off, the script is unset, or a name is misspelled (unknown names are skipped silently) | Turn it on, assign the script, and match the public method names exactly |
| Your own `onMarkerFound` handler stops firing (or the controller's does) | Older revision: the controllers assigned `onMarkerFound`/`onMarkerLost` and replaced earlier handlers. They now chain; a plain assignment made *after* OnStart still replaces them | Fixed; subscribe with `Utils.addMarkerFoundHandler` / `addMarkerLostHandler` instead of assigning the property |
| A lost callback receives `true` | Older revision passed `true` to both found and lost functions | Fixed: lost functions receive `false` |
| Many `NewParent` objects at the scene root (Extended) | Older revision created one per detection | Fixed: the controller reuses one `NewParent` |
| Extended content stops following the marker | By design: tracking is disabled 0.5 s after the first detection | See the re-scan recipe in [guide](guide.md) |
| Logging toggles are hidden in the Inspector | Older revision: they sat inside the `editEventCallbacks` group | Fixed in this revision |

## Verification

After a fix, preview with the "Image Marker" media input. The content must
appear at the marker's size, with no errors from the marker scripts.
