# ARKit Spectator

## What it is
A package that lets people with an iPhone watch your Specs Lens live, in AR. The Lens opens a Snap Cloud
room, shows a 4-digit code and streams the poses of the SceneObjects you choose; the companion iOS app joins
with that code and draws the same objects on a real surface at real-world scale. It is for demos, audiences
and third-person recordings where viewers do not wear Specs.

## What it does
1. Drop `ARKitSpectator__PLACE_IN_SCENE` into the scene and assign a `SupabaseProject` on its
   `SnapCloudRequirements` object.
2. On start, `ARKitSpectator` signs in (Snapchat, falling back to anonymous by default), creates a room and
   writes `Spectator code` plus four digits to `roomCodeText`; the status reads
   `Room <code> · waiting for spectators`.
3. Every object with a `SpectatorEntity` (plus any `trackedObjects`) is streamed relative to the Stage Origin,
   in cm, +Y up. Publishing runs in `UpdateEvent`, only when the state changed, capped by `publishRate`, with
   a forced resend every 10 s.
4. On the phone each entity appears as a glTF/GLB model (from `assetUrl`, with animation clips) or a coloured
   placeholder `primitive`; disabled objects are published with `visible: false`.
5. Spectators are read-only. `closeRoom()` (also called on destroy) releases the code.

## Highlights
- Streams poses and metadata, not video: placement and rendering happen on the phone with its own camera.
- Per-entity glTF/GLB models from public Snap Cloud Storage or https URLs, placeholder shapes and colours,
  looping or one-shot clips via `playClip()`.
- Custom JSON per entity (`customJson` / `setData`, up to 2 KB) and per room (`roomJson` / `setRoomData`, up
  to 8 KB).
- Shared `SpectatorProtocol` types and validators; limits (64 entities, 128 KB per update) are enforced
  server-side, and over-limit entities are skipped with an `[ARKitSpectator]` warning.
- Ships the Xcode project of the iPhone app and the backend SQL as zips in `ExtractAtProjectRoot/`.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/ARKitSpectator.ts` | Host component: signs in, creates/closes the room, shows the code and publishes the state. |
| `Scripts/SpectatorEntity.ts` | Per-object component: id, model URL, placeholder primitive/colour, clips and custom JSON. |
| `Scripts/SpectatorRoomClient.ts` | Snap Cloud client: auth, room RPCs and state publishing with revision handling. |
| `Scripts/SpectatorProtocol.ts` | Wire types, limit constants and `validateEntity` / `validateState`. |
| `SnapCloudRequirements.ts` | Holds the `SupabaseProject` credentials asset the host reads. |
| `Example/SpectatorDemoMotion.ts` | Demo-only motion for the three sample entities. |

## Extra info
- **Requires:** SnapDecorators, InteractionKit, UIKit, SupabaseClient, Utilities, Motion, Icons. A Snap Cloud
  project with `setup.sql` installed and *Anonymous Sign-Ins* enabled (the iPhone app signs in anonymously).
  The iOS app must be unzipped from `ExtractAtProjectRoot/iOS.zip` and built in Xcode with your own signing
  team. The 4-digit code is an invitation, not a password: do not stream private data.
- **Get started:** `ARKitSpectator__PLACE_IN_SCENE.prefab`; then add `SpectatorEntity` to the objects to
  stream. Remove the `Guide`, `ExampleCarousel` and `Demo*` objects when building your own Lens.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) — load-bearing rules; read first
  - [setup.md](setup.md) — credentials, `setup.sql`, anonymous sign-in, Storage models, building the iOS app
  - [components.md](components.md) — inputs, defaults and methods of every component
  - [protocol.md](protocol.md) — wire format, coordinate frame, backend RPCs and limits
  - [api-status.md](api-status.md) — Current / Internal / Removed surfaces
  - [examples.md](examples.md) — prefab path and minimal snippets
  - [troubleshooting.md](troubleshooting.md) — status messages and symptoms to fixes
