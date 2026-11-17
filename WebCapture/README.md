<p align="center">
  <img src="./Assets/AssetImage/WebCapture.png" width="250px" alt="Web Capture"/>
</p>

# Web Capture

Mirror a Lens in your browser, record what happens while it plays, and turn the recording into a
video. Web Capture works in three steps:

1. **Scene sync.** While the Lens runs, the objects you choose (poses, shapes, colours, text and
   the camera) stream to the **Web Capture portal**, which rebuilds the scene live in the browser.
   Locally through the **WebCapture Lens Studio plugin**, or through **Snap Cloud** (Supabase) from
   Specs.
2. **Record.** Press Play: the Lens records keyframe tracks (only what changed) and saves a light
   recording file (`webcapture/1` JSON, tens of KB for ten seconds) into the project's
   `WebCaptureRecordings/` folder, or into the Snap Cloud session.
3. **Edit.** Open the recording in the portal. It replays the scene, lets you re-frame it (Lens
   point of view, free camera or keyframed camera shots), trim and cut it, change its speed,
   restyle it, add titles and music, and export **MP4/WebM**, like the Specs Capture Studio editor.

Everything is cross-platform: the plugin only uses Lens Studio's own APIs and the portal is a
static web app that runs in any recent browser. Nothing is hosted outside your computer and your
Snap Cloud project.

## Features

- One prefab: live sync, auto-record on Play, status text, plus a guided demo stage
- Capture objects with a `WebCaptureTarget` component, a list of Tracked Objects, or every mesh /
  Text under a Capture Root (up to 128 objects); poses relative to a capture origin you choose
- Change-only keyframes with position/rotation tolerances, 5–60 samples per second, the camera
  track, visibility / colour / Text changes and code markers (`mark()`)
- Lens Studio plugin (**Window → WebCapture**): serves the portal at `http://127.0.0.1:47790`,
  receives the Lens over `ws://127.0.0.1:47791`, saves recordings in the project, and has
  **Record / Stop & Save** buttons that drive the running Lens
- Snap Cloud mode for Specs: a 6-character session code; the portal opens the live scene and the
  saved recordings with your project's public key
- Portal editor: Lens POV / free camera / camera shots, trim in/out, cuts, 0.25–4× speed, five
  looks, background colour, labels, per-object hide / colour / label / move, titles, music track,
  watermark, 16:9 / 9:16 / 1:1 output at 30 or 60 fps, saved edits that never change the tracks

## Setup

If you cloned this project, `WebCapturePortal/` and `supabase/` are already at its root; the
ZIPs in `ExtractAtProjectRoot/` are the same sources for Asset Library installs.

1. **Portal:** unzip `WebCapture.lspkg/ExtractAtProjectRoot/WebCapturePortal.zip` at the project
   root, next to `Assets/`. The plugin serves it from there.
2. **Local mode (Lens Studio):** enable **Project Settings → Experimental APIs** (Lens Studio only
   lets a Lens open the plugin's `ws://127.0.0.1` socket with it on), drag
   `WebCapture__PLACE_IN_SCENE` into the scene, press Play, then **Window → WebCapture → Open
   Portal**.
3. **Snap Cloud mode (Specs):** import your credentials (**Window → Supabase → Import
   Credentials**), assign the `SupabaseProject` on the prefab's `SnapCloudRequirements`, run
   `supabase/setup.sql` once in the project's SQL Editor, and set **Mode** to *Snap Cloud*. Enter
   the project URL and public key in the portal's **Settings** and the session code the Lens shows.

Full steps are in the package docs: [setup](Assets/WebCapture.lspkg/Docs/setup.md),
[portal](Assets/WebCapture.lspkg/Docs/portal.md).

## Testing

- Portal model: `cd WebCapturePortal && npm test` (Node 18+).
- End to end with Lens Studio open and Preview playing:
  `cd WebCapturePortal && npm i --no-save playwright-core && node tests/portal.e2e.mjs`.
- Backend SQL: `supabase/setup.sql` is safe to re-run; see [protocol](Assets/WebCapture.lspkg/Docs/protocol.md).
