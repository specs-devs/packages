# NDK Capture Studio

The browser side of NDK Capture: a static web app (no build step) that the NDK Capture Lens Studio
plugin serves at `http://127.0.0.1:47792`. Live view: composite the Lens's layers and edit each one
while it streams. Edit view: open a recording, trim, cut, override layers, add markers and a title,
save `edits.json`, export WebM.

- Runs from the plugin, or offline: `npm run serve` and open
  `http://127.0.0.1:47792/?recording=samples/demo/`, or use **Open folder…** on a recording folder.
- `src/model.js` — recordings, settings over time, edits (pure, Node-testable)
- `src/compositor.js` — canvas compositing (z order, opacity, blend, transform)
- `src/app.js` — the UI
- `tools/nkc-extract.mjs` — extract native H.265 / AAC tracks from a recording folder or device
  `.nkc` file for ffmpeg
- `tools/make-sample.py` — regenerate `samples/demo/` (needs Pillow)

Tests: `npm test` (model) and `npm i --no-save playwright-core && npm run e2e` (headless Chrome
against the sample). Format reference: `NDKCapture.lspkg/Docs/format.md`.
