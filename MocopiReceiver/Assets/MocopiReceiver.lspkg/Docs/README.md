# Mocopi Receiver

## What it is
A package that brings live Sony mocopi motion capture into a Specs Lens. It receives mocopi skeleton and frame JSON
over a WebSocket relay and drives a placed avatar with bone mapping, coordinate conversion and smoothing. It is for
developers who want a full-body avatar mirroring a mocopi wearer in their space. It is an independent community
project, not affiliated with or endorsed by Sony.

## What it does
1. Drop `MocopiReceiver__PLACE_IN_SCENE.prefab` in a Specs scene. After the guide panel is dismissed,
   `PrefabPlacement` starts SurfacePlacement (horizontal mode in the example) so you pick a surface.
2. Once a surface is found it instantiates the basic avatar prefab there and hands it to `MocopiAvatarController`.
3. `MocopiWebSocketClient` connects to your relay, requests the skeleton and reconnects on its own when the link drops.
4. `MocopiMainController` routes the messages: the first `skeleton_definition` maps the mocopi bones to the
   avatar's bones by name, then each `frame_data` updates the mapped bones' local rotations (and optionally
   positions). Frames that arrive before the skeleton are dropped.
5. A Reset button (`ResetButton`) removes the avatar and restarts placement.

## Highlights
- Automatic bone mapping by name variations, with `mapBone()` / `unmapBone()` for custom rigs.
- Converts mocopi coordinates to Lens Studio space (`applyCoordinateConversion`), with `smoothFactor`
  interpolation and `avatarScale`.
- Rotation-only by default; enable `updatePositions` to write bone positions as well.
- Connection stats (frames received, average FPS, reconnect attempts) from `getStats()`.
- Ships example relays: `LocalServerExample/` (local WebSocket relay and a UDP forwarder) and
  `HostedServerExample/`. The package starts none of them.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/MocopiMainController.ts` | Routes client callbacks to the avatar; drops frames until a skeleton arrives. |
| `Scripts/MocopiWebSocketClient.ts` | WebSocket client: connect, reconnect, JSON parsing, FPS and stats. |
| `Scripts/MocopiAvatarController.ts` | Maps mocopi bones to the avatar and applies frames with conversion and smoothing. |
| `Scripts/PrefabPlacement.ts` | Runs SurfacePlacement and instantiates the avatar prefab on the found surface. |
| `Scripts/ResetButton.ts` | Button hook that restarts placement. |
| `Scripts/MocopiDataTypes.ts` | Message, bone and stats types plus the mocopi bone-name list. |

## Extra info
- **Requires:** SnapDecorators, InteractionKit, UIKit, SurfacePlacement, Utilities, Motion and Icons. A mocopi kit
  and a running relay are needed; set your own `ws` / `wss` URL on the avatar prefab's client (its serialized value
  is an instruction placeholder, not a valid URL). Host any relay on Snap-approved infrastructure only. Placement
  needs real surfaces, so the avatar only appears on Specs: the Lens Studio Preview returns no world-query hits.
- **Get started:** `MocopiReceiver__PLACE_IN_SCENE.prefab` in a Specs scene with a Camera (DeviceTracking) and
  InteractionKit; the avatar is `Prefabs/BasicAvatar/MocopiBasicAvatar/MocopiBasicAvatar.prefab`.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - prefab, callback and skeleton order; read first
  - [components.md](components.md) - every input, public method, callback and data shape
  - [api-status.md](api-status.md) - compatibility, callback ownership and source gaps
  - [examples.md](examples.md) - prefab setup, status observer, callback wrapper, relay protocol
  - [troubleshooting.md](troubleshooting.md) - connection, placement, mapping and smoothing symptoms
  - [guide.md](guide.md) - original setup tutorial and relay architecture
