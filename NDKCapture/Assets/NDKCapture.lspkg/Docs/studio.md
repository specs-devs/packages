# NDK Capture — Studio

The Studio is a static web app (`NDKCaptureStudio/`) served by the plugin at
`http://127.0.0.1:47792`. It also opens recordings with no server: **Open folder…** (pick a
recording folder) or `index.html?recording=<url of a recording folder>/`.

## Live

- The canvas composites the latest frame of each visual layer in **Order** (z), with each layer's
  opacity, blend and transform. Frames arrive about 10× a second.
- The tabs pick a layer; its controls are sent to the Lens as `setLayer` and applied immediately:
  On, Opacity, Blend, Order, Scale, X, Y, Rotate, Proxy fps, and — on Specs — Encode fps, Bitrate
  and Key every. The Lens confirms with its settings, which refresh the controls.
- **Start stream / Stop stream / Record / Mark / Key frame** drive the Lens. While recording, every
  change and marker goes into the recording's timeline.
- The status line shows the live layers and the native encoders' frame and byte counts.

## Edit

- **Library** lists `NDKCaptureRecordings/`; pick one to open it.
- Scrub or **Play** the timeline; markers (recorded and added) are dots above it.
- **In / Out** trim, **Cut 1 s here** removes a second at the playhead, **Add marker**, **Title**.
- The tabs pick a layer; its controls override the recorded settings for the whole recording (the
  live changes still play underneath unless you override the same field).
- **Save edits** writes `edits.json` next to the recording (download when opened from a folder).
- **Export WebM** plays the edited timeline into a VP9 WebM at the canvas size (1280×960).
- **Full-quality native tracks**: the ffmpeg recipe for recordings with native packets. Extract them
  first with `node tools/nkc-extract.mjs <recording folder>`.
