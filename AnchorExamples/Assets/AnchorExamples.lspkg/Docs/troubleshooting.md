# AnchorExamples troubleshooting

[← Agent usage index](../README.md)

## Use when

Diagnose the installed demo or anchor wrapper.

| Symptom | Cause | Resolution |
|---|---|---|
| "Area ready (Lens Studio: anchors are simulated)" | Preview has no native anchor service | Verify layout here, mapping and relocalization on Specs |
| Note is a blank plate with no field | Stale prefab script UUID may resolve to a generic Object | Bind the current installed UIKit TextInputField script; this revision uses `af79fabe-6fbd-46c3-8b98-0fd7b687282c` |
| Exit Area also deletes all saved areas | Release can hit the overlapping Delete All Areas button after navigation | This revision ignores the first 400 ms of Delete All Areas callbacks after showing My Areas |
| Widgets hidden by demo guidance | The prefab's `ExampleCarousel` panel and the widget spawn row share visual space | The carousel ships in the prefab and starts minimized; keep it minimized, move it, or delete `Guide` and `ExampleCarousel` for your own Lens. Keep its `anchorExamples` off |
| Save remains pending | Native mapping has insufficient environmental coverage | Move/look around; AppController refuses Exit while save is pending |
| Saved widgets do not restore on device | Saved id unresolved or tracking not yet active | Look around; restore occurs one frame after Tracking; localization timeout shows a status |
| Snap On does not move old widgets | Continuous snapping subscribes only to newly added widgets | Enable Snap then create a widget, or drag/release a tracked widget |
| Note keyboard unavailable in Preview | Platform keyboard path requires hardware support | Check field visibility and focus here; exercise text entry and Return on device |
| Clock differs from local time | WatchWidget uses `getUTCHours()` | Expected current behavior; format toggle changes 12h/24h only |

2026-09-30 QA confirmed Preview spawn, Minimize/Release, exit save and three-widget re-entry; native anchor service and keyboard entry remain device checks. Renderer warning `Depth24UnormStencil8 is not renderable; using Depth32FloatStencil8` is a Preview fallback, not a package script failure.
