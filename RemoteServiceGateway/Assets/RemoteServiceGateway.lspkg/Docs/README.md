# Remote Service Gateway

## What it is
A package that connects Specs Lenses to AI services through Snap's Remote Service Gateway: OpenAI, Gemini,
Imagen and Lyria (hosted externally), and DeepSeek and Snap3D (hosted by Snap). It ships typed request wrappers,
realtime WebSocket sessions, microphone, audio and video helpers, and a demo prefab with one example per
provider. It is for developers adding chat, image, speech, music, realtime voice or text-to-3D generation to a Lens.

## What it does
- `RemoteServiceGatewayCredentials` holds your Snap, OpenAI and Google tokens; every service module reads the
  matching token per request (or when a realtime socket is created). Tokens can also be set at runtime with
  `setApiToken`.
- Service modules are static classes returning Promises: `OpenAI` (chat, image generation and edits, speech),
  `Gemini` (text and multimodal generation; `GoogleGenAI` groups Gemini, Imagen and Lyria), `Imagen` (images), `Lyria` (music), `DeepSeek` (chat) and `Snap3D` (text to
  3D, submit and status).
- `OpenAIRealtimeWebsocket` and `GeminiLiveWebsocket` run live voice sessions, fed by `MicrophoneRecorder` and
  `AudioProcessor` and played back through `DynamicAudioOutput`; `VideoController` streams encoded camera frames.
- `RemoteServiceGateway__PLACE_IN_SCENE.prefab` shows a credentials warning (until real tokens are set), a guide
  and an example carousel through the Snap-hosted and externally hosted examples. Each example runs when you turn
  on its `...OnTap` / `runOnTap` flag and tap in the Preview or pinch with the right hand on Specs.

## Highlights
- One credentials component for three token types, with a clear "Credentials needed" panel in the demo.
- Typed wire types for every provider (`OpenAITypes`, `GoogleGenAITypes`, `DeepSeekTypes`, `Snap3DTypes`).
- Realtime voice over WebSocket for both OpenAI and Gemini Live, with PCM16 audio helpers.
- Snap3D returns a preview image, a base mesh and a refined mesh, shown side by side in the demo.
- A `LoadingSpinner` component and small `Event` / `Promisfy` utilities.

## Core scripts
| Script | What it does |
|---|---|
| `RemoteServiceGatewayCredentials.ts` | Stores the Snap, OpenAI and Google tokens (`setApiToken`, `getApiToken`). |
| `HostedExternal/OpenAI.ts` | `OpenAI` requests and the `OpenAIRealtimeWebsocket` session. |
| `HostedExternal/Gemini.ts` | `Gemini` requests and the `GeminiLiveWebsocket` session. |
| `HostedExternal/Imagen.ts` | Imagen image generation. |
| `HostedExternal/Lyria.ts` | Lyria music generation. |
| `HostedSnap/Deepseek.ts` | `DeepSeek` chat completions (Snap-hosted). |
| `HostedSnap/Snap3D.ts` | Snap3D text-to-3D submit and status polling. |
| `Helpers/MicrophoneRecorder.ts` | Records microphone frames for realtime sessions. |
| `Helpers/DynamicAudioOutput.ts` | Plays streamed PCM16 audio through an `AudioComponent`. |
| `HostedExternal/Examples/ExampleOAICalls.ts` | Example OpenAI chat, image and speech calls. |

## Extra info
- **Requires:** Utilities, SnapDecorators, InteractionKit, UIKit, Motion, Icons. You need valid gateway tokens
  (setup link in the `RemoteServiceGatewayCredentials` Inspector); never commit real tokens. To make calls from
  the Lens Studio Preview you must be logged in to My Lenses. Realtime examples need the microphone. Keep the
  package folder layout intact: each module loads its `.remoteServiceModule` assets by relative path.
- **Get started:** drag `RemoteServiceGateway__PLACE_IN_SCENE.prefab` into an empty Specs scene, put your tokens
  on its `RemoteServiceGatewayCredentials` object, then enable one example flag at a time.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md): import, credentials and lifecycle rules; read first.
  - [setup.md](setup.md): tokens, service module assets and Preview prerequisites.
  - [components.md](components.md): modules, public members, inputs and the demo scaffolding.
  - [examples.md](examples.md): the example prefab and recipes for every provider.
  - [troubleshooting.md](troubleshooting.md): symptoms and fixes found in QA.
  - [api-status.md](api-status.md): compatibility, deprecated names and known limitations.
