# BezierLine cheat sheet

[← Agent usage index](../README.md)

## Use when

Read first before adding a connector or editing the board example.

1. Wire `meshVisual`, `start` and `end`; assign a material to the visual. `camera` is needed for camera facing. Missing endpoints skip rebuilding. → [Core wiring](components.md#bezierline)
2. The factory creates its own child and visual but does not clone the material or assign a camera. Clone the material yourself for independent tinting. → [Factory example](examples.md#runtime-connector)
3. Use `setEndpoints`, `setControlPoints` and `setControlOffsets` to update cached transforms and request a rebuild. Call `markDirty()` after direct width, segment or axis changes. → [Core API](components.md#core-methods)
4. Explicit controls require both control objects. If one is missing, axis mode is used. Attachment offsets and handle-span caps apply only in axis mode. → [Control modes](components.md#control-modes)
5. Treat the segment slider range as an Inspector affordance. Core runtime assignments are not clamped; pass finite integer subdivisions in the supported Inspector range of 2–128 and positive finite width. → [Source gaps](api-status.md#known-source-gaps)
6. Samples are world-space and nullable; `t` is not clamped. Use 0–1 and check both query results before placing a marker. → [Sampling example](examples.md#sample-a-moving-marker)
7. The demo needs the InteractionKit scene prefab and the declared InteractionKit / UIKit dependencies (plus Motion and Icons). Its package prefab also brings the guide and the example carousel (demo scaffolding in `Example/`). The board is about 60 × 34 cm and the panel 26 × 30 cm: keep both inside the Specs view (portrait, about ±13° wide) — e.g. board above panel at ~150 cm. With UIKit read `Switch.isOn` in `onFinished`; its argument is not the state. → [Demo setup](examples.md#drop-in-board)
8. The board allows one connector per unordered pair of cards. A new connector replaces the old, and tapping an anchor removes only lines attached to that anchor. → [Board API](components.md#bezierexamples)
9. Recoloring a card changes its face, not existing anchors/connectors. For camera facing, the source tracks camera orientation, not camera translation, and caches the chosen camera transform. → [Troubleshooting](troubleshooting.md)
