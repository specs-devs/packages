# ARKitSpectator components

[← Agent usage index](../README.md)

## Use when

Read when adding, configuring or scripting `ARKitSpectator` or `SpectatorEntity`, or when you
need an exact import path, input name, default or method signature.

## Import paths

```typescript
import {ARKitSpectator} from "ARKitSpectator.lspkg/Scripts/ARKitSpectator"
import {SpectatorEntity} from "ARKitSpectator.lspkg/Scripts/SpectatorEntity"
import {SpectatorState, SpectatorEntityState, validateState} from "ARKitSpectator.lspkg/Scripts/SpectatorProtocol"
import {SnapCloudRequirements} from "ARKitSpectator.lspkg/SnapCloudRequirements" // package root, not Scripts/
```

## Prefab: `ARKitSpectator__PLACE_IN_SCENE`

The root SceneObject carries the `ARKitSpectator` script. Its children, in order:

- `SnapCloudRequirements`: holds the `SupabaseProject` (empty in the shipped prefab), wired into
  `ARKitSpectator.snapCloudRequirements` and `CredentialsWarning`. It sits first so it has
  checked its project before the warning wakes up.
- `CredentialsWarning`: the red **Credentials needed** panel shown before the guide while the
  project is missing (see [Demo scaffolding](#demo-scaffolding-example)).
- `Guide`: the guide panel (`GuideDismissPanel`, see [Demo scaffolding](#demo-scaffolding-example)).
- `ExampleCarousel`: the example panel that frames the demo.
- `SpectatorDemo`: the stage, wired as `stageOrigin` (the **Stage Origin**). Its child
  `CodePanel` (22 cm above the origin) is a UIKit `Frame` (inner size 26 × 13 cm,
  no auto show/hide, translation, scaling or billboarding) holding `CodeText` (→ `roomCodeText`, size
  110) and `StatusText` (→ `statusText`, size 56, wraps to two lines). `StageOriginMarker` is a flat
  12 cm teal disc (`Visuals/Disc.mesh` + `Visuals/StageOriginMarker.mat` on `Visuals/unlit.graphShader`, 40 % alpha) that
  shows where the origin is; it is not streamed. `DemoCube`, `DemoSphere` and `DemoOrbiter` each
  carry a `SpectatorEntity` and the demo-only `SpectatorDemoMotion` (spin, bob, orbit).

The other `ARKitSpectator` inputs keep their defaults; `supabaseProject` (deprecated) and
`SnapCloudRequirements.supabaseProject` are empty. For your own
Lens, delete the three `Demo*` objects and parent your own `SpectatorEntity` objects under
`SpectatorDemo`. Don't scale the root or the stage.

## Demo scaffolding (`Example/`)

Demo-only scripts and assets shipped in `ARKitSpectator.lspkg/Example/` so the prefab works on
its own. They aren't part of the package API; remove the objects that use them when you build
your own Lens.

| File | Used by | Key inputs |
|---|---|---|
| `Example/CredentialsWarning/CredentialsWarning.ts` | `CredentialsWarning` | `guide` (`Guide`), `snapCloudRequirements` (`SnapCloudRequirements`), `rsgCredentials` (empty), `requireSnapToken` / `requireOpenAIToken` / `requireGoogleToken` (`false`), `buttonLabel` (`"Continue without credentials"`). Missing credentials: holds the guide (and what it hides) and shows a red-framed list until closed. All set: turns itself off. Public `findMissing(): string[]` returns the list it shows (empty when everything is set) |
| `Example/GuideDismissPanel/GuideDismissPanel.ts` | `Guide` | `buttonLabel` (`"Ok, I understood"`), `hideUntilDismissed: SceneObject[]` (`ExampleCarousel`, `SpectatorDemo`): hidden while the guide shows, enabled when it's closed |
| `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (`SpectatorDemo`), `exampleInfo: string[]`, `steps: SceneObject[]` (empty), `stepInfo: string[]` (empty; one line per step, same order as `steps`, an empty entry falls back to the step's example info), `startIndex` (`0`), `previousLabel` / `nextLabel`, `examplesPushBack` (`20` cm), `anchorExamples` (`true`), `startMinimized` (`false`), `extraPanelDrop` (`0`) |
| `Example/SpectatorDemoMotion.ts` | `DemoCube`, `DemoSphere`, `DemoOrbiter` | `motion` (`spin` / `bob` / `orbit`), `speed` (cycles/s, `0.25`), `amplitude` (cm, `10`) |
| `Example/Demo/` | `Demo*` meshes | `Box.mesh`, `Sphere.mesh`, `DemoAmber` / `DemoMint` / `DemoTeal` materials, `simple_pbr.graphShader`, `Base.png` |

With a single example the carousel shows only its title, the description and the minimize
button; Previous / Next appear when `examples` lists more than one object.

## SnapCloudRequirements (credentials)

`ARKitSpectator.lspkg/SnapCloudRequirements.ts`, at the package root. It holds the
`SupabaseProject` that `ARKitSpectator.snapCloudRequirements` and `CredentialsWarning` read.

| Input | Type | Default | Notes |
|---|---|---|---|
| `supabaseProject` | `SupabaseProject` | none | Created with *Window → Supabase → Import Credentials*. Empty in the shipped prefab |
| `text` | `Text` | none | Optional; shows the "not configured" warning, disabled once configured |
| `disableWarningsWhenConfigured` | boolean | `true` | |
| `showSetupInstructions` | boolean | `true` | Prints setup steps at awake while unconfigured (only when logging is on) |
| `enableDebugLogs` | boolean | `true` | Stored and set by `setDebugLogging()`; prints are gated by the two flags below |
| `enableLogging` | boolean | `false` | Gates all of its prints, including the console warning |
| `enableLoggingLifecycle` | boolean | `false` | Lifecycle prints |

| Member | Signature | Notes |
|---|---|---|
| `getSupabaseProject` | `(): SupabaseProject` | The assigned project (undefined when unset) |
| `isConfigured` | `(): boolean` | `true` when a project is assigned (checked at awake and by `revalidate()`) |
| `getSupabaseUrl` / `getSupabasePublicToken` | `(): string` | `""` when unset |
| `getSupabaseHeaders` | `(): {[key: string]: string}` | `Content-Type`, `apikey`, `Authorization: Bearer <publicToken>`; `{}` when unset |
| `getStorageApiUrl` / `getRestApiUrl` / `getFunctionsApiUrl` | `(): string` | Project URL + `/storage/v1/object/public/`, `/rest/v1/`, `/functions/v1/` |
| `setDebugLogging` | `(enabled: boolean): void` | Sets `enableDebugLogs` |
| `revalidate` | `(): void` | Re-checks the configuration after you assign a project from code |

## ARKitSpectator (host)

Creates the room, shows the code and publishes the state. Use one per Lens.

| Input | Type | Default | Meaning |
|---|---|---|---|
| `snapCloudRequirements` | `SnapCloudRequirements` | prefab's `SnapCloudRequirements` | Holds the Snap Cloud credentials asset (`url`, `publicToken`); required unless the deprecated input is used |
| `supabaseProject` | `SupabaseProject` | none | Deprecated: use `snapCloudRequirements`. Read only when `snapCloudRequirements` isn't wired |
| `authMode` | string (combo) | `"snapchat-then-anonymous"` | `"snapchat-then-anonymous"`: `signInWithSnapchat()`, falling back to `signInAnonymously()`. Also `"snapchat"` or `"anonymous"`. An existing session is reused |
| `autoCreateRoom` | boolean | `true` | Calls `createRoom()` on `OnStartEvent` |
| `stageOrigin` | `SceneObject` | none → this SceneObject | Reference frame for all poses |
| `includeSpectatorEntities` | boolean | `true` | Stream every registered `SpectatorEntity` |
| `trackedObjects` | `SceneObject[]` | `[]` | Extra objects streamed without metadata (the phone draws a default box). Objects that also have a `SpectatorEntity` are streamed once, with its metadata |
| `roomJson` | string | `""` | Room-level JSON parsed in `onAwake`. Invalid JSON is ignored with a warning |
| `publishRate` | float (slider 1–15) | `5` | Maximum publish attempts per second. Clamped to 1–15 |
| `positionTolerance` | float | `0.2` | Position rounding: ≥ 1 → whole cm, ≥ 0.1 → 0.1 cm, otherwise 0.01 cm. Rotation is rounded to 4 decimals, scale to 3 |
| `roomCodeText` | `Text` | none | Shows `roomCodeFormat` with `{code}` replaced, or `Spectator code\n····` while offline |
| `roomCodeFormat` | string | `"Spectator code\n{code}"` | Code display format |
| `statusText` | `Text` | none | Connection status messages ([troubleshooting](troubleshooting.md)) |
| `debugLogs` | boolean | `false` | Prints status and connection details with an `[ARKitSpectator]` prefix. Warnings print regardless |

| Member | Signature | Notes |
|---|---|---|
| `roomCode` | `get roomCode(): string \| null` | Four digits (`ROOM_CODE_PATTERN = /^[0-9]{4}$/`) while a room is open, `null` while offline |
| `status` | `get status(): string` | Last status message |
| `onRoomReady` | `(callback: (code: string) => void): void` | Fires after each successful `createRoom()`, and immediately if a room already exists |
| `onRoomClosed` | `(callback: () => void): void` | Fires after `closeRoom()`. It doesn't fire on 24 h expiry |
| `setRoomData` | `(data: unknown): void` | Replaces room `data` (≤ 8 KB) for the next publish |
| `createRoom` | `(): Promise<string \| null>` | Closes any current room, signs in if needed, creates a room. Returns the code, or `null` on failure (see `status`) |
| `closeRoom` | `(): Promise<void>` | Calls `spectator_leave_room`: phones see the room closed, and the code is released |
| `buildState` | `(): SpectatorState` | The state that would be published now (for debugging and tests) |
| `getSupabaseProject` | `(): SupabaseProject \| null` | The project in use: `snapCloudRequirements.getSupabaseProject()`, else the deprecated `supabaseProject` |

Publishing runs in `UpdateEvent`. It sends only when the serialized state changed, with at most
one request in flight (the newest state wins), and a forced resend every 10 s. On destroy, the
room is closed.

## SpectatorEntity (per streamed object)

Add one to each SceneObject the phone should draw. It registers itself in `onAwake` (an object
disabled at Lens start registers when it's first enabled) and unregisters on destroy. A disabled
object, or a disabled component, is published with `visible: false`.

| Input | Type | Default | Meaning |
|---|---|---|---|
| `entityId` | string | `""` → SceneObject name | Stable id, cut to 80 characters |
| `assetUrl` | string | `""` | `https://…` glTF/GLB, or `<public bucket>/<path>`. The host turns a path into `<project url>/storage/v1/object/public/<path>` |
| `primitive` | string (combo) | `"box"` | `box`, `sphere`, `cylinder`, `plane` or `none`. Placeholder when there's no model (and shown translucent while the model loads) |
| `color` | `vec4` (color) | `(0.55, 0.82, 0.78, 1)` | Placeholder tint, sent as `#RRGGBB` (`#RRGGBBAA` when alpha < 1) |
| `loopClip` | string | `""` | glTF clip to loop. Empty: the phone loops the model's first clip |
| `customJson` | string | `""` | JSON parsed in `onAwake`, sent as entity `data` (≤ 2 KB) |

| Member | Signature | Notes |
|---|---|---|
| `SpectatorEntity.all` | `static readonly all: SpectatorEntity[]` | Registered entities, in order. Read-only |
| `id` | `get id(): string` | Published id |
| `setData` / `getData` | `(data: unknown): void` / `(): unknown` | Custom JSON |
| `playClip` | `(name: string, loop = false): void` | One-shot clips get a fresh `id`, so repeating a name replays it |
| `getClip`, `getCustomData`, `getPrimitive`, `getColorHex` | getters | Used by the host when it builds the state |

## SpectatorProtocol

Types and validators shared with the backend and the iOS app: `SpectatorState`,
`SpectatorEntityState`, `SpectatorClip`, `SpectatorPrimitive`, `SpectatorRoomInfo`,
`validateEntity(e): string | null`, `validateState(s): string | null` (`null` = valid, otherwise
the reason), `round(value, decimals)`, plus the limit constants. See [protocol](protocol.md).
