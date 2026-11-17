<p align="center">
  <img src="Docs/media/ARKitSpectator.png" width="250px" alt="ARKit Spectator"/>
</p>

# ARKit Spectator

Let people with an iPhone watch your Lens in AR. ARKit Spectator creates a **Snap Cloud** room,
shows a **4-digit code** and streams the poses of the SceneObjects you choose. The included
**ARKit Spectator** iOS app joins with that code, places the scene on a real surface and draws
the same objects there at real-world scale, from the phone's own camera. Spectators are
read-only: only the Lens that created the room can change it.

On the phone, an object appears as a **glTF/GLB model** (streamed, cached, with animation clips)
or as a coloured placeholder shape. Objects can also carry **custom JSON**.

Quick start: import your Snap Cloud credentials → run `setup.sql` once → drag
`ARKitSpectator__PLACE_IN_SCENE` into the scene and assign the credentials → add
`SpectatorEntity` to the objects to stream → unzip and build the iOS app → enter the code.
Full steps: [setup](Docs/setup.md).

> **Requirement: Anonymous Sign-Ins.** The iPhone app signs in **anonymously**, so the Snap Cloud
> project must have *Authentication → Anonymous Sign-Ins* enabled. Without it, no phone can join.
> It hasn't been confirmed yet that every Snap Cloud project allows this setting.

## Usage

This section ships with the package and describes the exact installed revision. Read it, then
follow the links into `Docs/` for the topic you need. It is written for both people and coding
agents. Generic Lens scripting, scene construction, Snap Cloud basics and Specs spatial design
are out of scope here.

### Package identity

- Package descriptor: `ARKitSpectator.lspkg/package.native`
- Consumer import prefix: `ARKitSpectator.lspkg/Scripts/`, for example
  `import {ARKitSpectator} from "ARKitSpectator.lspkg/Scripts/ARKitSpectator"`. The runtime
  modules are directly under `Scripts/`; the one exception is the credentials component
  `SnapCloudRequirements`, at the package root (`ARKitSpectator.lspkg/SnapCloudRequirements`).
  See [components](Docs/components.md).
- Drop-in prefab: `ARKitSpectator.lspkg/ARKitSpectator__PLACE_IN_SCENE.prefab`. It's
  self-contained: dropped into an empty Specs scene (Camera, lighting, SIK/UIKit), it brings the
  guide panel, the example carousel and the `SpectatorDemo` stage (code panel, stage marker and
  three moving `SpectatorEntity` objects)
- Demo scaffolding: `ARKitSpectator.lspkg/Example/` holds the scripts and assets only the demo
  uses (`ExampleCarousel/`, `GuideDismissPanel/`, `SpectatorDemoMotion.ts`, `Demo/` meshes and
  materials). Don't import them from your own code; delete `Guide`, `ExampleCarousel` and the
  `Demo*` objects from the prefab instance when you build your own Lens. See
  [components](Docs/components.md#demo-scaffolding-example)
- Credentials: assign your `SupabaseProject` on the prefab's `SnapCloudRequirements` object;
  `ARKitSpectator` reads it through **Snap Cloud Requirements** (its own **Supabase Project**
  input is a deprecated fallback). No Remote Service Gateway tokens are used. Until a project is
  set, a red-framed **Credentials needed** panel (`Example/CredentialsWarning/`) shows before the
  guide. See [setup](Docs/setup.md)
- Required companion packages (`package_dependencies.json`): `SupabaseClient` (imported by
  `Scripts/SpectatorRoomClient`), `Utilities` and `SnapDecorators` (imported by
  `SnapCloudRequirements`), `InteractionKit` and `UIKit` (imported by the
  `Example/` scripts), plus `Motion` and `Icons`
- Companion sources in `ExtractAtProjectRoot/`: `iOS.zip` (Xcode project of the iPhone app) and
  `supabase.zip` (`setup.sql`, migration, backend README). Lens Studio doesn't import them; unzip
  them at the project root.

### Version and API status

Read [API status](Docs/api-status.md) before reusing older code. It lists the Current,
Internal and Removed surfaces of this revision, including what changed from the game prototype
this package was generalized from.

### Applicability

Use ARKit Spectator when people **without Specs** should watch a Lens live from an iPhone, in AR,
read-only: demos, audiences, recording a third-person view. It streams poses and metadata, not
video. Use SyncKit (Connected Lenses) for multi-Specs shared sessions where every
participant interacts. Use SupabaseClient directly for general cloud data that isn't a live 3D view.

### Package Docs (ship in `Docs/`)

- [cheat sheet](Docs/cheat-sheet.md) — load-bearing rules; read first
- [setup](Docs/setup.md) — Snap Cloud credentials, `setup.sql`, anonymous sign-in, Storage models, unzipping and building the iOS app
- [components](Docs/components.md) — `ARKitSpectator`, `SpectatorEntity` and the protocol module: inputs, defaults, methods
- [protocol](Docs/protocol.md) — wire format, coordinate frame, backend RPCs, limits; read when writing your own spectator or changing the schema
- [API status](Docs/api-status.md) — Current / Internal / Removed for this revision
- [examples](Docs/examples.md) — prefab path and minimal compile-correct snippets
- [troubleshooting](Docs/troubleshooting.md) — status messages and symptoms → cause → fix

### Verification

1. Compile the Lens with no TypeScript errors and no `as any`. Import only from
   `ARKitSpectator.lspkg/Scripts/` and `ARKitSpectator.lspkg/SnapCloudRequirements`.
2. Assign a `SupabaseProject` on `SnapCloudRequirements`. Without one, the red **Credentials
   needed** panel shows before the guide and the status Text reads
   "Assign a SupabaseProject (Snap Cloud credentials) on SnapCloudRequirements" (that's the check
   when no credentials exist).
3. With credentials and `setup.sql` installed, the code Text shows `Spectator code` plus four
   digits, and the status reads `Room <code> · waiting for spectators`.
4. Join that code from the iOS app: every `SpectatorEntity` appears, moves when it moves in the
   Lens, and hides when its object is disabled.
5. Check the Logger for `[ARKitSpectator]` warnings (invalid entity, duplicate id, more than 64
   objects). They mean something isn't streamed.
