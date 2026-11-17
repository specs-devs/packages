# Agnostic3DButton API status

[← Agent usage index](../README.md)

## Current surface

- `Agnostic3DButton`: inputs `fingers`, `useSIKIndexTips`, `shape`, `size`, `travel`, `hoverHeight`, `enterFromTopOnly`, `pressThreshold`, `releaseThreshold`, `returnSpeed`, `holdMargin`, `releaseDelay`, `releaseHeight`, `maxHoldWithoutFinger`, `toggle`, `interactable`, `debugDraw`, `debugMaterial`; state `pressValue`, `isPressed`, `isHovered`, `isOn`, `volume`; methods `addFinger`, `removeFinger`, `addFingerSource`, `setOn`, `simulatePress`, `closestFinger`; events `onHoverEnter`, `onHoverExit`, `onPressStart`, `onPressValue`, `onPressed`, `onReleased`, `onClick`, `onToggle`.
- `Agnostic3DButtonVisual`: inputs `button`, `theme`, `style`, `capMaterial`, `glowMaterial`, `capHeight`, `bevel`, `cornerRadius`, `plateMargin` (deprecated, unused), `clearance`, `bezelWidth`, `wellDepth`, `squash`, `label`, `labelSize`, `clickAudio`, `pill`, `icon`, `iconSize`, `showShadow`, `shadowRange`, `shadowMinRadius`, `shadowMaxRadius`, `shadowMaxOpacity`, `shadowDarkness`; methods `configure`, `setTheme`, `setLabel`, `getCap`; enum `ButtonStyle`.
- `ButtonVolume`: `ButtonShape`, `VolumeSpec`, `isInsideFootprint`, `isAboveTop`, `isInVolume`, `pressAmount`.
- `ButtonThemes`: `BUTTON_THEMES`, `THEME_NAMES`, `findTheme`, `mixColor`.
- `ButtonMeshes`: `buildSlab`, `buildWell`, `buildRing`, `buildVolumeWireframe`, `footprint`.

This is the first release; there is nothing to migrate.

## Platform notes

- Standard Lens Scripting only (transforms, MeshBuilder, materials). No physics, no experimental APIs.
- SIK is used for the index tips (`HandInputData`) and, in the Any Finger example only, for the grabbable ball.
- The press logic is credited to the Essentials soft-press example (`SoftPressController`), reworked to be physics-free and finger-agnostic.
- Verified in the Lens Studio preview. Real-hand feel (travel, thresholds) still needs tuning on a SPECS device.
