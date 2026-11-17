<p align="center">
  <img src="Docs/media/SnapCloudConnected.png" width="250px" alt="SnapCloudConnected"/>
</p>

# Snap Cloud Connected

Snap Cloud Connected adds multiplayer sessions to a Lens using Snap Cloud (Supabase tables and Realtime). The host creates a room and gets a 4-digit code, and the other player enters that code to join. Each player places their own origin on a surface and confirms they are ready. After that, the position, rotation and scale of the SceneObjects you choose stay in sync for everyone.

Poses are relative to each player's placed origin, so players don't need to share a physical space or coordinate frame.

## Features

- **4-digit pairing**: The host reads out a room code. Guests type it on a keypad.
- **Per-player surface placement**: Uses the SurfacePlacement package (Ground or Tabletop).
- **Readiness gate**: The session starts only when every seat is taken and every player is ready.
- **Transform sync**: Sync a list of SceneObjects, owned by anyone (the last player to move an object), the host, or one specific player.
- **Secure by default**: RLS lets only room members read a room, each player writes only its own row, and every write is validated. Limits: 2–4 players per room, 5 rooms per host, 24 h lifetime, 20 join attempts per minute.

## Quick Start

1. In Lens Studio, open **Window → Supabase**, sign in, then create or import a project and click **Import Credentials**. This creates a `SupabaseProject` asset.
2. In the Snap Cloud dashboard's SQL Editor, run `Supabase/snapcloud-connected-setup.sql` from this package once.
3. Drag `SnapCloudConnected__PLACE_IN_SCENE` into your scene and assign your `SupabaseProject` to **Supabase Project** on its `SnapCloudRequirements` child. The prefab ships with this input empty, so a red "Credentials needed" panel shows before the guide until you assign it.
4. Put your shared content under **Origin**, then list the objects in a `SyncedTransforms` component.
5. On two devices (or a device plus the Preview): one player taps **Host**, the other taps **Join** and enters the code. Each player places their surface and taps **Ready**.

## Usage

This section ships with the package and describes the exact installed revision.
Read it, then follow the links into `Docs/` for the topic you need. It is
written for both people and coding agents; generic Lens scripting, scene
construction, and Specs spatial design are out of scope here.

### Package identity

- Package descriptor: `SnapCloudConnected.lspkg/package.native` (holds the package version)
- Consumer import prefix: `SnapCloudConnected.lspkg/Scripts/`. The components are
  `SnapCloudConnected.lspkg/Scripts/SnapCloudConnected`, `.../SyncedTransforms` and
  `.../ConnectedPairingUI`. See [components](Docs/components.md).
- Prefab entry point: `SnapCloudConnected__PLACE_IN_SCENE.prefab`. It is self-contained:
  drop it into a Specs scene (Camera with Device Tracking + SIK/UI Kit) and you get the
  full demo, with `SnapCloudRequirements` (the one place the Snap Cloud project is
  assigned; every script reads it from there), the red "Credentials needed" warning
  (`CredentialsWarning`, shown before the guide while the project is missing), the
  guide panel ("Ok, I understood"), the example carousel, and
  `SnapCloudConnectedDemo` (the session components, the Origin with the host, guest
  and shared cubes, and the pairing panel).
- Demo scaffolding: `Example/` holds the warning, guide and carousel scripts
  (`Example/CredentialsWarning`, `Example/GuideDismissPanel`, `Example/ExampleCarousel`) and the demo cube materials
  and meshes (`Example/Materials`, `Example/Meshes`). Your own Lens doesn't need them.
- Credentials: assign the `SupabaseProject` on `SnapCloudRequirements`
  (`SnapCloudConnected.lspkg/SnapCloudRequirements`). `SnapCloudConnected.supabaseProject`
  is deprecated and only used when `snapCloudRequirements` isn't wired. No Remote
  Service Gateway tokens are needed. See [setup](Docs/setup.md).
- Backend: `Supabase/snapcloud-connected-setup.sql`. See [setup](Docs/setup.md).
- Required companion packages (`package_dependencies.json`): `SupabaseClient`,
  `SurfacePlacement`, `InteractionKit`, `UIKit`
  and `Utilities` (imported by the scripts), plus `SnapDecorators`,
  `Motion` and `Icons`. The scene needs the SIK prefab, a Camera with
  Device Tracking (World), and Internet access.

### API status

[API status](Docs/api-status.md) lists the
current surface and the internal members.

### Applicability

Use this package when two to four Specs players need to see the same objects move,
each around their own placed origin, through your own Snap Cloud project. To stream a
Lens to iPhone viewers, use ARKit Spectator. For colocated sessions over Connected
Lenses, use Sync Kit. For general Supabase calls, use SupabaseClient or Snap Cloud
Examples.

### Package Docs (ship in Docs/)

- [Cheat sheet](Docs/cheat-sheet.md): read this first. It covers the rules that most often break a lens.
- [Setup](Docs/setup.md): credentials, the SQL script, the Auth settings and the backend contract.
- [Components](Docs/components.md): every component, input, method and event.
- [Examples](Docs/examples.md): prefab drag-and-drop, your own lobby UI, and registering objects from code.
- [Troubleshooting](Docs/troubleshooting.md): symptom → cause → fix.
- [API status](Docs/api-status.md): what's current in this revision.

### Verification

1. TypeScript compiles with no `as any` around package types.
2. With no Supabase Project assigned, the red "Credentials needed" panel shows first; after "Continue without credentials" and the guide, the status line reads "Add your Snap Cloud project: assign a SupabaseProject…" from the start. Host, or Join + 4 digits, returns to the Start page with that line, and nothing throws.
3. Host shows a 4-digit code. A second instance joins with it, and both reach `Placing`.
4. After both players place and confirm, both reach `Active`. Moving a synced object on one player's side moves it on the other.
5. Leave on one side sends the other back to `Waiting`.
