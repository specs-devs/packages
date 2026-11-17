<p align="center">
  <img src="Docs/media/WebCapture.png" width="250px" alt="Web Capture"/>
</p>

# Web Capture

A **flexible capture framework for Specs Lenses**. It records several layers of a running Lens at
once (the scene, the wearer's camera as hardware-encoded video, the head pose, optionally the system's
AR render), keeps them aligned, saves them to a backend you own (**Snap Cloud**, or the Lens Studio
plugin while you build), and opens them in a **local front end** the moment you stop: replay from the
wearer's point of view, edit, export for any social format, and schedule the post. Scheduling needs no
accounts to plan and preview; publishing automatically needs *your own* social media API tokens in an
engine you connect (see the [guide](Docs/guide.md)).

**Step 1:** the captured objects stream to the **Web Capture portal**, which rebuilds the scene live.
**Step 2:** press **Start Capture** in the Lens (the `CapturePanel` button) and the Lens records the
layers and saves them. **Step 3:** the portal lists the recording, replays it, and lets you re-frame,
crop, trim, cut, restyle, add the SPECS logo and music, keep your hands in front of virtual objects,
export MP4/WebM, and schedule posts per platform.

Two ways to save, usable together:

- **Local** (Lens Studio): the **WebCapture** Lens Studio plugin in this package serves the portal
  at `http://127.0.0.1:47790` and talks to the Lens over `ws://127.0.0.1:47791`. Recordings are
  saved in the project's `WebCaptureRecordings/` folder. Needs **Experimental APIs** on.
- **Snap Cloud** (Specs or Lens Studio): the Lens saves to your Supabase project (Database for the
  light parts, Storage for camera video and meshes); the portal reads it with the project's public
  key. A fixed **Capture Code** per project keeps every run in one place. Needs the SQL in
  `supabase.zip` installed once.

Quick start: read the [guide](Docs/guide.md) · unzip `ExtractAtProjectRoot/WebCapturePortal.zip` at the
project root → drag `WebCapture__PLACE_IN_SCENE` into the scene → add a `CapturePanel` → press Play
(or push to Specs) → **Window → WebCapture → Open Portal**. Full steps: [setup](Docs/setup.md).

## Usage

This section ships with the package and describes the exact installed revision. Read it, then
follow the links into `Docs/` for the topic you need. It is written for both people and coding
agents. Generic Lens scripting, scene construction, Snap Cloud basics and Specs spatial design
are out of scope here.

### Package identity

- Package descriptor: `WebCapture.lspkg/package.native`
- Consumer import prefix: `WebCapture.lspkg/Scripts/`, for example
  `import {WebCapture} from "WebCapture.lspkg/Scripts/WebCapture"`. The credentials component
  `SnapCloudRequirements` is at the package root (`WebCapture.lspkg/SnapCloudRequirements`). See
  [components](Docs/components.md).
- Drop-in prefab: `WebCapture.lspkg/WebCapture__PLACE_IN_SCENE.prefab`. It's self-contained:
  dropped into an empty Specs scene (Camera, lighting, InteractionKit/UIKit), it brings the guide
  panel, the example carousel and the `WebCaptureDemo` stage (status panel, capture origin marker
  and three moving `WebCaptureTarget` objects). The stage is hidden until the guide is dismissed;
  recording starts as soon as the first object to capture appears.
- Demo scaffolding: `WebCapture.lspkg/Example/` holds the scripts and assets only the demo uses
  (`ExampleCarousel/`, `GuideDismissPanel/`, `WebCaptureDemoMotion.ts`, `Demo/` meshes and
  materials). Don't import them from your own code; delete `Guide`, `ExampleCarousel` and the
  `Demo*` objects from the prefab instance when you build your own Lens.
- Editor plugin: **WebCapture** (project-scoped; it loads with the project). It starts the local
  portal server automatically and adds the **Window → WebCapture** panel: Open Portal,
  Recordings Folder, Record, Stop & Save, Restart Server.
- Credentials (Snap Cloud mode only): assign your `SupabaseProject` on the prefab's
  `SnapCloudRequirements` object. No Remote Service Gateway tokens are used. Local mode needs no
  credentials. Scheduling needs none to plan; automatic posting needs your own social API tokens in an engine you connect.
- Required companion packages (`package_dependencies.json`): `NDKCapture` (the native camera module, imported by
  `Scripts/NdkCamera`), `SupabaseClient` (imported by
  `Scripts/CaptureTransports`), `Utilities` and `SnapDecorators` (imported by
  `SnapCloudRequirements`), `InteractionKit` and `UIKit` (imported by the `Example/` scripts),
  plus `Motion` and `Icons`
- Companion sources in `ExtractAtProjectRoot/`: `WebCapturePortal.zip` (the portal: static files,
  no build step) and `supabase.zip` (`setup.sql`, migration, backend README). Lens Studio doesn't
  import them; unzip them at the project root.

### Version and API status

Read [API status](Docs/api-status.md) before reusing older code. It lists the Current and
Internal surfaces of this revision and the file formats it reads and writes.

### Applicability

Use Web Capture to **document, review or share** what a Lens does: demo videos, bug repros, design
reviews, third-person views of a session, motion you want to restyle. It records layers (object poses and
parameters, the camera as H.265 video, the head pose), so the portal re-composites them: the result is a
re-render over the real camera video, not a screen recording. Use the
Specs capture (and the Capture Studio editor) for what the wearer actually saw; use ARKit
Spectator to let iPhones watch a Lens live in AR; use SyncKit for multi-Specs sessions.

### Package Docs (ship in `Docs/`)

- [guide](Docs/guide.md) — what the framework is and how the pieces fit; read first
- [playbook](Docs/playbook.md) — getting the most out of it, why Snap Cloud, replicating UIKit and Interaction Kit
- [cheat sheet](Docs/cheat-sheet.md) — load-bearing rules
- [setup](Docs/setup.md) — unpacking the portal, Experimental APIs, the plugin, Snap Cloud credentials and `setup.sql`
- [components](Docs/components.md) — `WebCapture`, `WebCaptureTarget`, the transports: inputs, defaults, methods
- [portal](Docs/portal.md) — Step 3: recordings, the editor, output formats, hands, logo, Schedule
- [protocol](Docs/protocol.md) — the `webcapture-scene/1` and `webcapture/1` formats, the plugin API, Snap Cloud RPCs and limits
- [API status](Docs/api-status.md) — Current / Internal for this revision
- [examples](Docs/examples.md) — prefab path and minimal compile-correct snippets
- [troubleshooting](Docs/troubleshooting.md) — status messages and symptoms → cause → fix

### Verification

1. Compile the Lens with no TypeScript errors and no `as any`. Import only from
   `WebCapture.lspkg/Scripts/` and `WebCapture.lspkg/SnapCloudRequirements`.
2. With Experimental APIs on and the project open, `http://127.0.0.1:47790/api/status` answers
   `{"ok":true,...}` and **Window → WebCapture** says *Server running*.
3. Press Play and dismiss the guide: the status Text reads `Connected · local portal`, then
   `Recording · …`; the portal's Live tab shows the three demo shapes moving.
4. After 10 s the status reads `Saved 10.0 s · WebCaptureRecordings/<name>.webcapture.json` and the
   recording appears in the portal's Recordings tab; it opens in the editor and exports a video.
5. Check the Logger for `[WebCapture]` lines (duplicate ids, more than 128 objects, failed saves).
