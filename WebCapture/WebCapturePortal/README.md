# Web Capture portal

Static web app (no build step) for the Web Capture package, the local front end of a flexible capture
framework for Specs Lenses: **Recordings** lists what the Lens saved (Lens Studio and Snap Cloud),
**Edit** replays a recording from the wearer's point of view and exports video, **Schedule** plans
the post per platform.

- In Lens Studio, the WebCapture plugin serves this folder at `http://127.0.0.1:47790` when it is
  unzipped at the project root (`<project>/WebCapturePortal/`).
- Anywhere else: `python3 -m http.server 8080` (or `npm run serve`) inside this folder, then open it in
  Chrome, Edge, Firefox or Safari. It still reaches the plugin at the address in **Settings**, opens
  dropped files and reads Snap Cloud.
- `vendor/three/` is three.js r180 (MIT). `vendor/mediapipe/` (only in the package zip) is the MediaPipe
  hand model used by *Hands in front*; without it the model is fetched from a public CDN the first
  time. `samples/demo.webcapture.json` is a real 10 s recording.
- `assets/specs-logo*.svg|png` is the official SPECS wordmark.
- Tests: `npm test` (edit model, crop, scheduler, UIKit fidelity). `node tools/extract_uikit_tokens.mjs`
  (from the package folder) refreshes `src/uikit-tokens.json` from the installed UIKit.
- Scheduling: the built-in engine only queues (no credentials). To publish, pass an engine with
  `schedule`, `cancel` and optional `poll` to `mountScheduler`; it holds your own API tokens. Contract:
  top of `src/scheduler.js`.

See the package docs (`WebCapture.lspkg/Docs/guide.md` and `portal.md`).
