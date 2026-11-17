# Guided Instructions

## What it is
A sample package for voice-driven, AI-assisted guided experiences on Specs. It combines speech recognition, a depth
snapshot of the camera image, a Gemini request through the Remote Service Gateway and world-space UI, so you can
prototype step-by-step AR guidance with labeled points of interest. The demo scenario uses a Nespresso Vertuo-style
coffee machine purely as a recognizable example object (no partnership or endorsement); replace that content with your
own product before publishing.

## What it does
1. The wearer taps the mic button in `SpeechUI` and asks a question; `ASRController` streams partial and final
   transcripts.
2. On the final transcript, `SceneController` takes a synchronized color/depth snapshot from `DepthCache` (it waits for
   the first depth frame) and shows the `Loading` visual.
3. `GeminiAPI` sends the camera image and the question (with the current guidance step prepended, when a
   `GuidancePanel` is wired) and asks for a structured answer: a message, 2D points with labels and arrows, and a
   detected step.
4. `ResponseUI` shows the answer in a bubble and places `WorldLabel` / `WorldArrow` prefabs at the returned pixels,
   projected into the world through the cached depth frame.
5. `GuidancePanel` walks through the maintenance steps from `NespressoKnowledge`, either manually (Previous / Next) or
   automatically from the detected step in AUTO mode.

## Highlights
- Speech → depth snapshot → image understanding → depth-projected world labels in one orchestrated flow.
- One request at a time: the speech collider is disabled while a request runs, and errors fall back to a default answer
  so loading recovers.
- `GuidancePanel` works on its own, with a zero-based `onStepChanged` event and MANUAL / AUTO modes.
- Optional `DebugVisualizer` draws the camera frame and the returned 2D points.
- `testTexture` can replace the camera image sent to Gemini for testing (depth still comes from `DepthCache`).
- A red `CredentialsWarning` panel appears before the guide until the Google token is set.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/SceneController.ts` | Orchestrator: speech, depth snapshot, Gemini request, response, labels and auto step. |
| `Scripts/GeminiAPI.ts` | Remote Service Gateway Gemini request with image input and structured JSON output. |
| `Scripts/DepthCache.ts` | Caches color/depth pairs and projects image pixels into world positions. |
| `Scripts/ASRController.ts` | Wraps the ASR module and emits partial / final transcripts. |
| `Scripts/SpeechUI.ts` | Mic button and transcript bubble that follows the camera. |
| `Scripts/ResponseUI.ts` | Response bubble plus creation and clearing of world labels and arrows. |
| `Scripts/GuidancePanel.ts` | Step-by-step guidance panel with MANUAL and AUTO modes. |
| `Scripts/NespressoKnowledge.ts` | Demo knowledge base with the maintenance steps; replace for your product. |
| `Scripts/WorldLabel.ts` | World-anchored label behaviour used by the label prefabs. |
| `Scripts/TouchDownButton.ts` | Pinch-down / pinch-up events on an Interactable. |

## Extra info
- **Requires:** InteractionKit, UIKit, RemoteServiceGateway, SnapDecorators, Utilities, Motion, Icons. Needs a Google
  (Gemini) token on the prefab's `RemoteServiceGatewayCredentials`; no Snap Cloud project is needed. ASR, depth and
  live camera need Specs; in the Lens Studio Preview, ASR also needs a My Lenses login, and depth and Gemini answers are
  not verified there. Keep the ThemeService preload imports at the top of the scripts.
- **Get started:** drag `GuidedInstructions__PLACE_IN_SCENE.prefab` into a Specs scene, set the Google token, and check
  its `testTexture` binding before live inference. Delete `CredentialsWarning`, `Guide` and `ExampleCarousel` for your
  own Lens.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) – readiness, request and depth-cache rules, read first
  - [setup.md](setup.md) – credentials, native modules and prefab wiring
  - [components.md](components.md) – every input, public event and signature
  - [api-status.md](api-status.md) – current APIs and verification gaps
  - [examples.md](examples.md) – manual guidance and pinch event consumers
  - [troubleshooting.md](troubleshooting.md) – stalled requests, missing labels, overlapping UI
  - [guide.md](guide.md) – retained quick start and customization notes
