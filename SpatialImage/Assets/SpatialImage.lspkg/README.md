# SpatialImage

SpatialImage turns a flat photo into a 3D spatial image on Specs. It sends the
image to the Snap **Spatial Image** API through Remote Service Gateway, shows
the flat photo while the request runs, then swaps in the returned depth mesh,
eases the depth in and flattens it again when the viewer looks at it from too
steep an angle. A gallery component steps through a list of photos.

## Features

- **Photo to depth mesh**: the `Spatial Image` custom component calls the Spatial Image API (Remote Service Gateway, Snap token) and builds the mesh
- **Flat placeholder**: the photo shows immediately and is swapped for the mesh once it has spatialized (`SpatialImageSwapper`)
- **Depth animation**: depth eases in on load and flattens outside the valid viewing zone (`SpatialImageDepthAnimator` + `SpatialImageAngleValidator`)
- **Gallery**: shuffles a list of textures, spatializes each one and can advance by itself (`SpatialGallery`)
- **Loading indicator** while the request runs
- **Self-test object**: `APITested` runs on awake and logs its checks (the Spatial Image call goes through the custom component, so it has no fixed endpoint to probe; watch the `Spatial Image` log for the request result)

## Usage

This section ships with the package and describes the exact installed revision.
Read it, then follow the links into `Docs/` for the topic you need. It is
written for both people and coding agents; generic Lens scripting, scene
construction, and Specs spatial design are out of scope here.

### Package identity

- Descriptor: `package.native` (package version and Lens Studio target are recorded there).
- Import prefix: `SpatialImage.lspkg/Scripts/`, for example `SpatialImage.lspkg/Scripts/SpatialImageFrame`.
- Custom component: `SpatialImage.lspkg/Spatial Image.lsc` (the spatializer; scripts reference it as the `SpatialImage` input type).
- Prefab: `SpatialImage.lspkg/SpatialImage__PLACE_IN_SCENE.prefab`.
- The `__PLACE_IN_SCENE` prefab is self-contained: besides `RemoteServiceGatewayCredentials` and `APITested`, it holds the
  `Spatial Image` gallery demo (frame, flat placeholder, loading indicator, depth animator, angle validator), the red
  `CredentialsWarning`, the onboarding `Guide` and the `ExampleCarousel`, so dropping it into an empty Specs scene gives the full
  demo. Demo-only scripts ship in `SpatialImage.lspkg/Example/` (`CredentialsWarning/`, `ExampleCarousel/`, `GuideDismissPanel/`).
  Delete `CredentialsWarning`, `Guide` and `ExampleCarousel` from your instance when you build your own Lens.
- Credentials: set the **Snap** token on `RemoteServiceGatewayCredentials` ([setup](Docs/setup.md)). Until it's set, a red-framed
  "Credentials needed" panel shows before the guide.
- Declared companions: InteractionKit, UIKit, RemoteServiceGateway, SnapDecorators, Utilities, Motion and Icons. See `package_dependencies.json`.

### Version and API status

Read [API status](Docs/api-status.md). SpatialImage replaces the Spatial Image
sample's scene setup; the custom component is the same one the sample used.

### Applicability

Use SpatialImage to show photos (bundled textures, or textures you load at
runtime) as spatial images. It needs an internet connection and a Snap token on
device. It does not capture photos itself: pair it with your own camera or
gallery flow and call `SpatialImageFrame.setImage(texture)`.

### Package Docs (ship in Docs/)

- [cheat sheet](Docs/cheat-sheet.md) - load-bearing rules; read first
- [setup](Docs/setup.md) - credentials and first run
- [components](Docs/components.md) - every component, its inputs and how they connect
- [API status](Docs/api-status.md) - Current / Internal
- [troubleshooting](Docs/troubleshooting.md) - package-specific symptoms and fixes

### Verification

1. Compile with no TypeScript errors; imports use `SpatialImage.lspkg/Scripts/<Name>`.
2. With a Snap token set, Preview: the first photo shows flat, then the depth mesh replaces it and its depth eases in.
3. No `Spatialization failed` line in the Logger (without a token it reports `Bad Request`).
4. Move the camera to a steep angle: the depth flattens; back in front, it returns.

## Built with 👽 by the SPECS team
