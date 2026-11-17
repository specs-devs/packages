# Anchor Examples

## What it is
A package you drop into a Specs project to persist content in named real-world areas with native spatial anchors
(`AnchorModule` sessions and `AnchorComponent` tracking). It ships a reusable singleton, `AnchorController`, plus a
complete demo app that saves Note, Watch and Photo widgets per area. It is for developers who want content to come
back where the wearer left it across Lens sessions.

## What it does
1. Drop `AnchorExamples__PLACE_IN_SCENE.prefab` into a scene that already has the InteractionKit prefab.
2. The Get Started / My Areas screens let the wearer pick a saved area or create a new one (up to 9).
3. For a new area, a world anchor is created in front of the wearer and saved while they look around; the widget
   parent is tracked by an `AnchorComponent` right away, so widgets can be placed immediately.
4. For an existing area, the stored anchor id is resolved (falling back to the first anchor reported by
   `onAnchorNearby`); widgets are restored one frame after the anchor reports `Tracking`.
5. In an area the wearer spawns note / watch / photo widgets, minimizes and releases them, snaps them to surfaces via
   WorldQuery, and exits to save the layout to local persistent storage.

In your own Lens you can skip the demo and call `AnchorController` directly: `openSession(area)`,
`createAndSaveWorldAnchor(pose)`, `resolveAnchor(id)` and `track(target, anchor)`.

## Highlights
- One anchor session per area; create, save, resolve, delete, `clearArea` and `clearAllAnchors`, with events for
  session open/close, nearby/saved/deleted anchors, tracking state and positional uncertainty.
- Widget transforms are stored relative to the anchored parent, so layouts survive a different world origin in the
  next session.
- Explicit capture flow (`CaptureFlowManager`) that warms up mapping before creating and saving the anchor.
- UI Kit screens built in code, keyboard-driven note fields, a UTC clock widget, a static photo widget and
  WorldQuery surface snapping from the right-hand interactor.
- Lens Studio Preview runs against a simulated remembered pose, so the layout flow can be checked without a device.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/AnchorController.ts` | Reusable singleton wrapping `AnchorModule` sessions, anchors, tracking and events. |
| `Examples/App/AppController.ts` | Demo entry component: wires UI, storage, widgets and the area/anchor flow. |
| `Examples/Anchors/CaptureFlowManager.ts` | Scan-then-save capture flow with mapping progress and timeout events. |
| `Examples/Widgets/WidgetController.ts` | Spawns, restores, saves, clears and recalls widgets for an area. |
| `Examples/Widgets/WidgetBase.ts` | Base class for widget types; Note, Watch and Photo live in `Examples/Widgets/Types/`. |
| `Examples/Widgets/Actions/SnapToSurface.ts` | WorldQuery hit testing to snap widgets onto real surfaces. |
| `Examples/Storage/StorageController.ts` | Saves area names and anchor ids in persistent storage. |
| `Examples/UI/UIController.ts` | Drives the screen flow (Get Started, My Areas, Capture, In Capture, In Area). |
| `Examples/Shared/TextInputRouter.ts` | Routes keyboard input to the focused note widget. |

## Extra info
- **Requires:** InteractionKit, UIKit, Motion and Icons. Native anchors require Specs; Preview has no anchor service
  (`isSupported` is false and the status line reports simulated anchors). Mapping, relocalization, uncertainty,
  keyboard entry and WorldQuery snapping need device verification.
- **Get started:** `AnchorExamples__PLACE_IN_SCENE.prefab`; keep its widget prefab, UI root, widget parent and
  WorldQuery references. Delete the `Guide` and `ExampleCarousel` objects for your own Lens.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md): the key session, tracking and storage rules.
  - [api-status.md](api-status.md): current, removed and device-only APIs.
  - [components.md](components.md): every class, input and public method.
  - [examples.md](examples.md): drop-in setup and anchoring your own object.
  - [troubleshooting.md](troubleshooting.md): Preview, notes, mapping and snapping issues.
