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
| `HostedSnap/Deepseek` | `DeepSeek.chatCompletions` | static method |
| `HostedSnap/DeepSeekTypes` | `DeepSeekTypes.ChatCompletions` | types |
| `HostedSnap/Snap3D` | `Snap3D.submit`, `getStatus`, `submitAndGetStatus`, `submitImageTo3D` | static methods |
| `HostedSnap/Snap3DTypes` | `Snap3DTypes` (`SubmitRequestBody`, `GetStatusResponseBody`, `SubmitGetStatusResults`, `TextureAssetData`, `GltfAssetData`, `ErrorData`, ...) | types |
| `Helpers/MicrophoneRecorder` | `MicrophoneRecorder` (`onAudioFrame`, `setSampleRate`, `startRecording`, `stopRecording`) | `@component` |
| `Helpers/DynamicAudioOutput` | `DynamicAudioOutput` (`initialize`, `addAudioFrame`, `interruptAudioOutput`) | `@component` |
| `Helpers/AudioProcessor` | `AudioProcessor` (`processFrame`, `onAudioChunkReady`) | class |
| `Helpers/VideoController` | `VideoController` (`startRecording`, `stopRecording`, `onEncodedFrame`) | class |
| `Utils/Event` | `Event` (default), `callback`, `unsubscribe`, `PublicApi` | class + types |
| `Utils/Promisfy` | `promisify`, `promisifyWithReject`, `Promisfy.RemoteServiceModule`, `.InternetModule`, `.RemoteMediaModule` | functions |
| `Resources/Visuals/LoadingSpinner/LoadingSpinner/LoadingSpinner` | `LoadingSpinner` (`renderOrder`) | `@component` |
| `HostedSnap/Examples/*`, `HostedExternal/Examples/*` | `ExampleDeepseekCalls`, `ExampleSnap3D`, `ExampleSnap3DImageTo3D`, `ExampleImageTo3D`, `ExampleOAICalls`, `ExampleGeminiCalls`, `ExampleImagenCalls`, `ExampleLyriaCall`, `ExampleOAIRealtime`, `ExampleGeminiLive` | demo `@component`s |
| `RemoteServiceGateway__PLACE_IN_SCENE.prefab` | example prefab | prefab |

Signatures, inputs and defaults: [components](components.md).

## Behavior changes in this revision

| Area | Now | Before |
|---|---|---|
| `RemoteServiceGatewayCredentials.setApiToken` | Stores `Snap`, `OpenAI` and `Google` | Stored only `Snap`. OpenAI and Google tokens were silently ignored |
| Call examples (`ExampleDeepseekCalls`, `ExampleSnap3D`, `ExampleSnap3DImageTo3D`, `ExampleImageTo3D`, `ExampleOAICalls`, `ExampleGeminiCalls`, `ExampleImagenCalls`, `ExampleLyriaCall`) | `onTap` returns early when `!this.sceneObject.isEnabledInHierarchy` | GestureModule pinches also reached disabled examples |
| `ExampleLyriaCall` | The in-progress flag is reset on success | Only one generation per session |
| `ExampleOAIRealtime`, `ExampleGeminiLive` | Open their session on `OnStartEvent`. Both are disabled in the prefab. The status text typo ("internete") is fixed | |

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
`lyria-002`, `DeepSeek-R1`) are whatever the gateway served when the examples
were written. The package cannot tell you whether they are still served.

## Removed in this revision

| Surface | Why | Replacement |
|---|---|---|
| `Scripts/GuideDismissPanel/GuideDismissPanel.ts` (class `GuideDismissPanel`) | Its class name collided with the samples' own `GuideDismissPanel`, so asset lookups by name could bind the package copy | The demo guide now ships as scaffolding in `Example/GuideDismissPanel/GuideDismissPanel.ts`, used only by the example prefab. Pick script assets by id or source path |
| Orphan `GuideDismissPanel` component on the example prefab | Pointed at the removed script | None |

### Names that never existed (from the old README)

| Old name | Real API |
|---|---|
| `Deepseek` (class) | `DeepSeek` in `HostedSnap/Deepseek.ts` |
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
- **Lyria playback** decodes the base64 WAV with `Base64.decode` and feeds the
  whole file, header included, to `addAudioFrame(..., 2)` as PCM16 stereo. The
  sound of the header bytes on device was not verified.
- **Imagen / Lyria token checks** wrap `getApiToken` in `try/catch`, but it
  never throws. A missing token is sent as `""` and fails server-side.
- **`Remote Media Module.remoteMediaModule`** ships in `HostedSnap/RemoteServiceModules/`,
  but no script loads it.
- **Companion packages.** `package_dependencies.json` declares `Utilities`,
  `SnapDecorators`, `SpectaclesInteractionKit`, `SpectaclesUIKit`, `Motion` and
  `Icons`. The API, helper and example scripts import `Utilities` (`Logger`) and
  `SnapDecorators` (12 files import the decorators, none applies them). The
  `Example/` demo scaffolding (`CredentialsWarning`, `ExampleCarousel`,
  `GuideDismissPanel`) imports `SpectaclesInteractionKit` and `SpectaclesUIKit`.
  `Motion` and `Icons` are not imported.
- **Token issuance, quotas and model availability** are not described by the
  source. Use the setup page linked from the credentials component.
