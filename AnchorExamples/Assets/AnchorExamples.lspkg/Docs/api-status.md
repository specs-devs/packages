# AnchorExamples API status

[← Agent usage index](../README.md)

## Use when

Confirm the APIs implemented in this package source revision.

The descriptor is `package.native`; its current Version field is the source of truth. Source reviewed against `Scripts/AnchorController.ts` and `Examples/` on the installed branch.

| Status | Surface | Notes |
|---|---|---|
| Current | AnchorController sessions, create/save/resolve/delete, tracking and uncertainty events | Native AnchorModule wrapper |
| Current | Area storage, Note/Watch/Photo widgets, recall and surface snapping | Demo app; UIKit and SIK required |
| Current | Preview remembered pose | Local simulation, never proof of persistent native anchors |
| Removed migration APIs | `anchor.toWorldFromAnchor`, `anchor.state`, `anchor.onFound`, `updateAnchor`, `AnchorSession.reset()` | Use AnchorComponent pose/state and create-save-delete / clearArea / clearAllAnchors |
| Deprecated | No additional deprecated wrapper methods identified | Legacy RecallWidgets helper remains in source but AppController uses WidgetController.recallAllWidgets |
| Experimental / gaps | No APIs explicitly marked experimental | Hardware mapping, localization, keyboard and WorldQuery need device verification |

`isSupported` is false in Preview. Unsupported operations return null/false. Session errors log and resolve null/false; consumers must check results. WatchWidget reads UTC, not local device time. PhotoWidget is static; it serializes `{}`.
