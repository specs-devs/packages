# WorldQueryHit API status

[← Agent usage index](../README.md)

## Use when

Check this installed revision's exports and compatibility boundaries.

| Status | Surface | Actual contract / gap |
|---|---|---|
| Current | NewScript, HitTestClassification, SurfaceClassificationInfo | TS exports at exact file paths in [components](components.md). |
| Current | WorldQueryHitExampleJS.js / HitTestClassificationJS.js | Attached ScriptComponent globals, not TS named imports. JS public inputs/APIs are documented separately. |
| Runtime-dependent | Ground/Wall/Ceiling/Table/None and unknown enum values | Runtime enum lookup; unknown numeric values become Surface<number>, undefined/null becomes None. Not all categories guaranteed. |
| Runtime-dependent | refineEnabled | Attempts options.refine=true inside try/catch; factory/OS support still must be tested. No validation or assurance from a successful property assignment. |
| Important behavior | detectCategory | Label-only filter; no category restriction on copies. |
| Removed | `Scripts/GuideDismissPanel/GuideDismissPanel.ts` | Old unused guide copy deleted in this revision (the prefab only kept an orphan component pointing at it). Demo projects own their guide. |
| Changed | Placement guards (TS + JS) | No hit test while the targeting interactor points at an Interactable (UI); a pinch released on UI never places; losing targeting clears the cached hit. |
| Deprecated / removed | None explicitly declared | No deprecation annotation found. No renamed placement class, configurable ray-offset API or placement undo/cleanup API shipped. |

Built-in HitTestSession/WorldQueryModule declarations in the old tutorial are runtime APIs, not package exports. Dynamic enum lookup avoids references to optional enum members but still requires supported WorldQueryModule, SurfaceClassification and SIK runtime infrastructure. There is no guarantee this package runs on every Lens Studio/SnapOS version.

The Lens Studio Preview returns no WorldQuery hits, so surface acquisition, category values and refined output can only be verified on a device.
