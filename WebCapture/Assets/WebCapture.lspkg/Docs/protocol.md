# Web Capture formats, plugin API and backend

[← Agent usage index](../README.md)

## Use when

Read when writing your own viewer or importer, scripting the plugin API, or changing the Snap Cloud
schema. Types are in `Scripts/WebCaptureProtocol.ts`; the portal's reader is
`WebCapturePortal/src/model.js`.

## Coordinates

Positions in cm and rotations as quaternions `[x, y, z, w]`, relative to the Capture Origin, +Y up,
right-handed (Lens Studio and three.js agree). Scale is a factor divided by the origin's world scale.
A **pose** is 10 numbers `[px, py, pz, qx, qy, qz, qw, sx, sy, sz]`; a **camera pose** is 8
`[px, py, pz, qx, qy, qz, qw, fovDegrees]`.

## Scene snapshot `webcapture-scene/1` (Step 1)

```json
{ "format": "webcapture-scene/1", "session": "ses-…", "revision": 42, "time": 12.3, "lens": "Lens Studio Preview",
  "objects": [ { "id": "cube", "name": "DemoCube", "parent": null, "primitive": "box", "color": [0.08, 0.63, 0.55, 1],
                 "bounds": [-5, -5, -5, 5, 5, 5], "mesh": "Box", "text": "…" } ],
  "poses": { "cube": [-15, 4, 0, 0, 0.06, 0, 0.998, 0.8, 0.8, 0.8] },
  "params": { "cube": { "visible": true, "color": [0.08, 0.63, 0.55, 1], "text": "…" } },
  "camera": [0, -33, 126, -0.1, 0, 0, 0.99, 36.6],
  "recording": { "id": "rec-…", "elapsed": 3.2 } }
```

`primitive`: `box | sphere | cylinder | plane | text | mesh | empty`. `bounds` (local, cm) and `mesh`
only for meshes. `recording` is null when not recording.

## Recording `webcapture/1` (Step 2)

```json
{ "format": "webcapture/1",
  "meta": { "id": "rec-…", "name": "…", "lens": "…", "createdAt": "ISO-8601", "rate": 30, "duration": 10.02,
            "packageVersion": "4.0.0", "device": "Lens Studio", "tolerance": { "position": 0.1, "rotation": 0.001, "scale": 0.001 } },
  "objects": [ …same as the snapshot… ],
  "tracks": { "cube": { "t": [0, 0.033, …], "v": [10 numbers per t…] } },
  "camera": { "t": [ … ], "v": [8 numbers per t…] },
  "params": [ { "t": 0, "id": "cube", "params": { "visible": true } } ],
  "markers": [ { "t": 2.5, "label": "hit" } ],
  "edits": { …written by the portal only… } }
```

Optional, added when **Capture Geometry / Capture Background** are on (older recordings simply lack them):

```json
{ "objects": [ { "id": "ring", "primitive": "mesh", "meshId": "m0",
                 "materials": [ { "tex": "t0", "twoSided": false, "alpha": "opaque" } ] } ],
  "assets": { "meshes": { "m0": { "p": "<b64 Float32 xyz>", "n": "<b64 normals>", "u": "<b64 Float32 uv>", "i": "<b64 Uint32 indices>" } },
              "textures": { "t0": "data:image/jpeg;base64,…" } },
  "background": { "t": [0, 0.17, …], "frames": [ "data:image/jpeg;base64,…", … ] } }
```

With **NDK Video** on (Specs), `background` carries the camera as hardware-encoded H.265 instead of JPEG frames:
`background.video = {codec: "hevc", batches: [base64 NKC1 packets…], startNs, fps, offsetNs}`. A packet is
`[u8 layer][u8 flags, bit 0 = key][u16 0][u64 ts_ns][u32 size][Annex-B access unit]` (little-endian); a frame captured at packet
time `ts` is at `(ts + offsetNs - startNs) / 1e9` s on the recording's timeline (`offsetNs` is measured by the Lens: the packet
clock runs a fixed few seconds ahead of the pose clock). The portal plays it with WebCodecs (recent Chrome or Safari).
`tools/nkc_extract.py` pulls the video out of a recording and checks it with ffmpeg.

On Specs the recording also carries the real color camera in `meta.camera`
(`{focal: [fx, fy], principal: [cx, cy], resolution: [w, h], p: [x, y, z], q: [x, y, z, w]}`): focal length and principal point
in pixels at `resolution`, and the camera's position and rotation in the device space (the recorded camera pose is the
device's). The portal draws the scene through this camera: position = device pose + offset, field of view from the focal
length, and the principal point shifted in the projection. `meta.aspect` is `resolution` width / height. Lens distortion is
not modelled.

Meshes over 40k triangles or 65k vertices and textures over 2048 px are skipped (the portal falls back to the
bounds box). `background.frames[i]` is the background texture at recording time `t[i]`; the portal draws the
latest frame at or before the playhead behind the 3D scene. Snap Cloud drops `background`, then `assets`, when a
recording would exceed ~5.5 MB.

A key is stored only when the object moved past the tolerance, so the value **holds** until the next
key. The portal interpolates between consecutive keys at most 0.25 s apart (linear position/scale,
slerp rotation) and holds across longer gaps. `params` are cumulative: the latest key at or before
`t` wins per field.

`edits` (portal): `trim [in, out] | null`, `cuts [{start, end}]`, `speed`, `objects {id: {hidden,
color, label, offset [px, py, pz, rxDeg, ryDeg, rzDeg, scale]}}`, `look`, `background`,
`showLabels`, `camera {mode: recorded | orbit | shots, shots [{t, pose [eye xyz, target xyz], fov}]}`,
`titles [{text, start, end, position, size}]` (clip time), `music {name, volume, offset}`,
`watermark`, `output {preset, fps}`.

## Plugin API (Local mode)

`http://127.0.0.1:47790`, CORS open, JSON:

| Request | Result |
|---|---|
| `GET /api/status` | Server, project, portal and recordings folders, connected Lenses, last scene, recent saves and errors |
| `GET /api/live?since=<rev>` | `{revision, scene}`; `scene` is null when nothing newer than `since` |
| `POST /api/command` | Always `403`: a capture is started and stopped only inside the Lens (its Start Capture button) |
| `GET /api/recordings` | `{recordings: [{file, name, id, duration, objects, bytes, createdAt, edited}]}` |
| `GET / PUT / DELETE /api/recordings/<file>` | Read, overwrite (must be `webcapture/1`), delete |
| `GET /…` | Portal files from `<project>/WebCapturePortal/` |

Lens socket `ws://127.0.0.1:47791`: see [components](components.md#transports-scriptscapturetransportsts).
Files: `<project>/WebCaptureRecordings/<name> <id>.webcapture.json`.

## Snap Cloud backend (`supabase/setup.sql`)

Tables `webcapture_sessions` and `webcapture_recordings` are closed to clients (no grants); everything
goes through `SECURITY DEFINER` functions:

| Function | Caller | Purpose |
|---|---|---|
| `webcapture_create_session(p_lens)` → `{id, code}` | signed-in Lens | Opens a session; 6-character code from `23456789ABCDEFGHJKMNPQRSTUVWXYZ` |
| `webcapture_publish_scene(p_session, p_revision, p_scene)` → revision | owner | Latest snapshot (≤ 512 KB, `webcapture-scene/1`) |
| `webcapture_save_recording(p_session, p_recording)` → id | owner | Stores a recording (≤ 6 MB, `webcapture/1`, `edits` stripped), max 50 per session |
| `webcapture_end_session(p_session)` | owner | Marks it ended |
| `webcapture_get_session(p_code)` | anyone with the code | `{code, lens, status, revision, scene, updated_at}` |
| `webcapture_list_recordings(p_code)` → JSON array | anyone with the code | `[{id, name, duration, objects, bytes, created_at, edited}]` |
| `webcapture_get_recording(p_code, p_id)` | anyone with the code | `{data, edits}` |
| `webcapture_save_edits(p_code, p_id, p_edits)` → boolean | anyone with the code | Portal edits (≤ 512 KB); never the tracks |

Sessions expire after 7 days; an owner keeps at most 10 open (the oldest is closed). The code is the
read/edit key: share it only with people who may see the capture.

## Camera layer, AR reference and panels (added in 4.0.0)

`background.video` (NDK Video on, Specs): `{codec: "hevc", batches, startNs, fps, offsetNs, ar?}`.
`ar` (Record Reference on) has the same packet format, from the system's AR layer rendered from the
capture camera's viewpoint (`eye` 4): `{codec: "hevc", batches, eye}`. The camera calibration is stored
in `meta.camera` (resolution, focal, principal point, offset to the head). The 1920×1440 camera stream is
a zoomed and panned crop of that calibration (zoom 1.325, pan 0.164 / 0.010); the portal applies it.

New `objects[].primitive` value `panel` (a flat UIKit rectangle) with `size` (cm), `radius`, `border`,
`layer`; `textSize` for text. New object fields are optional and ignored by older readers.

`edits` additions written by the portal: `output {preset, fps, fit, zoom, panX, panY}`, `logo {on, color,
place, size}`, `device {mode, opacity, tint, hands, handsDebug}`, `hands` (landmarks per frame), `stab`
(drift correction), `videoProfile`. Older recordings are normalised on open (`watermark` becomes `logo.on`).

## Scheduler queue (`webcapture-schedule/1`, in the browser)

`{format, updatedAt, posts: [{id, recordingKey, recordingSource, videoName, durationSec, title, runAt,
status, approvedBy, approvedAt, jobId, targets: {<platform>: {enabled, caption, status, url, error,
postedAt}}, error, createdAt, exportedPresets}]}`. Platforms: `tiktok x youtube instagram snapchat
linkedin reddit`. Statuses: `review scheduled posting posted partial failed cancelled`. Engine
contract: `schedule(post) → {jobId}`, `cancel(post)`,
optional `poll(posts) → {jobId: job}` (see `WebCapturePortal/src/scheduler.js`).
