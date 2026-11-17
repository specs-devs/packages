# RemoteServiceGateway API status

[← Agent usage index](../README.md)

## Use when

Check this file before you copy an older snippet (including the long README
that shipped before this revision) or a name from an external listing. It is
the compatibility index for the revision that contains it (`package.native`).
Every row was checked against the TypeScript in this folder.

## Status meanings

- **Current**: recommended public surface for new work.
- **Deprecated**: still present. Migrate to the named replacement.
- **Experimental**: public, but compatibility is not guaranteed.
- **Removed**: not available in this revision.
- **Internal**: present in the source but not meant to be imported.

## Current API

| Module (`RemoteServiceGateway.lspkg/...`) | Export | Kind |
|---|---|---|
| `RemoteServiceGatewayCredentials` | `AvaliableApiTypes` (`Snap`, `OpenAI`, `Google`) | string enum |
| `RemoteServiceGatewayCredentials` | `RemoteServiceGatewayCredentials` (`openAIToken`, `googleToken`, `snapToken`; static `setApiToken`, `getApiToken`) | `@component` + statics |
| `HostedExternal/OpenAI` | `OpenAI.chatCompletions`, `imagesGenerate`, `imagesEdit`, `speech`, `createRealtimeSession` | static methods |
| `HostedExternal/OpenAI` | `OpenAIRealtimeWebsocket` (`onOpen`, `onMessage`, `onError`, `onClose`, `send`, `overrideSend`, `isConnected`, `close`) | class |
| `HostedExternal/OpenAITypes` | `OpenAITypes.Common`, `ChatCompletions`, `ImageGenerate`, `ImageEdits`, `Speech`, `Realtime` | types |
| `HostedExternal/Gemini` | `Gemini.models`, `Gemini.liveConnect` | static methods |
| `HostedExternal/Gemini` | `GeminiLiveWebsocket` (same members as the OpenAI socket) | class |
| `HostedExternal/GoogleGenAI` | `GoogleGenAI.Gemini`, `.Lyria`, `.Imagen`; re-export `Gemini`; type re-export `GoogleGenAITypes` | facade |
| `HostedExternal/GoogleGenAITypes` | `GoogleGenAITypes.Common`, `.Gemini.Models`, `.Gemini.Live`, `.Lyria`, `.Imagen` | types |
| `HostedExternal/Imagen` | `Imagen.generateContent`, `Imagen.generateImage` (deprecated) | static method |
| `HostedExternal/Lyria` | `Lyria.performLyriaRequest` | static method |
| `HostedSnap/Snap3D` | `Snap3D.submit`, `getStatus`, `submitAndGetStatus`, `submitImageTo3D` | static methods |
| `HostedSnap/Snap3DTypes` | `Snap3DTypes` (`SubmitRequestBody`, `GetStatusResponseBody`, `SubmitGetStatusResults`, `TextureAssetData`, `GltfAssetData`, `ErrorData`, ...) | types |
| `Helpers/MicrophoneRecorder` | `MicrophoneRecorder` (`onAudioFrame`, `setSampleRate`, `startRecording`, `stopRecording`) | `@component` |
| `Helpers/DynamicAudioOutput` | `DynamicAudioOutput` (`initialize`, `addAudioFrame`, `interruptAudioOutput`) | `@component` |
| `Helpers/AudioProcessor` | `AudioProcessor` (`processFrame`, `onAudioChunkReady`) | class |
| `Helpers/VideoController` | `VideoController` (`startRecording`, `stopRecording`, `onEncodedFrame`) | class |
| `Utils/Event` | `Event` (default), `callback`, `unsubscribe`, `PublicApi` | class + types |
| `Utils/Promisfy` | `promisify`, `promisifyWithReject`, `Promisfy.RemoteServiceModule`, `.InternetModule`, `.RemoteMediaModule` | functions |
| `Resources/Visuals/LoadingSpinner/LoadingSpinner/LoadingSpinner` | `LoadingSpinner` (`renderOrder`) | `@component` |
| `HostedSnap/Examples/*`, `HostedExternal/Examples/*` | `ExampleSnap3D`, `ExampleSnap3DImageTo3D`, `ExampleImageTo3D`, `ExampleOAICalls`, `ExampleGeminiCalls`, `ExampleImagenCalls`, `ExampleLyriaCall`, `ExampleOAIRealtime`, `ExampleGeminiLive` | demo `@component`s |
| `Example/DemoLog/DemoLog` | `DemoStep`, `DemoRun`, `DemoLogPanel`, `DemoParticipant`, `DemoCancelled`, `isTokenMissing`, `errorText` | demo scaffolding (new in this revision) |
| `RemoteServiceGateway__PLACE_IN_SCENE.prefab` | example prefab | prefab |

Signatures, inputs and defaults: [components](components.md).

## Behavior changes in this revision

| Area | Now | Before |
|---|---|---|
| `RemoteServiceGatewayCredentials.setApiToken` | Stores `Snap`, `OpenAI` and `Google` | Stored only `Snap`. OpenAI and Google tokens were silently ignored |
| Demo examples (`ExampleOAICalls`, `ExampleOAIRealtime`, `ExampleGeminiCalls`, `ExampleImagenCalls`, `ExampleGeminiLive`, `ExampleLyriaCall`, `ExampleSnap3D`, `ExampleSnap3DImageTo3D`) | Start by themselves when their carousel step is shown and stop when it is left (`Example/DemoLog`, [examples](examples.md#auto-run-demo)). The calls of a step run one after the other, each awaited. A run token ignores late responses from a step that was left. No tap or pinch trigger | Ran on tap / right-hand pinch, all enabled calls at once; disabled examples ignored pinches through an `isEnabledInHierarchy` guard |
| Demo log panel | Each step shows a live log above its content: request sent, "ok in N s" with a summary, or the error text, plus missing-token lines. Also printed as `[RSG demo +N s]` | Errors only in the text output or in `print` (Imagen: only `logger.debug`) |
| `...OnTap` / `runOnTap` inputs | Same names, labelled "Run in demo": they pick the calls the demo runs. Prefab: every OpenAI call on (function calling and image edit added), Gemini function calling on | Picked the calls run on tap |
| Example call methods (`doChatCompletions`, `doImageGeneration`, `doImageEdit`, `doSpeechGeneration`, `doFunctionCalling`, `textToTextExample`, `generateImageExample`, `functionCallingExample`, `connectToWebsocket`, `createGeminiLiveSession`) | Return a Promise and take an optional `DemoRun`. New: `runDemo(run?)` and `stopDemo()` on each demo example, `logPanelOffset` input, `greeting` input on the realtime examples | Returned `void` |
| `ExampleOAIRealtime`, `ExampleGeminiLive` | Open their session when their step is shown, send a greeting so the model speaks first, and close the socket, the mic (and camera) and the audio output when the step is left. The prefab turns audio output on for both | Opened once on `OnStartEvent` and stayed open after the step was left; mic frame handlers were added again on every connect |
| `ExampleLyriaCall` | Its own carousel step (`Lyria`). Parses the WAV and plays only the PCM data at the file's rate and channel count; leaving the step stops the music | Shared the Gemini step; fed the whole WAV, header included, as 48 kHz stereo |
| `ExampleSnap3DImageTo3D` | The source image fetch accepts the HTTP status (2xx) | Compared the InternetModule status with `1` and never showed the image |
| Carousel steps | 7 steps: OpenAI, OpenAI Realtime, Gemini and Imagen, Gemini Live, Lyria, Snap3D, Image to 3D. The `Gemini, Imagen and Lyria` object is now `Gemini and Imagen` | 6 steps, Snap3D first |
| `ExampleLyriaCall` (earlier in this revision) | The in-progress flag is reset on success | Only one generation per session |

## Deprecated

| Surface | Replacement |
|---|---|
| `HostedExternal/GeminiTypes` (`export type { GeminiTypes }`, header marked `@deprecated`) | Import from `HostedExternal/GoogleGenAITypes` |
| `GeminiTypes` namespace in `GoogleGenAITypes.ts` ("Backwards compatibility", aliases of `GoogleGenAITypes.Common`, `.Gemini.Models`, `.Gemini.Live`; also `Models.GeminiGenerateContentRequestBody`) | `GoogleGenAITypes.*`. The bundled examples still use `GeminiTypes`, and it works |
| `Imagen.generateImage` (Imagen predict models `imagen-3.0` / `imagen-4.0`, no longer served by the gateway) | `Imagen.generateContent` with `gemini-3.1-flash-image` or `gemini-3.1-flash-lite-image` |
| `Gemini` re-export from `HostedExternal/GoogleGenAI` (commented "Backwards compatibility") | Either import works. `GeminiLiveWebsocket` is only exported by `HostedExternal/Gemini` |

## Experimental

None is marked experimental in the source. The model names in the examples
(`gpt-5.6-luna`, `gpt-image-2`, `gpt-4o-mini-tts`, `gpt-realtime-mini`,
`gemini-2.5-flash`, `gemini-3.1-flash-image`,
`models/gemini-live-2.5-flash`,
`lyria-002`) are whatever the gateway served when the examples
were written. The package cannot tell you whether they are still served.

## Removed in this revision

| Surface | Why | Replacement |
|---|---|---|
| `Scripts/GuideDismissPanel/GuideDismissPanel.ts` (class `GuideDismissPanel`) | Its class name collided with the samples' own `GuideDismissPanel`, so asset lookups by name could bind the package copy | The demo guide now ships as scaffolding in `Example/GuideDismissPanel/GuideDismissPanel.ts`, used only by the example prefab. Pick script assets by id or source path |
| `HostedSnap/Deepseek` (`DeepSeek.chatCompletions`), `HostedSnap/DeepSeekTypes`, `ExampleDeepseekCalls` and its carousel step, `RemoteServiceModules/Deepseek_Completions` | The Snap-hosted DeepSeek model is no longer served (the experimental API was retired; requests answer 404) | None. Use OpenAI or Gemini for chat. The `Snap` token stays: Snap3D uses it |
| Orphan `GuideDismissPanel` component on the example prefab | Pointed at the removed script | None |

### Names that never existed (from the old README)

| Old name | Real API |
|---|---|
| `Deepseek` (class) | None. DeepSeek was removed in this release (see "Removed in this revision") |
| `Snap3D.generate(...)` | `Snap3D.submitAndGetStatus`, `submit`, `getStatus`, `submitImageTo3D` |
| `OpenAI.realtimeConnect()` | `OpenAI.createRealtimeSession({ model })` |
| `OpenAITypes.Speech.Response` | `OpenAI.speech` resolves with an `AudioTrackAsset` |
| `MicrophoneRecorder.startRecording(callback)` | `startRecording()` + `onAudioFrame.add(...)` |
| `DynamicAudioOutput.playAudioData(...)` | `initialize(sampleRate)` + `addAudioFrame(Uint8Array, channels?)` |
| `RemoteMediaModule.loadResourceFromURL`, `resource.asTexture()`, `texture.control.inputTexture` | `InternetModule.performHttpRequest` → `asResource()` → `RemoteMediaModule.loadResourceAsImageTexture`. Set `Image.mainPass.baseTex` |
| `import { RemoteMediaModule } from "LensStudio:RemoteMediaModule"` | `require("LensStudio:RemoteMediaModule") as RemoteMediaModule` |
| `./RemoteServiceGateway.lspkg/...` imports | `RemoteServiceGateway.lspkg/...` |
| Gemini Live `clientContent` / `turnComplete` / `generationConfig` in client messages | `client_content` / `turn_complete` / `generation_config` |

## Internal (not exported or not for import)

- `WebSocketReadyState` enums in `OpenAI.ts` and `Gemini.ts`.
- `buildMultipartFormData` in `OpenAI.ts`.
- `Snap3D` private statics: `generateScript`, `setTimeout`, `promiseSetTimeout`, `repeatGetStatus`.
- The `private static` token fields of `RemoteServiceGatewayCredentials`.

## Known gaps

- **`refine: false` in `submitAndGetStatus`.** Polling now ends on a `completed`
  status or any failure. Live-tested 2026-10-23: the gateway still
  returns a `refined_mesh` with `refine: false`.
- **Snap3D poll interval.** `REPEAT_SUBMIT_TIME = 0.25` is commented "seconds",
  but `promiseSetTimeout` divides by 1000 again (0.00025 s). In practice each
  next poll starts right after the previous request returns.
- **`imagesEdit` with `Uint8Array[]`** is accepted by the type but not encoded
  into the multipart body.
- **Lyria playback** in `ExampleLyriaCall` now strips the WAV header
  (`readWav`). Verified on Specs (2026-11-10): a ~33 s clip plays.
- **Snap3D artifacts on Specs.** An artifact URL can be listed a moment before its file loads on
  the device; an immediate load then fails (`resource is empty` / `media download failed`).
  `Snap3D` now retries each artifact load up to 6 times, 1.5 s apart (performHttpRequest
  first, `makeResourceFromUrl` fallback). Verified on Specs 2026-11-10: preview, base and
  refined GLB load and import.
- **OpenAI speech on Specs.** The `audio_speech` response arrives on the device with an empty
  resource in every format (mp3 / wav / pcm, no `uriResources`), so `OpenAI.speech` can't be loaded
  there. `ExampleOAICalls` falls back to a chat completion with audio output (`gpt-audio-mini`,
  PCM16 24 kHz base64 in the JSON) played through `DynamicAudioOutput`. Verified on Specs
  2026-11-10. `DynamicAudioOutput.initialize` / `addAudioFrame` now set themselves up if `onAwake`
  has not run yet.
- **Snap3D preview image** is optional: if it can't be loaded, `Snap3D` logs it and continues to
  the meshes instead of failing the task.
- **Device-verified calls (2026-11-10, same build):** OpenAI chat, tool call, `gpt-image-2`
  generate, realtime voice; Gemini text, tool call, `Imagen.generateContent` with
  `gemini-3.1-flash-image`, Gemini Live; Lyria; Snap3D text and image to 3D; image edit; speech via `gpt-audio-mini`.
- **Audio left in the output queue.** `DynamicAudioOutput.interruptAudioOutput()`
  stops the `AudioComponent`, but frames already enqueued may still play the next
  time the shared output starts (for example a realtime step after Lyria). Not
  verified on device.
- **Requests can't be aborted.** Leaving a step ignores its late responses, but a
  request already sent (an image, a Snap3D task, a Lyria clip) still completes on
  the server and counts against the quota. Coming back to a step starts it again.
- **Imagen / Lyria token checks** wrap `getApiToken` in `try/catch`, but it
  never throws. A missing token is sent as `""` and fails server-side.
- **`Remote Media Module.remoteMediaModule`** ships in `HostedSnap/RemoteServiceModules/`,
  but no script loads it.
- **Companion packages.** `package_dependencies.json` declares `Utilities`,
  `SnapDecorators`, `InteractionKit`, `UIKit`, `Motion` and
  `Icons`. The API, helper and example scripts import `Utilities` (`Logger`) and
  `SnapDecorators` (12 files import the decorators, none applies them). The
  `Example/` demo scaffolding (`CredentialsWarning`, `ExampleCarousel`,
  `GuideDismissPanel`, `DemoLog`) imports `InteractionKit` and `UIKit`.
  `Motion` and `Icons` are not imported.
- **Token issuance, quotas and model availability** are not described by the
  source. Use the setup page linked from the credentials component.
