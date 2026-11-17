# SpatialImage components

All scripts live in `SpatialImage.lspkg/Scripts/`.

| Component | Role | Key members |
|---|---|---|
| `Spatial Image` (custom component, `Spatial Image.lsc`) | Calls the Spatial Image API and builds the depth mesh | referenced as the `SpatialImage` input type |
| `SpatialImageFrame` | Central manager for one frame: sets the image on the spatializer and the flat placeholder, wires the swapper and focal-point tracking | `setImage(texture)` |
| `SpatialImageSwapper` | Shows the flat placeholder until the mesh is ready, then swaps | `setImage(texture)`, `setSpatialized(bool)` |
| `SpatialImageDepthAnimator` | Eases depth in after load; flattens it outside the valid viewing zone | `setBaseDepthScale(depth)` |
| `SpatialImageAngleValidator` | Measures the viewing angle against the frame and reports entering / leaving the valid zone | `setValidZoneFocal(f)`, `setValidZoneAngle(deg)`, `addOnValidityCallback(cb)` |
| `SpatialGallery` | Shuffles a texture list, shows each through the frame, optional auto-advance | inputs `autoAdvance`, `advanceDelay` (s), `loop` |
| `LoadingIndicator` | Spinner while a request runs | `reset()` |
| `APIKeyHint` | Shows a hint when the token is missing | |

## Demo scaffolding (`Example/`)

`Guide` (GuideDismissPanel), `ExampleCarousel` (four steps: the gallery and the depth / angle examples) and `CredentialsWarning`
are demo-only. Delete them from your instance when you build your own Lens.
