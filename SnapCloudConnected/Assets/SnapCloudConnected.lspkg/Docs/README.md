# Snap Cloud Connected

## What it is
A package that adds two- to four-player sessions to a Specs Lens through your own Snap Cloud project (tables and
Realtime). The host creates a room and gets a 4-digit code, guests join with it, and the transforms of the objects
you choose stay in sync for everyone. Poses are relative to each player's own placed origin, so players do not need
to share a physical space. It is for developers who want remote multiplayer without Connected Lenses colocation.

## What it does
1. The host taps **Host**: a room is created and a 4-digit code is shown. Guests tap **Join** and enter the code on
   a keypad.
2. Each player places their own origin on a surface (SurfacePlacement, Ground or Tabletop) and taps
   **Ready**.
3. When every seat is taken and every player is ready, the session goes `Active`: objects listed in a
   `SyncedTransforms` component publish and receive position, rotation and scale, with smoothing on remote objects.
4. If a player leaves or times out, the others go back to `Waiting`; Leave returns a player to `Offline`.

The session moves through `Offline` → `Connecting` → `Placing` → `Confirm` → `Waiting` → `Active`. The demo
prefab adds a pairing panel, host, guest and shared cubes under `Origin`, a credentials warning, an onboarding
`Guide` and an `ExampleCarousel`.

## Highlights
- Ownership per object group: `Anyone` (the last player to move it), the host, or one specific seat.
- `faceToFace` turns each seat's frame about the origin (player 2 by 180°) so players face each other.
- Secure backend: row-level security limits reads to room members, each player writes only its own row, and writes
  are validated server-side (2 to 4 players, 5 rooms per host, 24 h lifetime, rate-limited joins).
- Credentials live in one place, a `SupabaseProject` asset on `SnapCloudRequirements`; no tokens in scripts.
- Optional auth modes: Snapchat then anonymous (default), Snapchat only, or anonymous only.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/SnapCloudConnected.ts` | Session component: `host()`, `join(code)`, `leave()`, placement, readiness, state events and object registry. |
| `Scripts/SyncedTransforms.ts` | Registers a list of SceneObjects for sync with an owner and a `syncId`. |
| `Scripts/ConnectedPairingUI.ts` | Pairing panel: Host / Join, keypad, Ready, Place again and Leave, driven by session state. |
| `Scripts/ConnectedRoomClient.ts` | Internal transport: sign-in, room RPCs, Realtime, heartbeat and publishing. |
| `Scripts/ConnectedProtocol.ts` | Shared types, limits and parsers for rooms and transform rows. |
| `SnapCloudRequirements.ts` | Holds the Snap Cloud project and exposes its URLs and headers to every script. |
| `Example/CredentialsWarning/CredentialsWarning.ts` | Demo panel shown before the guide while no project is assigned. |

## Extra info
- **Requires:** InteractionKit, UIKit, SupabaseClient, SurfacePlacement, Utilities, SnapDecorators, Motion and
  Icons. The scene needs the Interaction Kit (SIK) prefab, a Camera with World Device Tracking and Internet access.
  Run `Supabase/snapcloud-connected-setup.sql` once in your Snap Cloud project's SQL Editor; anonymous auth must be
  enabled there for the anonymous modes. Test with two Specs, or Specs plus the Lens Studio Preview.
- **Get started:** `SnapCloudConnected__PLACE_IN_SCENE.prefab`. Assign your `SupabaseProject` (Window → Supabase →
  Import Credentials) to `SnapCloudRequirements`, put shared content under `Origin` and keep `SyncedTransforms`
  outside it. Delete `CredentialsWarning`, `Guide` and `ExampleCarousel` for your own Lens.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md): the rules that most often break a Lens; read first.
  - [setup.md](setup.md): credentials, the SQL script, auth settings and the backend contract.
  - [components.md](components.md): every component, input, method and event.
  - [examples.md](examples.md): prefab setup, your own lobby UI and registering objects from code.
  - [api-status.md](api-status.md): current, internal and deprecated members.
  - [troubleshooting.md](troubleshooting.md): symptom, cause and fix.
