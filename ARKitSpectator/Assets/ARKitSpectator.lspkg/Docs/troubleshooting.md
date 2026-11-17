# ARKitSpectator troubleshooting

[← Agent usage index](../README.md)

## Use when

Read when the status Text shows an error, a phone can't join, or objects are missing or wrong
on the phone. Read it before adding a workaround.

## Lens status messages

| Status / log | Cause | Fix |
|---|---|---|
| `Assign a SupabaseProject (Snap Cloud credentials) on SnapCloudRequirements` | No project on `SnapCloudRequirements` (or, when **Snap Cloud Requirements** isn't wired, on the deprecated `ARKitSpectator.supabaseProject`) | Import credentials and assign the asset on `SnapCloudRequirements` ([setup](setup.md)) |
| `Snap Cloud credentials are not readable here: …` | Reading `SupabaseProject.url` / `publicToken` threw. SupabaseClient's own tests note that these fields can be blocked outside a paired Specs device | Test on a device, or check the SupabaseClient README for your Lens Studio build |
| `The SupabaseProject asset has no URL or public key` | Incomplete credentials asset | Re-import the credentials |
| `Could not create a room: Sign-in failed: …` | Snapchat sign-in failed and anonymous sign-in is disabled (or `authMode` is `snapchat`) | Enable Anonymous Sign-Ins, or use `snapchat-then-anonymous` |
| `Could not create a room: … Could not find the function …` / `Invalid room response — is supabase/setup.sql installed?` | Backend not installed on this project | Run `setup.sql` ([setup](setup.md)) |
| `Could not create a room: Room limit reached (5 active rooms)…` | This identity has 5 unexpired rooms (rooms stay open for 24 h unless closed) | Call `closeRoom()` before creating rooms repeatedly, or wait |
| `Publishing paused: Only the room host may publish` | Room expired (24 h) or closed elsewhere | `createRoom()` again |
| `Publishing paused: Invalid entity <id>` / `Unknown entity field` | Data the local check missed (for example multi-byte JSON over the byte limit) | Shrink `data`. The state is resent every 10 s |
| `Network interrupted — retrying` | Request failed | Recovers on the next change or the 10 s resend |
| `[ARKitSpectator] Not streaming '<id>': …` | Entity failed validation: id, vector, asset not https, color, data > 2 KB | Fix the field named in the message |
| `[ARKitSpectator] Duplicate entity id …` | Two objects share a name or `entityId` | Set unique **Entity Id**s |
| `[ARKitSpectator] More than 64 objects …` | Over the entity limit | Stream fewer objects, or move detail into `data` |
| `[ARKitSpectator] State not published: …` | Whole state over a limit (room data > 8 KB, total > 128 KB) | Reduce `data` |

## Red "Credentials needed" panel

At start a red-framed **Credentials needed** panel appears before the guide, with the line
`CredentialsWarning: Snap Cloud project: assign a SupabaseProject on SnapCloudRequirements …` in
the Logger. It's expected on a fresh install: the prefab ships without credentials. Assign your
`SupabaseProject` on the prefab's `SnapCloudRequirements` object ([setup](setup.md)) and it no
longer shows. **Continue without credentials** closes it for this run; the guide and the demo
then show, but no room is created.

## Lens scene

| Symptom | Cause | Fix |
|---|---|---|
| A box that is 10 cm in the Lens is 1 m on the phone | Lens Studio's Box/Sphere meshes are 1 cm at scale 1, so the mesh presets use scale 10 for a 10 cm shape. The phone draws primitives at 10 cm × the entity's scale, so a streamed object with scale 10 shows as 1 m | Put `SpectatorEntity` on a parent with the real size as its scale (0.8 = 8 cm) and the mesh as a child at scale 10, as the demo scene's `DemoCube` / `DemoSphere` / `DemoOrbiter` do |
| Status Text unreadable on the code panel | Text sizes on the `CodePanel` Frame are small in world space (sizes below about 50 are hard to read at 1 m) | Keep `StatusText` at 50 or more; long messages wrap to two lines inside the 24 cm text area |
| Nothing happens until the prefab is enabled | The room is created on the prefab's first `OnStartEvent`. If the object starts disabled (for example hidden behind an intro panel), the status stays at its prefab text until it's enabled | Expected. Enable the object, or set `autoCreateRoom` off and call `createRoom()` when you're ready |
| Moving the whole stage at runtime | Poses are relative to the Stage Origin, so moving or re-anchoring the stage (`SpectatorDemo` in the prefab) together with its children changes nothing on the phone | Expected. Only motion relative to the origin is streamed |

## Phone (iOS app)

| Symptom | Cause | Fix |
|---|---|---|
| `Anonymous sign-ins are disabled` (or another sign-in error on Join) | The project doesn't allow anonymous sign-in, which the app requires | Enable *Authentication → Anonymous Sign-Ins* on the project ([setup](setup.md)) |
| `Add your Snap Cloud URL and public key in Settings` / Join disabled | App not configured | Enter the URL (https) and public key |
| `Room not found or expired` | Wrong code, room closed, or older than 24 h | Use the code currently shown in the Lens |
| `Too many attempts. Wait a minute and try again.` | More than 20 joins per minute for this identity | Wait a minute |
| `This identity hosts the room…` | The phone signed in as the same user that created the room | Spectate from another device or identity |
| `The host closed room …` | The host called `closeRoom()`, was destroyed, or the room expired | Get a new code |
| `Realtime reconnecting · refreshing every 8 s` | Realtime socket down | Updates continue every 8 s; check the network |
| `Model host not allowed: …` | `asset` isn't on the project host or an allowed host | Add the host in Settings → *Extra model hosts*, or move the file to project Storage |
| Objects tiny or huge | Placeholders are 10 cm × scale; glTF uses metres; the stage origin is scaled | Fix the object or origin scale, or use the app's display-scale slider |
| Scene faces the wrong way | The phone yaws the stage so +Z faces the viewer when placed | Rotate in Move mode (two fingers or ±15°) |
| Model stays a translucent box | Download or parse failed (see the orange message), or the file is over 50 MB | Check the URL is public and the file is a valid glTF/GLB |
| Clip doesn't play | The name doesn't match a glTF animation name | Use the exact clip name; empty = the first clip loops |

## Known gaps in this revision

- Not yet verified on a physical iPhone against a hosted Snap Cloud project. The backend and
  Realtime flow were tested on a local Supabase stack.
- Whether anonymous sign-in is available on every Snap Cloud project hasn't been confirmed. The
  phone requires it.
- `onRoomClosed` fires only for `closeRoom()`, not for the 24 h expiry.
