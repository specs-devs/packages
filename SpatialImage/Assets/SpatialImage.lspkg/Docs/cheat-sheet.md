# SpatialImage cheat sheet

- Set the **Snap** token on `RemoteServiceGatewayCredentials` before testing; without it the API call fails and only the flat photo shows.
- Show an image with `SpatialImageFrame.setImage(texture)`; it updates the spatializer and the flat placeholder together.
- The `Spatial Image` custom component (`Spatial Image.lsc`) does the API call and builds the mesh; the scripts only coordinate it.
- Keep one `SpatialImageAngleValidator` per frame and pass it to `SpatialImageDepthAnimator`; the animator flattens depth when the validator reports the viewer left the valid zone.
- `SpatialGallery.autoAdvance` steps to the next texture `advanceDelay` seconds after the current one has spatialized.
- Spatializing needs internet on device. Large images take longer; resize before calling `setImage` if needed.
- Demo scaffolding (`Guide`, `ExampleCarousel`, `CredentialsWarning`) is optional; delete it from your instance.
