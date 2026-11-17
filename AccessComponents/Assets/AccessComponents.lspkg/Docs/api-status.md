# AccessComponents API status

[← Agent usage index](../README.md)

## Use when

Check this file before copying an Access Components example or an older
snippet from an earlier README. It is the compatibility index for the package
revision that contains it.

## Status meanings

- **Current** — recommended public surface for new work.
- **Deprecated** — still present; migrate to the named replacement.
- **Experimental** — public, but compatibility is not guaranteed.
- **Removed** — unavailable in this revision.
- **Internal** — resolvable implementation detail, not supported API.

## Current

The package ships example scripts, not a library. Its supported surface is:

| Capability | Current surface |
|---|---|
| Ready-made scene | `AccessComponents__PLACE_IN_SCENE.prefab` (13 groups) |
| Example scripts | the TS/JS pairs listed in [components.md](components.md), importable by their folder path |
| Reusable sample targets | `CustomComponentTS` (`textureSize`, `hasTexture()`), `CustomComponentJS` (same members), `JSComponentA` interface |

Engine calls used by the examples (`getComponent`, `getComponents`,
`getChild`, `requireType`, `@typename`, `@input`) are Lens Studio engine API,
documented in the installed `StudioLib.d.ts`, not by this package.

## Deprecated

| Deprecated surface | Current replacement |
|---|---|
| `SceneObject.getAllComponents()` (engine; used by older revisions of `AccessCustomComponentsUsingRequiredTS`) | `getComponents("Component")` (used in this revision) |
| `TSComponentA` export of `AccessTSfromJS_TSComponentA.ts` / `AccessTSfromTS_TSComponentA.ts` | `AccessTSfromJS_TSComponentA` / `AccessTSfromTS_TSComponentA` (same class, alias kept) |
| `TSComponentB` export of `AccessJSfromTSwithDeclaration_TSComponentB.ts` / `AccessJSfromTSwithouthDeclaration_TSComponentB.ts` / `AccessTSfromTS_TSComponentB.ts` | The class named after its file (same class, alias kept) |

## Experimental

No package API is designated Experimental in this revision.

## Removed

| Removed / never-existing surface | Replacement |
|---|---|
| `AccessComponents.lspkg/AccessComponentOnSceneObjectTS` (import without the folder) | `AccessComponents.lspkg/AccessComponentOnSceneObject/AccessComponentOnSceneObjectTS` |
| `SceneObject.hasComponent(typename)` | `obj.getComponent(typename) !== null` |
| `SceneObject.getComponentInChildren(typename)` | Walk `getChild(i)` / `getChildrenCount()`, or the recursive helper in [guide.md](guide.md) |
| `type.typename` on a component class | `ComponentClass.getTypeName()` |
| `SceneObject.id` (cache key) | `obj.uniqueIdentifier` |
| `AccessComponents.lspkg/Scripts/GuideDismissPanel/GuideDismissPanel.ts` | Removed from the package; a guide panel belongs to the demo project |
| Features "Component Caching" / "Type Guards" / "Recursive Search" as package helpers | Never shipped as code; see the recipes in [guide.md](guide.md) |

## Internal

The private `log()` helpers, `logger` fields and counters in the example
scripts are implementation details.
