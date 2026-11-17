# AutoFloorFinder troubleshooting

[← Agent usage index](../README.md)

## Use when

Diagnose floor acquisition, placement and desktop/device discrepancies.

| Symptom | Cause | Action |
|---|---|---|
| Missing worldCamera error | Required camera not wired | Assign the main Device Tracking Camera; no scene auto-search exists in runtime script. |
| WorldQuery session unavailable / simulated platform error | Runtime capability unavailable | Use a SPECS preview/device; real calibration still needs usable surface data. Estimator disables itself after reporting capability failure. |
| Plate stays at its authored height in preview | No accepted real-world hits yet | Preserve authored placement. Do not claim successful calibration without device hit evidence. |
| Logs `zero raw hits from World Query` every cycle in Lens Studio | The Lens Studio Preview returns `null` for every WorldQuery hit test (checked in Sunlit Room, Sunlit Outdoor and Plane, with straight-down rays too; `filter` on or off) | Expected in the Preview: the estimator keeps cycling and targets keep their authored placement. Verify acquisition, lock and revalidation on SPECS. |
| Floor found late after an intro panel | The component's SceneObject was disabled while the panel was up, which pauses its UpdateEvent (no cycles run) | Hide only the visual targets (e.g. the `Floor Marker` child), not the object holding `AutoFloorFinder`, so estimation runs in the background. |
| Never acquires while seated | Hits rejected by 90cm minimum | Lower minUserToFloorDistanceCm to suit actual camera height. |
| Furniture mistaken for floor | Fan sees plausible raised surfaces | Look toward open floor, retain downward angles and tune the plausibility band / maxDiff using logging. |
| Getter returns -100 before acquisition | Initial placeholder value | Check hasFloor before treating either height getter as measured. |
| Only Y moves / plate remains behind wearer | Package pins height only | Set authored X/Z or use the first-floor consumer recipe in examples.md. |
| New targets in targetObjects do not move | Target transform cache built onAwake | Wire targets before startup; there is no public cache rebuild method. |
| Smooth response changes with frame rate | Fixed per-frame coefficient | Tune smoothCoefficient; implementation is not delta-time smoothing. |
| Slow lock | Hit agreement/stability insufficient | Enable logging; inspect successful cycles, accepted-hit count, spread and drift; tune thresholds only with device evidence. |
| Expected `.onFloorUpdated.add` missing | No event property in this revision | Use addOnFloorUpdated/removeOnFloorUpdated; pass the same callback identity. |
| Classification rejects usable hits | Experimental classification degraded | Keep PositionOnly default or inspect automatic fallback diagnostics. |
| Revalidation cadence seems long | Default is 20 seconds | Configure lockedRevalidationIntervalSec before startup; older README's 8-second claim was stale. |

QA checks for this demo: Guide alone at start (only the Floor Marker and the carousel are hidden, so estimation already runs), Ok reveals the minimized guidance panel, plate authored ahead of the wearer (0, −60, −100) with a translucent blue material. Floor commit/lock/drift remain device checks until real hit data is exercised.
