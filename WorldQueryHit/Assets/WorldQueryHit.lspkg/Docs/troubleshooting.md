# WorldQueryHit troubleshooting

[← Agent usage index](../README.md)

## Use when

Diagnose package-specific behavior; rows marked QA come from a Lens Studio Preview pass.

| Symptom | Source-supported cause | Action |
|---|---|---|
| Cannot import WorldQueryHitExample | Actual TS export is NewScript | Use Scripts/WorldQueryHitExampleTS with NewScript. |
| Startup/null errors or no copies | Missing target/sources/parents/index/world camera | Validate all Inspector references before awake. TS missing-target early return does not disable its decorated updates. |
| Selecting Ground still places on Wall | detectCategory only filters the label | Do not use it as placement permission; current example has no semantic placement gate. |
| Classification still says Ground after a miss | Detector intentionally retains last information | Treat getter/event as last-known, not fresh detection. No built-in loss signal exists. |
| Trigger release creates a copy after cursor hides | Older revisions kept lastHitResult after targeting loss | Fixed: targeting loss clears it. Update the package if you copied the old script. |
| Pinching a UI button also drops an object behind the panel | Older revisions hit-tested through UI | Fixed: no hit test / placement while the interactor targets an Interactable. |
| Index changed but wrong source remains visible | setObjectIndex only stores the index | Also call setObjectEnabled; account for TS/JS difference in components reference. |
| Duplicate placement callbacks | Repeated setupTriggerEndCallback or JS initializer calls | Do not manually reinitialize; shipped code has no callback removal. |
| Refine/category doesn't appear | Runtime support/data may differ | Inspect actual runtime values and native hit behavior; do not infer support from fields or enum string mapping. |
| Filter toggles do not affect hits | Session options captured at awake | Configure before startup; returned new sessions do not replace private active session. |
| Color/label changes do not take effect | Setup-created color map/label or name-change cache | Author before startup and restart; package lacks dynamic rebuild API. |
| QA: no cursor or label in the Lens Studio Preview | The Lens Studio Preview returns null for every WorldQuery hitTest (Interactive rooms too) | Not a package bug: verify acquisition, labels and placement on device; in the Preview check only startup, logs and UI. |
| QA: a flat square floats at the user's head | `Plane` child of the prefab enabled (its mesh ref used to dangle, so it rendered nothing) | Keep `Plane` disabled; it is not the cursor (`targetObject` is `Objects to spawn [EDIT]`). |
| QA: House source/copies miss the standing pose | `Stand` mesh ref dangled after a Lens Studio asset id change | Fixed in this revision (stand.mesh). Re-instantiate the prefab: existing scene instances keep the old ref. |
| QA: two instructions at start | Intro hint (2 s, camera-tethered) plus your own onboarding | Set `showIntroHint` = false on the instance. |

