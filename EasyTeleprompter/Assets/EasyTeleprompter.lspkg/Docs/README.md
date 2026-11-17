# Easy Teleprompter

## What it is
A teleprompter package for Specs, for rehearsal and public speaking. It ships a local slide deck with speaker notes
and shows several ways to move between slides: on-screen buttons, wrist soft-press pads, voice commands and a
companion phone. Google Slides and a WebSocket relay are optional integration examples with documented
limitations. It is for anyone presenting with Specs, or building a Lens that pages through content hands-free.

## What it does
1. Drop `EasyTeleprompter__PLACE_IN_SCENE.prefab` in a Specs scene. A guide panel opens first; after
   "Ok, I understood" the controllers and the local `[StaticPresentationExample]` appear in a draggable UI Kit frame.
2. `PresentationSwitcher` takes the direct children of its slide parent (16 sample slides, each an image plus
   notes text), enables only the first, and wraps `next()` / `previous()` in both directions.
3. Every controller calls the same switcher:
   - round `Previous` / `Next` UI Kit buttons;
   - `SoftPressController`: press a pad with the wrist of the left or right hand (a `HandRef` collider on the wrist);
   - `SpeechToText` (`VoiceController.ts`): the mic button toggles ASR; final phrases "next", "previous" or
     "go back" navigate after a short confirmation delay;
   - `MobileController`: a touch on the left half of the paired phone goes back, the right half goes forward.
4. Optionally, `GoogleSlideBridge` loads a Google Slides presentation's thumbnails and speaker notes instead, and
   `WebSocketController` sends and records next / previous commands over a relay. Both ship disabled.

## Highlights
- One `useGoogleSlide` flag per controller picks the local switcher or the Google bridge.
- Voice uses the Lens Studio ASR module, not VoiceML, and a pending command is cancelled if the transcription changes.
- Soft press measures press depth across eight vertices and fires once per press at `pressThreshold`.
- `SmoothRepositioning` (file `SmoothRespositioning.ts`) brings content back in front of the user when they turn away
  or walk off.
- `Prefabs/Slide.prefab` is a building block for adding your own slides.

## Core scripts
| Script | What it does |
|---|---|
| `Scripts/PresentationSwitcher.ts` | Local slide deck: collects child slides and wraps next / previous. |
| `Scripts/VoiceController.ts` | `SpeechToText`: ASR voice commands and the mic toggle button. |
| `Scripts/SoftPressController.ts` | Wrist soft-press pad that triggers next or previous. |
| `Scripts/MobileController.ts` | Companion-phone touch navigation through Interaction Kit (SIK) mobile input. |
| `Scripts/GoogleSlideBridge.ts` | Optional Google Slides loader: thumbnails, notes, bounded navigation, polling. |
| `Scripts/WebSocketController.ts` | Optional WebSocket relay client that sends and stores next / previous receipts. |
| `Scripts/SmoothRespositioning.ts` | `SmoothRepositioning`: keeps the content in front of the user. |
| `Scripts/CameraService.ts` | Singleton that resolves the main camera. |
| `Scripts/SimpleAsrTest.ts` | Diagnostic component that starts ASR and prints transcription. |

## Extra info
- **Requires:** InteractionKit, UIKit, Utilities, SnapDecorators, Motion and Icons. Voice, wrist soft press and
  phone input need Specs. Google Slides needs a presentation ID and access token. A received WebSocket command is
  stored, not acted on: add your own consumer. Host any relay on Snap-approved infrastructure only.
- **Get started:** `EasyTeleprompter__PLACE_IN_SCENE.prefab`, starting from `[StaticPresentationExample]`; test
  local Next / Previous before enabling voice, soft press, phone or network input.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - slide collection and controller selection; read first
  - [components.md](components.md) - prefabs, assets and every script's inputs and methods
  - [api-status.md](api-status.md) - local versus remote behavior and known source limits
  - [examples.md](examples.md) - typed local navigation and consuming WebSocket receipts
  - [setup.md](setup.md) - Google credentials and the bundled relay / web client
  - [troubleshooting.md](troubleshooting.md) - missed commands, stale slides, input conflicts
  - [guide.md](guide.md) - the original illustrated tutorial
