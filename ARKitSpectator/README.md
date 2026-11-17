<p align="center">
  <img src="./Assets/AssetImage/ARKitSpectator.png" width="250px" alt="ARKit Spectator"/>
</p>

# ARKit Spectator

Let people with an iPhone watch your Lens in AR. ARKit Spectator creates a **Snap Cloud** room,
shows a **4-digit code** and streams the poses of the SceneObjects you choose. Each phone runs the
included **ARKit Spectator** iOS app: it joins with the code, places the scene on a real table or
floor, and draws the same objects there at real-world scale, from its own camera. Spectators are
read-only; only the Lens that created the room can change it.

Objects can appear on the phone as a **glTF/GLB model** (streamed and cached, with animation
clips) or as a coloured placeholder shape, and can carry **custom JSON** for your own logic.

## Features

- One prefab: room creation, 4-digit room code display, connection status
- Stream any number of SceneObjects (up to 64): position, rotation, scale and visibility relative
  to a stage origin you choose
- Per-object `SpectatorEntity`: glTF/GLB URL (or a path in your Snap Cloud Storage), placeholder
  shape and colour, looping or one-shot clips, custom JSON
- Room-level custom JSON
- Change-only publishing at 1–15 updates per second; phones smooth motion between updates
- Snap Cloud security: read-only spectators, host-only writes, server-side validation, room
  lifetime and rate limits
- iPhone app (SwiftUI + ARKit): join by code, surface placement, move/rotate/scale and lock,
  glTF streaming with a bounded cache, people occlusion, screen recording

## Setup

> **Requirement: Anonymous Sign-Ins.** The iPhone app signs in **anonymously**, so the Snap Cloud
> project must have *Authentication → Anonymous Sign-Ins* enabled. Without it, no phone can join.
> It hasn't been confirmed yet that every Snap Cloud project allows this setting.


If you cloned this project, `iOS/` and `supabase/` are already at its root; the ZIPs in
`ExtractAtProjectRoot/` are the same sources for Asset Library installs.


1. **Snap Cloud project.** Open *Window → Supabase*, sign in, create or pick a project, and
   choose **Import Credentials**. This adds a `SupabaseProject` asset to your Asset Browser.
2. **Install the backend once.** In the project's dashboard, open *SQL Editor*, paste
   `setup.sql` (in `ExtractAtProjectRoot/supabase.zip`) and run it. Then enable
   **Anonymous Sign-Ins** under *Authentication*. See `supabase/README.md` in the zip for the
   CLI route and the security model.
3. **Drag `ARKitSpectator__PLACE_IN_SCENE` into your scene.** Select its `SnapCloudRequirements`
   object and assign your `SupabaseProject` asset to **Supabase Project**. Until you do, a red
   **Credentials needed** panel shows before the guide. Leave **Stage Origin** empty to
   use the prefab, or point it at your table / play-area root.
4. **Choose what to stream.** Add a `SpectatorEntity` component to each object the phone should
   see (set **Asset Url** for a model), or drag objects into **Tracked Objects**.
5. **Run the Lens.** The panel shows the **Spectator code**.
6. **Build the iPhone app.** Unzip `ExtractAtProjectRoot/iOS.zip` at your project root (next to
   `Assets/`), open `iOS/ARKitSpectator.xcodeproj` in Xcode, select your signing team and run it
   on an iPhone. In the app's **Settings**, enter the same Snap Cloud URL and **public** key.
7. **Enter the code** on the phone, tap a surface to place the scene, then **Lock**.

> Never paste keys into scripts or commit them. The Lens reads credentials from the
> `SupabaseProject` asset on `SnapCloudRequirements`; the phone needs only the project's public (publishable / anon) key.

## Components

### ARKitSpectator

| Input | Description |
| --- | --- |
| Supabase Project | Your Snap Cloud credentials asset (required) |
| Auth Mode | *Snapchat, then anonymous* (default), *Snapchat only* or *Anonymous only* |
| Auto Create Room | Create a room on start. Off: call `createRoom()` yourself |
| Stage Origin | Reference frame for every pose. Empty = this SceneObject |
| Include Spectator Entities | Stream every object that has a `SpectatorEntity` |
| Tracked Objects | Extra objects to stream without a `SpectatorEntity` (drawn as boxes) |
| Room Json | Optional room-level JSON (≤ 8 KB) |
| Publish Rate | Maximum updates per second (1–15). Only changes are sent |
| Position Tolerance | Rounding of positions in cm; smaller changes count as unchanged |
| Room Code Text / Room Code Format | Text that shows the code; `{code}` is replaced |
| Status Text | Optional Text for connection status |
| Debug Logs | Print connection details |

Script API:

```typescript
import {ARKitSpectator} from "ARKitSpectator.lspkg/Scripts/ARKitSpectator"

const spectator = this.spectatorScript as ARKitSpectator
spectator.onRoomReady((code) => print("Spectator code " + code))
spectator.setRoomData({round: 2, score: [3, 1]})
await spectator.closeRoom()             // phones see an empty stage, the code stops working
const code = await spectator.createRoom() // new room, new code
```

### SpectatorEntity

| Input | Description |
| --- | --- |
| Entity Id | Stable id, unique in the room. Empty = SceneObject name |
| Asset Url | `https://…` glTF/GLB, or `<public bucket>/<path>` in your Snap Cloud Storage |
| Primitive / Color | Placeholder when there is no model: box, sphere, cylinder, plane or none. Primitives are 10 cm reference shapes scaled by the object's scale |
| Loop Clip | glTF clip to loop on the phone (empty = the model's first clip) |
| Custom Json | Optional JSON sent with this entity (≤ 2 KB) |

```typescript
entity.playClip("Jump")          // one-shot; call again to re-trigger
entity.playClip("Run", true)     // loop
entity.setData({hp: 3})
```

Disabled objects stay in the room as hidden. Destroyed objects disappear from the phone.

## How it works

```
Lens (host)                          Snap Cloud                            iPhone (spectator)
ARKitSpectator ── spectator_create_room ──▶ spectator_rooms (4-digit code)
               ── spectator_publish ─────▶ spectator_states (revision, state)
                                             │ Realtime Postgres Changes (RLS)
                                             └────────────────────────────▶ ARKit Spectator app
                                     spectator_join_room ◀────────────────── code typed by viewer
```

Poses are centimetres relative to the stage origin (+Y up). The phone places that origin where
the viewer taps and turns its front (+Z) toward them; each phone aligns its own copy (manual
alignment, not shared AR mapping). Updates are revision-checked so stale writes are rejected;
phones also take a recovery snapshot every 8 seconds.

Wire format of one entity:

```json
{"id": "robot", "p": [0, 0, -40], "r": [0, 0, 0, 1], "s": [1, 1, 1],
 "asset": "https://<project>/storage/v1/object/public/models/robot.glb",
 "primitive": "box", "color": "#14A08D", "visible": true,
 "clip": {"name": "Wave", "loop": false, "id": "3"}, "data": {"hp": 3}}
```

## Limits

64 entities, 128 KB per update, 2 KB entity `data`, 8 KB room `data`, 5 active rooms per host,
24 h room lifetime, 20 join attempts per user per minute, 15 updates per second. The phone
downloads models only over https from your project host or hosts you allow in its Settings
(≤ 50 MB per file, 250 MB cache). The room code is an invitation, not a password: don't stream
anything private.

## Package contents

```
ARKitSpectator.lspkg/
├── ARKitSpectator__PLACE_IN_SCENE.prefab   # drop-in host: ARKitSpectator + code/status text
├── Scripts/
│   ├── ARKitSpectator.ts                  # host component (room, publishing, code display)
│   ├── SpectatorEntity.ts                 # per-object appearance, clips, custom JSON
│   ├── SpectatorRoomClient.ts             # Snap Cloud sign-in, RPCs, revision handling
│   └── SpectatorProtocol.ts               # wire format and validation
├── ExtractAtProjectRoot/                  # unzip at your project root
│   ├── iOS.zip                            # → iOS/  Xcode project of the iPhone app
│   └── supabase.zip                       # → supabase/  setup.sql, migration, README
├── package.native
└── package_dependencies.json
```

Requires SupabaseClient 2.3.0. Spectating needs an internet connection on both sides.
