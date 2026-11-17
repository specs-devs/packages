# AnchorExamples examples

[← Agent usage index](../README.md)

## Use when

Build the full persistence demo or reuse AnchorController for your own target.

## Getting Started

### Option A: drop the example into your scene

1. Install the package, then drag **`AnchorExamples__PLACE_IN_SCENE`** into your scene. It carries the full example: the code-built UIKit screens, the widget prefabs, storage, and the anchor session flow.
2. Make sure the scene has the **InteractionKit** prefab (the example uses SIK interactors). The camera is found automatically through SIK — wiring the `Camera` input on `AppController` is optional.
3. Send the Lens to Specs and pinch **New Area**. Look around slowly while the area is mapped and saved, then place widgets from the panel. Exit the area, relaunch the Lens and select the area again: the widgets come back where you left them.

> **NOTE:** In Lens Studio Preview there is no anchor service, so the flow runs against a remembered widget-parent pose (see the status line "Area ready (Lens Studio: anchors are simulated)"). Anchors are exercised on device.

### Option B: anchor your own object

```typescript
import {AnchorController} from "AnchorExamples.lspkg/Scripts/AnchorController"

@component
export class AnchoredObject extends BaseScriptComponent {
  @input target: SceneObject
  private anchors = AnchorController.getInstance()
  private static readonly KEY = "myLens.anchorId"

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => void this.start())
  }

  private async start() {
    const session = await this.anchors.openSession("home")
    if (!session) return // Lens Studio Preview or no anchor service

    const store = global.persistentStorageSystem.store
    const savedId = store.getString(AnchoredObject.KEY)
    let anchor = savedId ? await this.anchors.resolveAnchor(savedId) : null

    if (!anchor) {
      const pose = this.target.getTransform().getWorldTransform()
      anchor = await this.anchors.createAndSaveWorldAnchor(pose)
      if (!anchor) return
      store.putString(AnchoredObject.KEY, anchor.id)
    }

    this.anchors.onTrackingStateChanged.add(({target, state}) => {
      if (target === this.target) print(`anchor: ${AnchorController.stateName(state)}`)
    })
    this.anchors.track(this.target, anchor)
  }
}
```

### Option C: persistent content with one component

Add **`Examples/Native/PersistentAnchorExample`** to any SceneObject and assign `content`. On Specs it opens the area session, restores last launch's anchor (stored id, then nearby discovery) or creates and saves a new one in front of the wearer, and shows `content` only while the anchor is `Tracking` with positional uncertainty under `maxUncertaintyCm`. Wire a button to `placeHere()` to move it, `forget()` to delete it.

Custom Locations: anchors of type `Custom` give their real-world position through the controller.

```typescript
const anchors = AnchorController.getInstance()
anchors.onAnchorNearby.add(async (anchor) => {
  if (!AnchorController.isCustom(anchor)) return
  const geo = await anchors.getGeoPosition(anchor) // null without the location permission or in Preview
  if (geo) print(`${anchor.id}: ${geo.latitude}, ${geo.longitude}`)
})
```

## Examples

The example Lens has five screens driven by `AppController`:

- **Get Started / My Areas**: pick a saved area or create a new one (up to 9).
- **New area**: a world anchor is created in front of you and saved while you look around; the widget parent is tracked by an `AnchorComponent` from the start, so widgets can be placed right away.
- **Existing area**: the stored anchor id is resolved (`resolveAnchor`); if that fails, the first anchor reported by `onAnchorNearby` is adopted. Widgets are restored one frame after the anchor reports `Tracking`.
- **Capture**: an explicit scan flow (`CaptureFlowManager`) that opens the session early so mapping warms up, then creates and saves the anchor with a 90 s fallback.
- **In area**: spawn note / watch / photo widgets, minimize / release them, snap them to surfaces with WorldQuery, exit to save the layout.

Widget transforms are stored relative to the widget parent, so they survive the anchor resolving to a different world origin in the next session.

## API

The following is a signature reference, not a runnable script.

```text
// Module
setModule(module: AnchorModule): void          // optional; default is require("LensStudio:AnchorModule")
get isSupported(): boolean                     // false in Lens Studio Preview
get isEditor(): boolean

// Session
openSession(area: string | null = null): Promise<AnchorModule.AnchorSession | null>
closeSession(): Promise<void>
get hasActiveSession(): boolean
get currentArea(): string | null
get isSavePending(): boolean

// Anchors
createWorldAnchor(toWorldFromAnchor: mat4): Promise<AnchorModule.Anchor | null>
createWorldAnchorAt(position: vec3, forward?: vec3): Promise<AnchorModule.Anchor | null>   // gravity aligned
saveAnchor(anchor): Promise<boolean>
createAndSaveWorldAnchor(toWorldFromAnchor: mat4): Promise<AnchorModule.Anchor | null>
resolveAnchor(anchorId: string): Promise<AnchorModule.Anchor | null>
deleteAnchor(anchor): Promise<boolean>
clearArea(): Promise<boolean>
clearAllAnchors(): Promise<boolean>

// Tracking
track(target: SceneObject, anchor): AnchorComponent | null
untrack(target: SceneObject): void
untrackAll(): void
getTrackedAnchor(target): AnchorModule.Anchor | null
getTrackingState(target): AnchorModule.AnchorTrackingState | null
isTracking(target): boolean
static stateName(state): string

// Events (SIK Event / PublicApi)
onSessionOpened, onSessionClosed: string | null
onAnchorNearby, onAnchorSaved, onAnchorDeleted: AnchorModule.Anchor
onTrackingStateChanged: {target, anchor, state}
onUncertaintyChanged: {target, anchor, uncertaintyCm}
```

## How It Works

- The native API keeps identity and tracking apart: an `Anchor` is passive data with an `id`; setting it on an `AnchorComponent` starts tracking and the component moves its SceneObject.
- There is no `updateAnchor`. To move an anchor, create and save a new one at the new pose, re-point the tracker, then delete the old anchor (the controller's `deleteAnchor` untracks automatically).
- `saveAnchor` only succeeds once the device has mapped enough of the area, so the example keeps the wearer looking around and shows a status line until the save resolves.
- Areas are just labels (`AnchorSessionOptions.area`); keep them under ~250 m² and open one session per area.

## Tips

- Persist `Anchor.id` right after `saveAnchor` resolves; unsaved anchors cannot be resolved in a later session.
- Store content transforms relative to the anchored parent, never in world space.
- Watch `onPositionalUncertaintyChanged` for a live accuracy estimate in centimetres and hide content while it is large.
- Reference implementation of the raw API: the AXPLens `CVSpatialAnchors` project on the internal GitHub.
