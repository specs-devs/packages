# AnimationExamples API status

[← Agent usage index](../README.md)

## Use when

Check the installed revision and supported public surface.

The package version is recorded in `package.native`. Source is the authority; some prefab input values differ from the TypeScript defaults.

| Status | Surface | Evidence |
| --- | --- | --- |
| Current | AnimationExamplesManager and eight focused example components | `Scripts/*.ts`, eight `Prefabs/*Example.prefab` files |
| Current | playFirstClip, buildFrameUI, flatCurve, bindReplay, FrameUI | `Scripts/Helpers/AnimationHelpers.ts` |
| Current | Manager count/index/name getters, next, previous, setActive | Public methods in AnimationExamplesManager |
| Current, tutorial only | TweenExamples | All example calls are commented out in onAwake |
| Deprecated | None declared by this package source | No package-level deprecated annotations |
| Experimental | None declared by this package source | No experimental annotations |
| Current, demo only | Guide and ExampleCarousel | `AnimationExamples__PLACE_IN_SCENE.prefab` carries a `Guide` (GuideDismissPanel) and an `ExampleCarousel` (with AnimationExamplesCarouselSource); scripts in `Example/` |

The native preview compiled clean in the QA pass. Synthetic hand input failed in the installed tooling (`getTransform` of undefined), so guide dismissal, navigation, and TAP controls still require device or manual Preview verification. This is an evidence gap, not a verified interaction pass.

QA repaired authored bindings: FromAnimationAsset uses `AnimationAssets/SHAKE.animationAsset` on its actual root (`Prefabs/FromAnimationAssetExample.prefab`) and ExistingPlayer uses `AnimationAssets/LIFT.animationAsset` on its actual root (`Prefabs/ExistingPlayerExample.prefab`). Both assets produced varying runtime rotations/positions at two timestamps. The fallback remains supported when a consumer leaves the first clip's asset slot empty.
