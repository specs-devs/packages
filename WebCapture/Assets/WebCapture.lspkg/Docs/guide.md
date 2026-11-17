# Web Capture guide

[← Agent usage index](../README.md)

## Use when

Read this first if you are new to the package. It explains what Web Capture is, how the pieces fit
together, and the shortest path from a Lens to an edited, scheduled post. The other documents go
deep on one topic each.

## What Web Capture is

Web Capture is a **flexible capture framework for Specs Lenses**. It records several layers of
information about a running Lens at the same time, keeps them aligned on one clock, and hands them
to a **post-production front end** that opens on your computer the moment you stop recording.

It is built around three ideas:

1. **Capture layers, not pixels.** A recording is a set of independent tracks: the scene (poses,
   shapes, colours, text and real mesh geometry of the objects you choose), the wearer's camera
   (hardware-encoded H.265 through the NDK, with the real camera calibration), the head pose, and
   optionally the system's own AR render as a reference. Because the layers stay separate, the
   portal can re-render the virtual content from the camera's point of view, change how it is
   composited, crop it for any social format, and cut the Lens objects out from behind the wearer's
   hands, none of which is possible from a flattened screen recording.
2. **Performant on the glasses.** Scene tracks store keyframes only when something moved. The camera
   is encoded in hardware and streamed as packets, polled a few at a time, so recording adds little
   frame cost. The camera can be kept warm so Start Capture is instant.
3. **A backend you own, a front end you run locally.** Recordings go to your **Snap Cloud** project
   (or to the Lens Studio plugin when you work in the editor). The **portal** is a static web app you
   run on your own machine at `http://127.0.0.1:47790`: it lists new recordings as soon as they are
   saved, replays them, edits them, exports video and queues them for posting. Nothing is hosted by
   the package.

## The pieces

| Piece | Where | What it does |
|---|---|---|
| **Lens components** | `Scripts/` (prefab `WebCapture__PLACE_IN_SCENE`) | `WebCapture` records the layers; `WebCaptureTarget` marks objects; `CapturePanel` is a UIKit panel with one Start / Stop Capture button |
| **Camera layer** | `Scripts/NdkCamera.ts`, `CaptureAssets.ts` | H.265 camera stream through the `NDKCapture` package; calibration and clock alignment |
| **Backend** | `ExtractAtProjectRoot/supabase.zip` | Snap Cloud (Supabase) schema and Storage bucket for recordings, a fixed capture code per project |
| **Editor plugin** | `Plugins/WebCapture` | Serves the portal locally, receives recordings from the Lens in Lens Studio, saves them in `WebCaptureRecordings/` |
| **Portal** | `ExtractAtProjectRoot/WebCapturePortal.zip` | Recordings, Edit, Schedule |

## Quick path

1. **Install** the package. It brings `NDKCapture` (the native camera module), UIKit and the other
   dependencies with it.
2. **Unzip** `WebCapturePortal.zip` at the project root. In Lens Studio the plugin starts serving it
   automatically. Open **Window → WebCapture → Open Portal**.
3. **Drop** `WebCapture__PLACE_IN_SCENE` into your scene. Put the objects you want in the replay under
   it (or add `WebCaptureTarget` to them). Add a `CapturePanel` to show the Start / Stop Capture
   button on the glasses.
4. **For Specs**, create a Snap Cloud project, run `supabase/setup.sql`, `storage.sql` and
   `fixed-code.sql` once, assign your `SupabaseProject` to the prefab's `SnapCloudRequirements`, and
   enter the project URL and public key in the portal's Settings. Set a **Capture Code** so every
   run lands in the same place.
5. **Push** the Lens to the glasses. Press **Start Capture**, do your thing, press it again.
6. **Open** the portal. The recording is in **Recordings**. Open it, wait for the loader (it locks the
   camera to the scene and finds your hands), press play.
7. **Edit**: trim, cut, speed, titles, music; choose an output format (original 1464×1098, 1080×1920
   vertical, 1920×1080 horizontal, 3:4, 4:5 or 9:16), a crop, the SPECS logo, how transparent the
   virtual layer is, and whether your hands stay in front. Export MP4 or WebM.
8. **Schedule**: plan the post per platform, with captions that you edit in a phone preview.

## The three portal tabs

- **Recordings** lists what the Lens saved (Lens Studio and Snap Cloud in one list). Open one to edit.
- **Edit** replays the recording from the wearer's point of view. The virtual layer is composited
  like the glasses' additive display (or naturally), at the opacity you choose. **Lock to
  environment** removes the drag between the camera video and the head pose; **Hands in front** uses
  an on-device hand model in your browser (no frame leaves your machine) so your real hands cover
  virtual objects. The export crops to the format you pick; the crop is shared by the video, the 3D
  layer and the hand cut-out so virtual objects stay on the real world.
- **Schedule** plans posts: pick a recording, tick platforms (TikTok, X, YouTube Shorts, Instagram
  Reels, Snapchat Spotlight, LinkedIn, Reddit), write each caption in a phone preview that shows the
  platform's format, and pick a time. Limits and lengths are checked per platform.

## Scheduling and your own accounts

The queue, the phone previews, the checks and the per-platform export formats work with **no
credentials**. The built-in engine only queues: at the post's time it shows *Due now* and you post
the exported video yourself and paste the link with **I posted it**.

To publish automatically you connect an **engine** that holds *your own* social media API tokens
(TikTok, X, YouTube, Instagram, Snapchat, LinkedIn, Reddit each need their own developer app and
token that you set up yourself). Tokens live only in that engine, never in the portal, the Lens or
this package. The engine is an object with `schedule(post)`, `cancel(post)` and an optional
`poll(posts)`; the contract is documented at the top of `WebCapturePortal/src/scheduler.js`.

## Building on it

The framework is meant to be extended:

- **Capture more:** call `WebCapture.mark(label)` for markers, add `WebCaptureTarget` objects, or
  read `WebCapture.recording` for the data. New layers follow the same pattern as the camera layer:
  poll packets while recording, put them under `recording.background` with a clock offset, and read
  them in the portal's `video.js`.
- **Show more:** the portal is plain ES modules with no build step (`src/viewer.js` renders,
  `src/model.js` holds the edit model, `src/scheduler.js` the queue). `npm test` runs the model,
  crop, scheduler and UIKit-fidelity tests.
- **Publish elsewhere:** write a scheduler engine (above).
- **Keep it faithful:** UI recorded from UIKit is checked against the real UIKit design values
  (`tools/extract_uikit_tokens.mjs`, `tests/uikit.test.mjs`).

## Where to go next

[playbook](playbook.md) · [setup](setup.md) · [components](components.md) · [portal](portal.md) · [protocol](protocol.md) ·
[cheat sheet](cheat-sheet.md) · [troubleshooting](troubleshooting.md) · [API status](api-status.md)
