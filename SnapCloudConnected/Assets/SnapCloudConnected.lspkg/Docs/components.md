# SnapCloudConnected components

[← Agent usage index](../README.md)

## Use when

Look up an exact input, method or event name, or a default value.

## SnapCloudConnected

Import: `SnapCloudConnected.lspkg/Scripts/SnapCloudConnected` (exports `SnapCloudConnected`, `ConnectedState`, `OWNER_ANYONE`).

| Input | Type | Default | Meaning |
| --- | --- | --- | --- |
| `snapCloudRequirements` | SnapCloudRequirements | prefab: `SnapCloudRequirements` | Holds the Snap Cloud project (`supabaseProject`). Required at runtime. |
| `supabaseProject` | SupabaseProject | empty | Deprecated: use `snapCloudRequirements`. Only used when `snapCloudRequirements` isn't wired. |
| `authMode` | int | 0 | 0 = Snapchat, then anonymous; 1 = Snapchat only; 2 = Anonymous only. |
| `maxPlayers` | int (2–4) | 2 | Seats per room. The session starts when all seats are taken and ready. |
| `origin` | SceneObject | — | Local origin moved by surface placement. Synced poses are relative to it. |
| `hideOriginUntilPlaced` | bool | true | Disables `origin` until it is placed and after you leave a room. |
| `placementMode` | int | 0 | 0 = Ground, 2 = Tabletop (SurfacePlacement `PlacementMode`). Both confirm by holding still. |
| `autoReadyAfterPlacement` | bool | false | Skips the `Confirm` step. |
| `faceToFace` | bool | true | Seat frames are turned [0°, 180°, 90°, -90°] about the origin's up axis. |
| `sendRate` | float (1–20) | 10 | Maximum publishes per second for this player's owned transforms. |
| `smoothing` | float (0–30) | 12 | Exponential smoothing rate for remote transforms. 0 = snap. |
| `enableLogging` | bool | false | Logs states, statuses and Realtime events. |

| Member | Description |
| --- | --- |
| `host()` | Creates a room, then starts placement. `roomCode` is set from `Placing` on. |
| `join(code)` | Joins with a 4-digit string such as `"0427"` (leading zeros count). |
| `leave()` | Leaves the room and returns to `Offline`. |
| `placeSurface()` | Restarts placement. Clears readiness if this player was ready. |
| `confirmReady()` | Only valid in `Confirm`. Marks this player ready. |
| `registerObject(id, object, ownerSeat)` / `unregisterObject(id)` | Register or unregister a synced object by id. At most 64 objects. |
| `ownsObject(id)` | True when this player publishes the object. |
| `state`, `status`, `room`, `roomCode`, `seat`, `isHost` | Read-only session info. `seat` is 0 for the host, 1–3 for guests and -1 when not in a room. |
| `onStateChanged` / `onStatusChanged` / `onRoomChanged` | SIK `PublicApi` events: `.add(cb)` returns an unsubscribe function. `onRoomChanged` fires with `null` when you leave. |
| `getSupabaseProject()` | The project from `snapCloudRequirements`, or the deprecated `supabaseProject` when it isn't wired. `null` when neither is set. |
| `SnapCloudConnected.getInstance()` | The first instance in the scene, set in `onAwake`. |

## SnapCloudRequirements

Import: `SnapCloudConnected.lspkg/SnapCloudRequirements`. One instance, on the `SnapCloudRequirements` object (first child of the prefab root), holds the Snap Cloud project for every script. Its `supabaseProject` input is empty in the prefab.

| Member | Description |
| --- | --- |
| `supabaseProject` (input, `SupabaseProject`) | The `SupabaseProject` asset (Window → Supabase → Import Credentials). |
| `text` (input, `Text`, optional) | When set, shows the "not configured" warning while no project is assigned, and is disabled on start once configured. |
| `disableWarningsWhenConfigured` (input, bool, default true) | When configured, logs that warnings are disabled. |
| `showSetupInstructions` (input, bool, default true) | Prints setup instructions on awake when no project is assigned. |
| `enableDebugLogs` (input, bool, default true) | Debug flag; `setDebugLogging()` sets it. |
| `enableLogging` / `enableLoggingLifecycle` (inputs, bool, default false) | General and lifecycle logging for this component. Both off in the prefab; `text` is empty in the prefab. |
| `getSupabaseProject()`, `isConfigured()` | The project, and whether it is assigned (computed in `onAwake`). |
| `getSupabaseUrl()`, `getSupabasePublicToken()`, `getSupabaseHeaders()` | URL, public key and request headers. Empty when not configured. |
| `getRestApiUrl()`, `getStorageApiUrl()`, `getFunctionsApiUrl()` | Base URLs for REST, public Storage and Edge Functions. |
| `revalidate()` | Re-checks the configuration after setting the project from code. |
| `setDebugLogging(enabled)` | Sets `enableDebugLogs` at runtime. |

### Session states

`Offline` → `Connecting` → `Placing` → `Confirm` → `Waiting` → `Active`. If a player leaves or times out, `Active` goes back to `Waiting`. Losing the room (expired, or the seat was freed) goes to `Offline` with a reason in `status`.

## SyncedTransforms

Import: `SnapCloudConnected.lspkg/Scripts/SyncedTransforms`.

| Input | Type | Default | Meaning |
| --- | --- | --- | --- |
| `session` | SnapCloudConnected | empty | Empty: `SnapCloudConnected.getInstance()`. |
| `objects` | SceneObject[] | [] | Objects to sync. Their order defines the wire ids. |
| `owner` | int | -1 | -1 = Anyone (last to move); 0 = Player 1 (host); 1–3 = Player 2–4. |
| `syncId` | string | "" | Group id. Empty: this SceneObject's name. |
| `enableLogging` | bool | false | Logs registration. |

The component registers in `OnStartEvent` and unregisters in `OnDestroyEvent`. `idOf(index)` returns `"<syncId>/<index>"`. `isOwnedLocally(index)` returns true when this player publishes `objects[index]`.

Ownership: owners publish when a pose changes by more than 0.05 cm, about 0.5°, or 0.0005 in scale. For `Anyone` objects, a local move takes the object over: the player claims it with a stamp one higher than any stamp it has seen. Receivers accept the highest stamp, and the lower seat wins a tie.

## ConnectedPairingUI

Import: `SnapCloudConnected.lspkg/Scripts/ConnectedPairingUI`. Every input is optional.

| Input | Type | Shown / used |
| --- | --- | --- |
| `session` | SnapCloudConnected | Empty: `getInstance()`. |
| `statusText`, `codeText` | Text | Status line; "Room 1234 · Player 2" in a room, or the typed digits `1 2 _ _`. |
| `startPage` | SceneObject | `Offline`, not typing a code. |
| `keypadPage` | SceneObject | `Offline` after Join is tapped. |
| `roomPage` | SceneObject | Every state except `Offline` and `Connecting`. |
| `hostButton`, `joinButton`, `deleteButton`, `submitButton`, `backButton`, `readyButton`, `placeAgainButton`, `leaveButton` | RectangleButton | `readyButton` shows only in `Confirm`. `placeAgainButton` shows in `Confirm`, `Waiting` and `Active`. `submitButton` shows when 4 digits are typed. |
| `digitButtons` | SceneObject[] | 10 objects in order 0…9, each with any UI Kit button. |
| `enableLogging` | bool (default false) | General logging for the panel. |

Buttons act on `onTriggerUp`. Presses within 0.35 s after a page or button appears are ignored, so the gesture that swapped the page doesn't press what appeared under the hand. Host and Submit refresh the panel themselves: with no `supabaseProject`, the session stays `Offline` and the panel returns to the Start page.

Prefab layout (`PairingPanel`, 0, 3, -60 under `SnapCloudConnectedDemo`): a UI Kit Frame (inner size 26 × 27 cm, draggable, not scalable) with `StatusText` (top), `CodeText` with `DeleteButton` (⌫) to its right, then `StartPage` (Host, Join), `KeypadPage` (keys 1–9 in a 3 × 3 grid, then Back, 0 and Join/Submit) and `RoomPage` (Ready, then Place again and Leave). The keys are 5 × 4 cm RectangleButtons, and the page buttons are 10–12 × 4 cm. Every page is enabled in the prefab; the script hides them.

## Demo scaffolding (`Example/`)

The prefab root holds `SnapCloudRequirements`, `CredentialsWarning`, `Guide`, `ExampleCarousel` and `SnapCloudConnectedDemo`, in that order. `SnapCloudRequirements` must stay above `CredentialsWarning`, which reads it on awake. `SnapCloudConnectedDemo` carries the `SnapCloudConnected` and `SyncedTransforms` components, the `Origin` (with HostCube, GuestCube and SharedCube) and the `PairingPanel`. The scripts below only drive the demo. They are not part of the package API.

**CredentialsWarning** (`Example/CredentialsWarning/CredentialsWarning.ts`, on `CredentialsWarning`): when the Snap Cloud project isn't assigned, shows a red-framed "Credentials needed" panel in front of the user before the guide, listing what is missing. The guide and what it hides wait until "Continue without credentials" is pressed. When everything is configured, the object turns itself off and the guide shows directly.

| Input | Type | Prefab value | Meaning |
| --- | --- | --- | --- |
| `guide` | SceneObject | `Guide` | Shown after the warning. |
| `snapCloudRequirements` | ScriptComponent | `SnapCloudRequirements` | Checked for a Snap Cloud project. Empty: not checked. |
| `rsgCredentials` | ScriptComponent | empty | Remote Service Gateway credentials. This package doesn't use them. |
| `requireSnapToken` / `requireOpenAIToken` / `requireGoogleToken` | bool | false | Which RSG tokens are required. |
| `buttonLabel` | string | "Continue without credentials" | Label of the close button. |

**GuideDismissPanel** (`Example/GuideDismissPanel/GuideDismissPanel.ts`, on `Guide`): shows the guide text until the button is pressed.

| Input | Type | Prefab value | Meaning |
| --- | --- | --- | --- |
| `buttonLabel` | string | "Ok, I understood" | Button label (used when the panel is built at runtime). |
| `hideUntilDismissed` | SceneObject[] | `SnapCloudConnectedDemo`, `ExampleCarousel` | Hidden while the guide shows, then enabled again. Don't list the prefab root (it would hide the guide). |

**ExampleCarousel** (`Example/ExampleCarousel/ExampleCarousel.ts`): a panel with the example title and info, Previous/Next and a minimize button.

| Input | Type | Prefab value | Meaning |
| --- | --- | --- | --- |
| `examples` | SceneObject[] | `SnapCloudConnectedDemo` | Examples to step through; one is enabled at a time. The title comes from the object name (`Name [Title]` sets an alias). |
| `exampleInfo` | string[] | one entry | Info text per example. |
| `steps` | SceneObject[] | [] | Optional sub-examples. |
| `stepInfo` | string[] | [] | Info text per step, in the same order as `steps`. Empty entries fall back to the example info. |
| `startIndex` | float | 0 | Example shown first. |
| `previousLabel` / `nextLabel` | string | "Previous" / "Next" | Button labels. |
| `examplesPushBack` | float | 20 | Extra cm the examples are pushed behind the carousel. |
| `anchorExamples` | bool | false | Off: the surface-placed demo stays where it is. |
| `startMinimized` | bool | true | Starts collapsed to the title bar. |
| `extraPanelDrop` | float | 17 | Extra cm the panel drops below its usual spot. |

## Backend contract

See [setup](setup.md#backend-contract).
