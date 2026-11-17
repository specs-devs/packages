# BezierLine API status

[← Agent usage index](../README.md)

## Use when

Check names, supported entry points and compatibility before changing a consumer. This reference describes the sources shipped with this package; the version is in `package.native`.

## Current

| Surface | Status in this revision |
|---|---|
| `BezierLine` | Public `@component`; core has no imports from companion packages. Factory, inputs, sampling and rebuild methods are described in [Components](components.md). |
| `BezierExamples` | Optional board component. Owns cards, connections and flow markers; imports SIK. |
| `BezierCard`, `BezierAnchor` | Optional runtime-created components with typed options and anchor interaction events. Import SIK. |
| `BezierExamplesPanel` | Optional UIKit control panel. Imports UIKit `Button`, `Slider`, `Switch`, `BackPlate` and Flex layout classes. |
| Example prefab | Guide, example carousel, board and panel, prewired asset inputs; demo scaffolding scripts ship in `Example/`. Requires a scene with SIK; descriptor does not automatically instantiate it. |

## Deprecated

| Surface | Source evidence |
|---|---|
| None marked by this package | No package-owned deprecation annotations or compatibility aliases were found. This says nothing about deprecations inside installed companion packages. |

## Experimental

| Surface | Source evidence |
|---|---|
| None explicitly marked | Debug drawing is optional and depends on `global.debugRenderSystem`; it is not a consumer API stability promise. |

## Removed

| Surface | Source evidence |
|---|---|
| None identified | No revision history was used to infer removals. |

## Compatibility and verification

`package_dependencies.json` declares SpectaclesInteractionKit, SpectaclesUIKit, Motion and Icons (the last two are required by SpectaclesUIKit). The package and its examples compile without casts against the declared dependencies (the panel's `Button`/`Slider`/`Switch` imports and the anchor's `InteractableManipulation.setManipulateRoot()` included), and the demo was exercised in the Lens Studio Preview; device behavior was not checked. The original tutorial's OS/app minimum versions are preserved in [Guide](guide.md#original-environment-notes), but were not revalidated.

The example panel reads `Switch.isOn` inside `onFinished`: in SpectaclesUIKit that event's argument says whether the change was explicit (user-initiated), not the new state. Earlier code that forwarded the argument could only ever switch Camera / Flow / Debug on.

## Known source gaps

- Core `segments` and `width` receive no runtime validation. `BezierExamples.setSegments()` rounds and applies a minimum of 2, but no maximum. The panel slider supplies 4–64. Use finite integer subdivisions and finite positive width.
- `getPointAtT()` and `getTangentAtT()` do not clamp `t`; they return `null` without both endpoints. Coincident endpoints or degenerate tangents need visual validation.
- Explicit controls ignore attachment offsets and do not cap handle distances. With only one explicit control assigned, the curve falls back to axis mode.
- Camera-facing change detection watches the camera back direction at intervals of at least 0.1 seconds. Camera translation alone does not rebuild; a camera transform is cached, so swapping camera objects is not supported by a cache-refresh setter.
- `forceRebuild()` does not perform the endpoint/control change-detection update. Prefer the provided setters when changing object references.
- `BezierCard.setColor()` updates the face only. Existing anchor and connector materials are separate clones.
- `scaleMeshToSize()` divides by mesh AABB extents without guarding zero extents.
- Debug code in the core uses existing `as any` casts for the debug render system. They were not changed by this documentation pass.
