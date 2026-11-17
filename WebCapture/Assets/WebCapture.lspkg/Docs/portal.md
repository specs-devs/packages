# Web Capture portal (Step 3)

[← Agent usage index](../README.md)

## Use when

Read when using the portal: finding recordings, editing one, exporting a video and scheduling a post.
The portal is `WebCapturePortal/` at the project root, served by the plugin at
`http://127.0.0.1:47790` (or any static server). It has three tabs: **Recordings**, **Edit** and
**Schedule**, plus **Settings** (Snap Cloud project URL and public key, plugin address).

Capturing is started and stopped only inside the Lens (the `CapturePanel` button). The portal never
starts a recording.

## Recordings

One list, newest first, of the recordings in `WebCaptureRecordings/` (Lens Studio) and in your Snap Cloud
project. **Open** loads one into Edit; **Delete** removes a local file. **Open file…** or dropping a
`.webcapture.json` opens a file; **Open sample** opens a bundled demo. A `config.json` next to
`index.html` (`{"cloudUrl", "cloudKey", "code"}`) pre-fills Settings so nothing is typed.

## Edit

The preview plays in recording time and jumps over cuts; the export removes them.

When a recording with camera video opens, a **loader** blocks playback while the portal (in your browser,
nothing is uploaded) **locks the camera to the scene** (it measures the clock offset and removes the drag
between the video and the head pose) and **finds your hands**. Playing earlier would look scattered.

The right panel is made of **collapsible sections** (Presets, Display, Colour & grade, Lighting, Hands, Camera alignment, Logo, Shadows,
AI background, Titles, Music, Export) with *Expand all* / *Collapse all*; what you open is remembered. The **Light /
Dark** button in the top bar switches the theme; the interface follows the Specs design system.

| Area | What you can do |
|---|---|
| Presets | Ten one-click looks at the top of the panel, in two clean, slightly cool families: *Glasses* (additive and see-through like the display: Light, Crisp, Dim, Glow) and *Solid UI* (plates that hide the room behind them: Soft, Crisp, Bright, Flat). Each sets the composite (mode, opacity, solidity, camera tint) and the grade (cold-warm, exposure, contrast, saturation, glow, vignette, object shadow, pop plate) from a clean base, and leaves hands, crop, logo and alignment alone. Tune any slider afterwards; add your own in `PRESETS` (`src/model.js`) |
| Camera | *Lens point of view* (the recorded camera), *Free camera*, or *Camera shots* (`+ Shot`, eased) |
| Timeline / transport | Seek, play (Space), speed 0.25–4×, **Set in/out** (I/O), **Cut** (C), **Reset trim & cuts**; ←/→ step a frame |
| Objects / Selected | Show/hide, offset, rotation, scale, colour, label, gizmo in Free camera |
| Look | Studio, Daylight, Blueprint, Midnight, Paper; background colour |
| Composite | *Glasses display (additive, default)* dims the camera (**Camera tint**) and adds the virtual light with a soft shadow, like the real display (it stays see-through); *Solid* paints the virtual layer over the picture. **Virtual opacity** runs from 0 (transparent) to 100 and fades the whole virtual layer, panel and text included. **Solidity** (additive mode, default 35%) keeps the additive look but dims the real world behind the virtual objects: 0 = fully see-through, 100 = nothing shows through. *Scene style* and *Background colour* appear only for recordings without a camera picture |
| Colour & grade | **Cold ↔ Warm** tints the camera picture only (the virtual layer keeps its colours); exposure, contrast, saturation, glow and vignette grade the frame |
| Lighting | **Directional light** on the 3D objects: intensity, softness (fill light), rotation around the scene, height above the horizon, colour. UIKit panels and text are unlit, as in the Lens. With the shadow plane on, the light also sets the shadow's direction and softness |
| Hands | **Hands in front of virtual objects** draws your real hands over the virtual layer (an on-device hand model); **Show hand outline** draws the detected mask in green to check detection. The cut-out is only visible where a hand overlaps virtual content |
| Sync / Lock | **Camera sync** and **Auto-sync** set the video's clock offset; **Lock to environment** and its strength control the drift correction; *Camera zoom and pan* nudges the video's projection |
| Logo | The official SPECS wordmark, light or black, nine placements, size |
| Titles / Music | Text at the playhead; an audio file mixed into the export |
| Export | **Output format** and **Crop** below, 30 or 60 fps, MP4 (H.264) or WebM |
| Save | **Save edits** writes the `edits` block back (file or Snap Cloud); **Download JSON** always downloads |

### Output formats and crop

Original 1464×1098 (the Specs capture), Match the Lens camera, 1080×1920 vertical, 1920×1080 and
1280×720 horizontal, 3:4 (1080×1440), 4:5 (1080×1350), 9:16 (1080×1920) and 1:1 (1080×1080). *Fill*
crops the picture to the format (**Zoom** and **Pan** move the window); *Fit* shows the whole frame on
blurred bars. The camera video, the 3D layer and the hand cut-out share one crop window, so virtual
objects stay on the real world in every format.

## Schedule

Plan a post for a recording. The tab has three columns: **compose** (recording, time, platforms,
captions), a **phone preview** and the **queue**.

- Tick platforms: TikTok, X, YouTube Shorts, Instagram Reels, Snapchat Spotlight, LinkedIn, Reddit. Each
  shows its format (9:16, 1:1, 4:5), length limit and caption limit; problems (empty or too long
  caption, clip longer than the platform allows, missing YouTube title, time in the past) block
  *Approve & schedule*; softer notes (longer than the sweet spot) don't.
- The **phone preview** renders a frame of the recording in the platform's format inside a phone, in that
  platform's layout (full-screen vertical feed, or a post card). **Edit the caption in the phone**; the
  composer field and the counter follow. **SPECS style** drops hashtags and writes the brand as SPECS.
- The **queue** has Needs review, Scheduled and Posted sections. Each post offers *Edit & export 9:16*
  style buttons (opens the recording in Edit at the right format), *I posted it* (records the link),
  Cancel, Retry failed and Remove. Export and import the queue as JSON.
- **No credentials are needed to plan.** The built-in engine only queues; a post shows *Due now* at its
  time and you post the exported video yourself. To publish automatically, pass your own engine
  (`schedule`, `cancel`, optional `poll`) to `mountScheduler`; it holds *your own* social API tokens. See
  the contract at the top of `WebCapturePortal/src/scheduler.js`. The queue is kept in the browser.

## Browser support

The portal runs in the browser, so it is the same on macOS and Windows. Two things depend on the browser, not the
operating system: the camera video is H.265 and needs a browser that can decode it through WebCodecs (recent Chrome or
Edge on a machine with hardware H.265 decoding, or Safari; the portal says so when it can't), and the hand model runs
on the CPU as WebAssembly, which every current browser supports.

Recent Chrome and Edge export MP4; Firefox and Safari export WebM (Safari 17+ also MP4). Export runs in
real time: keep the tab visible until the progress bar finishes. The hand model is bundled in the portal
zip (`vendor/mediapipe`); in a clone without it, the portal downloads the model from a public CDN the
first time hands are needed (no frames are sent anywhere).

## Tests

`cd WebCapturePortal && npm test` runs the edit model, crop, scheduler and UIKit-fidelity tests. To
refresh the UIKit design values: `node tools/extract_uikit_tokens.mjs` (needs the installed UIKit).
