# ARKit Spectator — iOS app

SwiftUI + ARKit app that watches an **ARKit Spectator** room as a read-only spectator. Enter the
4-digit code shown in the Lens, tap a real surface to place the scene, and the objects the Lens
streams appear there at real-world scale, seen from the phone's own camera. The app never writes
to the room.

- iOS 17 or later. AR needs a physical iPhone/iPad with ARKit (the Simulator shows a virtual floor).
- Dependencies (Swift Package Manager): [GLTFKit2](https://github.com/warrenm/GLTFKit2) for glTF/GLB
  models with skins and animation clips, [supabase-swift](https://github.com/supabase/supabase-swift)
  for sign-in, room RPCs and Realtime. Versions are pinned in `Package.resolved`.

## Build

1. Open `ARKitSpectator.xcodeproj` in Xcode 16 or later.
   `project.yml` is the [XcodeGen](https://github.com/yonaskolb/XcodeGen) source of truth: after
   editing it, run `xcodegen generate` in this folder to regenerate the project.
2. Select the **ARKitSpectator** target → *Signing & Capabilities* → choose your team, and change
   the bundle identifier (`com.example.arkitspectator`) to your own.
3. Pick your iPhone and **Run**.

Simulator build check (no signing needed):

```sh
xcodebuild -project ARKitSpectator.xcodeproj -scheme ARKitSpectator \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

Unit tests (protocol decoding, colours, asset host allowlist): `xcodebuild … -destination 'platform=iOS Simulator,name=<iPhone>' test`.

## Configure Snap Cloud

The app needs the **same Snap Cloud project as the Lens** (URL + public key). Either:

- enter them in the app (**Settings**, opens automatically on first launch), or
- fill `ARKitSpectator/Resources/SpectatorConfig.plist` before building (`SupabaseURL`,
  `SupabasePublishableKey`, optional `AllowedAssetHosts`).

Use only the project's **public** (publishable / anon) key — never a service-role or secret key.
The project must have `supabase/setup.sql` installed and **Anonymous Sign-Ins** enabled
(Authentication settings), because the app signs in anonymously.

Models are downloaded only over https from the project's own host (public Storage buckets) or
from hosts listed in *Extra model hosts*. Files are cached on disk (50 MB per file, 250 MB total).

## Use

1. Start the Lens; it shows a 4-digit **Spectator code**.
2. In the app, enter the code and tap **Join**.
3. Scan a surface slowly and tap it. The stage origin of the Lens lands there, its front (+Z)
   facing you. Drag to move, two fingers to rotate, pinch (or the slider) to scale, then **Lock**.
   Each phone aligns its own copy; this is manual alignment, not shared AR mapping.
4. **Record screen** records the AR view with ReplayKit; review, save to Photos or share.
5. **Leave room** returns to the code screen. If the host closes the room, the app notices within
   a few seconds.

## What is drawn

| Entity field | On the phone |
| --- | --- |
| `p`, `r`, `s` | Pose relative to the placed stage (cm → m), smoothed between updates |
| `asset` | glTF/GLB model (translucent placeholder while it downloads) |
| `primitive`, `color` | 10 cm reference box / sphere / cylinder / plane scaled by `s`, when there is no model |
| `clip` | Animation clip by name (`loop`, `id` re-triggers one-shots). No clip: the first clip loops |
| `visible: false` | Hidden |
| `data` | Decoded (`JSONValue`) and available to your own code; not drawn |

## Files

- `Sources/SpectatorSession.swift` — anonymous sign-in, `spectator_join_room`, Realtime Postgres
  Changes on `spectator_states`, recovery snapshot every 8 s, leave.
- `Sources/SpectatorScene.swift` — ARKit placement, move/rotate/scale, entity nodes, lighting and
  shadows, people occlusion.
- `Sources/AssetCache.swift` — bounded glTF download cache and `LoadedModel` (clips).
- `Sources/SpectatorProtocol.swift` — the wire format (mirrors the Lens `SpectatorProtocol.ts`).
- `Sources/SpectatorConfig.swift` — credentials and asset host allowlist.
- `Sources/ScreenRecorder.swift` — ReplayKit recording.
- `Sources/ARKitSpectatorApp.swift` — UI (join, placement, settings, recording review).
