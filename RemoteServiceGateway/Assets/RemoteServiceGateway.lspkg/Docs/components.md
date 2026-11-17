# RemoteServiceGateway components

[← Agent usage index](../README.md)

## Use when

Look up an exact import path, class, method, event, input or default before you
write code against the package. Everything here was read from the TypeScript in
this folder. Treat anything not listed as internal.

## Modules and import paths

Consumer import prefix: `RemoteServiceGateway.lspkg/`. The package has no
`Scripts/` folder for its API. Modules sit at the package root and in
`HostedExternal/`, `HostedSnap/`, `Helpers/` and `Utils/`. The relative form
`./RemoteServiceGateway.lspkg/...` only resolves from a script placed next to
the package folder.

| Import path | Exports |
|---|---|
| `RemoteServiceGateway.lspkg/RemoteServiceGatewayCredentials` | `enum AvaliableApiTypes`, `class RemoteServiceGatewayCredentials` (`@component`) |
| `RemoteServiceGateway.lspkg/HostedExternal/OpenAI` | `class OpenAI`, `class OpenAIRealtimeWebsocket` |
| `RemoteServiceGateway.lspkg/HostedExternal/OpenAITypes` | `namespace OpenAITypes` (types only) |
| `RemoteServiceGateway.lspkg/HostedExternal/Gemini` | `class Gemini`, `class GeminiLiveWebsocket` |
| `RemoteServiceGateway.lspkg/HostedExternal/GoogleGenAI` | `class GoogleGenAI`, re-export of `Gemini`, type re-export of `GoogleGenAITypes` |
| `RemoteServiceGateway.lspkg/HostedExternal/GoogleGenAITypes` | `namespace GoogleGenAITypes` (`Common`, `Gemini.Models`, `Gemini.Live`, `Lyria`, `Imagen`), legacy `namespace GeminiTypes` |
| `RemoteServiceGateway.lspkg/HostedExternal/GeminiTypes` | type re-export of `GeminiTypes` (deprecated) |
| `RemoteServiceGateway.lspkg/HostedExternal/Imagen` | `class Imagen` |
| `RemoteServiceGateway.lspkg/HostedExternal/Lyria` | `class Lyria` |
| `RemoteServiceGateway.lspkg/HostedSnap/Deepseek` | `class DeepSeek` (the file name is `Deepseek.ts`, the class is `DeepSeek`) |
| `RemoteServiceGateway.lspkg/HostedSnap/DeepSeekTypes` | `namespace DeepSeekTypes` |
| `RemoteServiceGateway.lspkg/HostedSnap/Snap3D` | `class Snap3D` |
| `RemoteServiceGateway.lspkg/HostedSnap/Snap3DTypes` | `namespace Snap3DTypes` |
| `RemoteServiceGateway.lspkg/Helpers/MicrophoneRecorder` | `class MicrophoneRecorder` (`@component`) |
| `RemoteServiceGateway.lspkg/Helpers/DynamicAudioOutput` | `class DynamicAudioOutput` (`@component`) |
| `RemoteServiceGateway.lspkg/Helpers/AudioProcessor` | `class AudioProcessor` (plain class) |
| `RemoteServiceGateway.lspkg/Helpers/VideoController` | `class VideoController` (plain class) |
| `RemoteServiceGateway.lspkg/Utils/Event` | `default class Event<Arg>`, types `callback<Arg>`, `unsubscribe`, `PublicApi<Arg>` |
| `RemoteServiceGateway.lspkg/Utils/Promisfy` | `promisify`, `promisifyWithReject`, `namespace Promisfy` |
| `RemoteServiceGateway.lspkg/Resources/Visuals/LoadingSpinner/LoadingSpinner/LoadingSpinner` | `class LoadingSpinner` (`@component`) |

## Wire types

The `*Types` modules are type-only namespaces that mirror each provider's request and response JSON. Import the namespace and use the nested names, for example `OpenAITypes.ChatCompletions.Request` or `GoogleGenAITypes.Gemini.Models.GenerateContentRequest`. `GeminiTypes` (in `GoogleGenAITypes.ts`, re-exported by `HostedExternal/GeminiTypes`) is the deprecated legacy copy of `GoogleGenAITypes.Common` / `Gemini.Models` / `Gemini.Live` with the same member names (plus `Models.GeminiGenerateContentRequestBody`); use `GoogleGenAITypes` for new code.

| Namespace | Exported members |
|---|---|
| `OpenAITypes.Common` | `Usage`, `FileObject`, `ErrorObject`, `Metadata`, `ToolDefinition`, `Tool`, `ToolChoiceOption` |
| `OpenAITypes.ChatCompletions` | `Role`, `ContentPartText`, `ContentPartImage`, `ContentPart`, `MessageToolCallFunction`, `MessageToolCall`, `Message`, `ResponseFormat`, `AudioParameters`, `WebSearchOptions`, `Request`, `ResponseMessage`, `Choice`, `UsageDetails`, `Response`, `ChunkDelta`, `ChunkChoice`, `ChunkResponse` |
| `OpenAITypes.ImageGenerate` | `Model`, `Quality`, `Style`, `ResponseFormat`, `OutputFormatGptImage1`, `BackgroundGptImage1`, `ModerationGptImage1`, `Request`, `ImageObject`, `UsageDetails`, `ImageUsage`, `Response` |
| `OpenAITypes.ImageEdits` | `Request` |
| `OpenAITypes.Speech` | `Model`, `Voice`, `ResponseFormat`, `Request` |
| `OpenAITypes.Realtime` | `AudioFormat`, `Model`, `Voice`, `InputAudioNoiseReduction`, `InputAudioTranscription`, `TurnDetectionServerVAD`, `TurnDetectionSemanticVAD`, `TurnDetection`, `SessionParameters`, `ClientEventBase`, `SessionUpdateRequest`, `ClientSessionMessages`, `InputAudioBufferAppendRequest`, `InputAudioBufferCommitRequest`, `InputAudioBufferClearRequest`, `ClientInputAudioBufferMessages`, `ConversationItemContentPart`, `ConversationItem`, `ConversationItemCreateRequest`, `ConversationItemRetrieveRequest`, `ConversationItemTruncateRequest`, `ConversationItemDeleteRequest`, `ClientConversationMessages`, `ResponseCreateParameters`, `ResponseCreateRequest`, `ResponseCancelRequest`, `ClientResponseMessages`, `TranscriptionSessionUpdateParameters`, `TranscriptionSessionUpdateRequest`, `ClientTranscriptionSessionMessages`, `OutputAudioBufferClearRequest`, `ClientOutputAudioBufferMessages`, `ClientMessage`, `ServerEventBase`, `ServerErrorDetails`, `ErrorEvent`, `ClientSecret`, `SessionResponse`, `SessionCreatedEvent`, `SessionUpdatedEvent`, `ServerSessionMessages`, `Conversation`, `ConversationCreatedEvent`, `ConversationItemCreatedEvent`, `ConversationItemRetrievedEvent`, `Logprobs`, `ConversationItemInputAudioTranscriptionCompletedEvent`, `ConversationItemInputAudioTranscriptionDeltaEvent`, `TranscriptionError`, `ConversationItemInputAudioTranscriptionFailedEvent`, `ConversationItemTruncatedEvent`, `ConversationItemDeletedEvent`, `ServerConversationMessages`, `InputAudioBufferCommittedEvent`, `InputAudioBufferClearedEvent`, `InputAudioBufferSpeechStartedEvent`, `InputAudioBufferSpeechStoppedEvent`, `ServerInputAudioBufferMessages`, `RealtimeApiResponseObject`, `ResponseCreatedEvent`, `ResponseDoneEvent`, `ResponseOutputItemAddedEvent`, `ResponseOutputItemDoneEvent`, `ResponseContentPartAddedEvent`, `ResponseContentPartDoneEvent`, `ResponseTextDeltaEvent`, `ResponseTextDoneEvent`, `ResponseAudioTranscriptDeltaEvent`, `ResponseAudioTranscriptDoneEvent`, `ResponseAudioDeltaEvent`, `ResponseAudioDoneEvent`, `ResponseFunctionCallArgumentsDeltaEvent`, `ResponseFunctionCallArgumentsDoneEvent`, `ServerResponseMessages`, `TranscriptionSessionResponse`, `TranscriptionSessionUpdatedEvent`, `ServerTranscriptionSessionMessages`, `RateLimitsUpdatedEvent`, `ServerRateLimitsMessages`, `UnknownServerEvent`, `ServerMessage`, `RequestSession` |
| `GoogleGenAITypes.Common` | `HarmBlockThreshold`, `SchemaType`, `FunctionCallingMode`, `Part`, `Blob`, `FileData`, `FunctionCall`, `FunctionResponse`, `Content`, `SafetySetting`, `Candidate`, `SafetyRating`, `PromptFeedback`, `UsageMetadata`, `Schema`, `FunctionDeclaration`, `Tool`, `FunctionCallingConfig`, `ToolConfig`, `SpeechConfig`, `PrebuiltVoiceConfig`, `VoiceConfig`, `GenerationConfig`, `ThinkingConfig` |
| `GoogleGenAITypes.Gemini.Models` | `GenerateContentRequestBody`, `GenerateContentRequest`, `GenerateContentResponse` |
| `GoogleGenAITypes.Gemini.Live` | `ClientMessageBase`, `ServerMessageBase`, `SlidingWindow`, `ContextWindowCompression`, `Setup`, `MediaChunk`, `RealtimeInput`, `ClientContent`, `ToolResponse`, `SetupCompleteEvent`, `Transcription`, `ServerContentEvent`, `ContentServerMessageEvent`, `ToolCallEvent`, `ToolCallCancellationEvent`, `TranscriptionEvent`, `UsageMetadataEvent`, `GoAwayEvent`, `ClientMessage`, `ServerMessage` |
| `GoogleGenAITypes.Lyria` | `LyriaInstance`, `LyriaParameters`, `LyriaRequestBody`, `GenerateMusicRequest`, `AudioPrediction`, `LyriaApiResponse`, `LyriaRequest`, `LyriaResponse` |
| `GoogleGenAITypes.Imagen` | `GenerateContentModel`, `GenerateContentRequest`, `GenerateImageRequest`, `ImagenInstance`, `ImagenParameters`, `ImagenRequest`, `ImagenPrediction`, `ImagenResponse` |
| `GeminiTypes.Common` | `HarmBlockThreshold`, `SchemaType`, `FunctionCallingMode`, `Part`, `Blob`, `FileData`, `FunctionCall`, `FunctionResponse`, `Content`, `SafetySetting`, `Candidate`, `SafetyRating`, `PromptFeedback`, `UsageMetadata`, `Schema`, `FunctionDeclaration`, `Tool`, `FunctionCallingConfig`, `ToolConfig`, `SpeechConfig`, `PrebuiltVoiceConfig`, `VoiceConfig`, `GenerationConfig`, `ThinkingConfig` |
| `GeminiTypes.Models` | `GenerateContentRequestBody`, `GenerateContentRequest`, `GenerateContentResponse`, `GeminiGenerateContentRequestBody` |
| `GeminiTypes.Live` | `ClientMessageBase`, `ServerMessageBase`, `SlidingWindow`, `ContextWindowCompression`, `Setup`, `MediaChunk`, `RealtimeInput`, `ClientContent`, `ToolResponse`, `SetupCompleteEvent`, `Transcription`, `ServerContentEvent`, `ContentServerMessageEvent`, `ToolCallEvent`, `ToolCallCancellationEvent`, `TranscriptionEvent`, `UsageMetadataEvent`, `GoAwayEvent`, `ClientMessage`, `ServerMessage` |
| `DeepSeekTypes.ChatCompletions` | `Role`, `Model`, `ResponseFormat`, `Message`, `Tool`, `Request`, `Choice`, `Usage`, `Response`, `ChunkChoice`, `ChunkResponse` |
| `Snap3DTypes` | `FileFormat`, `SubmitRequestBody`, `SubmitResponseBody`, `GetStatusRequestBody`, `GetStatusResponseBody`, `Artifact`, `ArtifactType`, `Status`, `Stage`, `TextureAssetData`, `GltfAssetData`, `ErrorData`, `SubmitGetStatusResults` |

## Common behavior of the service modules

- Every method is `static`. You never instantiate `OpenAI`, `Gemini`, `Imagen`,
  `Lyria`, `DeepSeek` or `Snap3D`.
- A request succeeds when the Remote Service Module answers with
  `statusCode == 1`. Then the JSON body is parsed and the Promise resolves.
- On failure the Promise **rejects**:
  - `OpenAI`, `Gemini.models` and `DeepSeek` reject with the raw response body
    string. `Gemini.models` also prints `Error: <body>`.
  - `Imagen` and `Lyria` reject with `new Error(body)` (or `new Error("Failed to parse ...")`)
    and print `Imagen API Error: ...` / `Lyria API Error: ...` plus the status code.
  - `Snap3D.submit` / `submitAndGetStatus` reject with `"<statusCode>: <body>"`.
    `getStatus` also rejects with `"<error_code>: <error_msg>"` when the task failed.
- The token is read from `RemoteServiceGatewayCredentials.getApiToken(...)` per
  request ([setup](setup.md)). An empty or placeholder token is sent as is.

## RemoteServiceGatewayCredentials

`RemoteServiceGateway.lspkg/RemoteServiceGatewayCredentials`

- `enum AvaliableApiTypes { Snap = "Snap", OpenAI = "OpenAI", Google = "Google" }`
  (the spelling `Avaliable` is the real identifier).
- `@component class RemoteServiceGatewayCredentials`:

| Input | Type | Default | Meaning |
|---|---|---|---|
| `openAIToken` | `string` | `"[INSERT OPENAI TOKEN HERE]"` | Token for `AvaliableApiTypes.OpenAI` |
| `googleToken` | `string` | `"[INSERT GOOGLE TOKEN HERE]"` | Token for `AvaliableApiTypes.Google` |
| `snapToken` | `string` | `"[INSERT SNAP TOKEN HERE]"` | Token for `AvaliableApiTypes.Snap` |
| `enableLogging` | `boolean` | `false` | General Logger output |
| `enableLoggingLifecycle` | `boolean` | `false` | Lifecycle Logger output |

- `static setApiToken(type: AvaliableApiTypes, token: string): void` stores the token for any of the three types.
- `static getApiToken(type: AvaliableApiTypes): string` returns the token, or `""` when none is set.
- `onAwake` copies the three inputs into the statics and overwrites earlier `setApiToken` calls.

Details and the token warning: [setup](setup.md).

## OpenAI

`RemoteServiceGateway.lspkg/HostedExternal/OpenAI`, types in `OpenAITypes`.

| Method | Request type | Resolves with |
|---|---|---|
| `OpenAI.chatCompletions(req)` | `OpenAITypes.ChatCompletions.Request` (`model`, `messages` required; `tools`, `tool_choice`, `temperature`, `max_tokens`, ...) | `OpenAITypes.ChatCompletions.Response` (`choices[i].message.content: string \| null`, `tool_calls`) |
| `OpenAI.imagesGenerate(req)` | `OpenAITypes.ImageGenerate.Request` (`prompt` required; `model`, `n`, `size`, `quality`, `response_format`, ...) | `OpenAITypes.ImageGenerate.Response` (`data[i].url` or `data[i].b64_json`) |
| `OpenAI.imagesEdit(req)` | `OpenAITypes.ImageEdits.Request` (`image: Uint8Array \| Uint8Array[]`, `prompt`, `n` required; `mask?: Uint8Array`, `model`, `size`, `response_format`) | `OpenAITypes.ImageGenerate.Response` |
| `OpenAI.speech(req)` | `OpenAITypes.Speech.Request` (`model`, `input`, `voice` required; `instructions`, `speed`, `response_format`) | `AudioTrackAsset` (loaded through Remote Media Module) |
| `OpenAI.createRealtimeSession(req)` | `OpenAITypes.Realtime.RequestSession` (`{ model: string }`) | returns an `OpenAIRealtimeWebsocket` synchronously |

`imagesEdit` builds a `multipart/form-data` body itself. It encodes `image`
only when it is a single `Uint8Array` (or `ArrayBuffer` / `string`). A
`Uint8Array[]` passes the type check but is not written into the body.

### OpenAIRealtimeWebsocket

The constructor connects right away (endpoint `real_time`, `model` from the request).

| Member | Type |
|---|---|
| `onOpen` | `Event<WebSocketEvent>` |
| `onMessage` | `Event<OpenAITypes.Realtime.ServerMessage>` (JSON-parsed) |
| `onError` | `Event<WebSocketEvent>` |
| `onClose` | `Event<WebSocketCloseEvent>` |
| `send(message: OpenAITypes.Realtime.ClientMessage)` | JSON-stringifies. **Silently dropped unless the socket is OPEN.** |
| `overrideSend(message: any)` | Sends raw, only when OPEN |
| `isConnected(): boolean` | `readyState == OPEN` |
| `close()` | Closes the socket |

## Gemini (two modules)

- `HostedExternal/Gemini.ts` is the implementation. It exports `Gemini` and
  `GeminiLiveWebsocket`.
- `HostedExternal/GoogleGenAI.ts` is a facade. `GoogleGenAI.Gemini`,
  `GoogleGenAI.Lyria` and `GoogleGenAI.Imagen` are `static readonly` references
  to the same classes. It also re-exports `Gemini` "for backwards compatibility"
  and type-re-exports `GoogleGenAITypes`. It does **not** export
  `GeminiLiveWebsocket`.
- The bundled examples (`ExampleGeminiCalls`, `ExampleGeminiLive`) import
  `{ Gemini } from "../GoogleGenAI"` and `{ GeminiTypes } from "../GoogleGenAITypes"`.
  Both `Gemini` imports resolve to the same class.

| Method | Request | Resolves with |
|---|---|---|
| `Gemini.models(req)` | `GoogleGenAITypes.Gemini.Models.GenerateContentRequest` = `{ model: string; type: string; body: GenerateContentRequestBody }`, `type` is typically `"generateContent"`; `body.contents` required, plus `generationConfig`, `tools`, `systemInstruction`, `safetySettings`, ... | `GoogleGenAITypes.Gemini.Models.GenerateContentResponse` (`candidates[i].content.parts[j].text` / `.inlineData` / `.functionCall`) |
| `Gemini.liveConnect()` | none | returns a `GeminiLiveWebsocket` synchronously (endpoint `live_api`) |

### GeminiLiveWebsocket

Same surface as `OpenAIRealtimeWebsocket`: `onOpen`, `onMessage`
(`Event<GoogleGenAITypes.Gemini.Live.ServerMessage>`), `onError`, `onClose`,
`send(message: GoogleGenAITypes.Gemini.Live.ClientMessage)` (dropped unless
OPEN), `overrideSend`, `isConnected()`, `close()`.

Live client messages use **snake_case** keys: `setup { model, generation_config,
system_instruction, tools, contextWindowCompression, input_audio_transcription,
output_audio_transcription }`, `realtime_input { media_chunks[{ mime_type, data }],
text, audio, video, activity_start, activity_end, audio_stream_end }`,
`client_content { turns, turn_complete }`, `tool_response { function_responses }`.
Server messages are camelCase: `setupComplete`, `serverContent { modelTurn,
turnComplete, interrupted, inputTranscription, outputTranscription }`,
`toolCall { functionCalls }`, `toolCallCancellation`, `usageMetadata`, `goAway`.

## Imagen

`RemoteServiceGateway.lspkg/HostedExternal/Imagen`

- `Imagen.generateContent(req: GoogleGenAITypes.Imagen.GenerateContentRequest): Promise<GoogleGenAITypes.Gemini.Models.GenerateContentResponse>`
  - `req.model`: typed hints are `"gemini-3.1-flash-image"`, `"gemini-3.1-flash-lite-image"` (any string accepted). These are the models the Imagen route serves.
  - `req.type`: `"generateContent"` (the default and the only type the route accepts).
  - `req.body`: a Gemini generateContent body: `{ contents: [{ role, parts: [{ text }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }`.
  - Response: the image is the `inlineData` part in `candidates[0].content.parts`. Decode `inlineData.data` with `Base64.decodeTextureAsync`.
- `Imagen.generateImage(req: GoogleGenAITypes.Imagen.ImagenRequest): Promise<GoogleGenAITypes.Imagen.ImagenResponse>`: **deprecated**. The `imagen-3.0` / `imagen-4.0` predict models it was written for are no longer served, so requests fail.
  - `req.model`: typed hints are `"imagen-3.0-generate-002"`, `"imagen-4.0-fast-generate-001"`, `"imagen-4.0-generate-001"`, `"imagen-4.0-ultra-generate-001"` (any string accepted).
  - `req.body`: `{ instances: [{ prompt }], parameters?: { sampleCount (required in the type), aspectRatio, addWatermark, enhancePrompt, language, negativePrompt, seed, personGeneration, safetySetting, sampleImageSize, ... } }`.
  - Response: `predictions[i].bytesBase64Encoded` (+ `mimeType`). Decode with `Base64.decodeTextureAsync`.
- Edit and upscale are not implemented. The source says the proxy does not support them.

## Lyria

`RemoteServiceGateway.lspkg/HostedExternal/Lyria`

- `Lyria.performLyriaRequest(req: GoogleGenAITypes.Lyria.LyriaRequest): Promise<GoogleGenAITypes.Lyria.LyriaResponse>`
  - `req`: `{ model: string; type: string; body: { instances: [{ prompt, negative_prompt?, seed? }], parameters?: { sample_count? } } }`. The example uses `model: "lyria-002"`, `type: "predict"`.
  - Response: `predictions[i].bytesBase64Encoded` (a base64 WAV, per the type comment) and `mimeType`. The type comment says each clip is 32.8 s.
- `GoogleGenAITypes.Lyria.GenerateMusicRequest` exists as a type, but no method takes it.

## DeepSeek

`RemoteServiceGateway.lspkg/HostedSnap/Deepseek` (class `DeepSeek`, token type `Snap`)

- `DeepSeek.chatCompletions(req: DeepSeekTypes.ChatCompletions.Request): Promise<DeepSeekTypes.ChatCompletions.Response>`
  - `req.model`: `DeepSeekTypes.ChatCompletions.Model = "DeepSeek-R1" | string`. The example uses `"DeepSeek-R1"`.
  - `req.messages[i]`: `{ role, content: string, ... }`.
  - Response: `choices[i].message.content` and `choices[i].message.reasoning_content` (R1 reasoning).

## Snap3D

`RemoteServiceGateway.lspkg/HostedSnap/Snap3D` (token type `Snap`). There is **no** `generate` method.

| Method | Signature | Use |
|---|---|---|
| `submit` | `(body: Snap3DTypes.SubmitRequestBody) => Promise<string>` | Submit only. Resolves with `task_id`. |
| `getStatus` | `(body: Snap3DTypes.GetStatusRequestBody) => Promise<Snap3DTypes.GetStatusResponseBody>` | One status poll. Rejects when `status === "failed"`. Does not download artifacts. |
| `submitAndGetStatus` | `(body: Snap3DTypes.SubmitRequestBody) => Promise<Snap3DTypes.SubmitGetStatusResults>` | Submit, then poll and download automatically. Use this one. |
| `submitImageTo3D` | `(imageUrl: string, options?: { prompt?: string; refine?: boolean; use_vertex_color?: boolean }) => Promise<SubmitGetStatusResults>` | Wrapper that fills `image_url`. Defaults: `prompt "an object"`, `refine true`, `use_vertex_color false`. |

- `SubmitRequestBody`: `{ prompt: string; format: "glb"; refine: boolean; use_vertex_color: boolean; image_url?: string }`.
  The module adds `use_case: "Glasses"` to the JSON it sends.
- `SubmitGetStatusResults`: `{ task_id, status, event, texture?, textureUrl?, baseMeshGltf?, baseMeshUrl?, refinedMeshGltf?, refinedMeshUrl? }`.
- `event` is an `Event<[ArtifactType | "failed", TextureAssetData | GltfAssetData | ErrorData]>`.
  The handler receives **one tuple argument**, so write `event.add(([kind, data]) => ...)`. Order:
  1. `"image"` with `{ url, texture }` when the stage reaches `base_mesh_gen`,
  2. `"base_mesh"` with `{ url, gltfAsset }` when the stage reaches `refined_mesh_gen`,
  3. `"refined_mesh"` with `{ url, gltfAsset }` when `status === "completed"`, which ends polling,
  4. `"failed"` with `{ errorMsg, errorCode }` at any point, which ends polling on server errors.
- `submitAndGetStatus` creates a helper SceneObject named `Snap3D` (a `ScriptComponent` for its timers) the first time it is used.
- Instantiate a mesh with `gltfAsset.tryInstantiate(parent, material)`.

## Helpers

### MicrophoneRecorder (`@component`)

| Input | Type | Default | Meaning |
|---|---|---|---|
| `micAudioTrack` | `AudioTrackAsset` | none, **required** (no `@allowUndefined`) | A Microphone Audio track, `Resources/Microphone Audio.micaudio` in the prefab |
| `enableLogging` / `enableLoggingLifecycle` | `boolean` | `false` | Logger output |

- `onAudioFrame: Event<Float32Array>` fires every frame while recording.
- `setSampleRate(sampleRate: number)`, `startRecording()`, `stopRecording()`. None take a callback.
- `onAwake` requires `LensStudio:VoiceMLModule` (for bystander rejection) and
  reads `micAudioTrack.control`, so call the methods after the component has awoken.

### DynamicAudioOutput (`@component`)

| Input | Type | Default | Meaning |
|---|---|---|---|
| `audioOutputTrack` | `AudioTrackAsset` | none, **required** | An Audio Output asset, `Resources/Audio Output.audioOutput` in the prefab |
| `enableLogging` / `enableLoggingLifecycle` | `boolean` | `false` | Logger output |

- It needs an `AudioComponent` on the **same** SceneObject (`getComponent("AudioComponent")` in `onAwake`).
- `initialize(sampleRate: number)` sets the rate, assigns the track and starts looping playback.
- `addAudioFrame(uint8Array: Uint8Array, channels = 1)` takes PCM16 little-endian
  (interleaved when `channels > 1`) and enqueues it. Multi-channel input is
  reduced to the first channel.
- `interruptAudioOutput()` stops playback if it is playing.
- There is no `playAudioData`.

### AudioProcessor (plain class)

- `new AudioProcessor(sendRateMS = 100)`.
- `processFrame(audioFrame: Float32Array)` converts the frame to PCM16 and
  buffers it. Every `sendRateMS` it fires `onAudioChunkReady: Event<string>`
  with the base64 PCM16 chunk. The first frame only starts the timer.

### VideoController (plain class)

- `new VideoController(sendRateMS = 2000, compressionQuality = CompressionQuality.IntermediateQuality, encodingType = EncodingType.Jpg)`.
- `startRecording()` requests `CameraModule.CameraId.Default_Color`. At most
  every `sendRateMS` it fires `onEncodedFrame: Event<string>` with the raw
  base64 frame (no `data:` prefix). `stopRecording()` stops it.

## Utils

### Event (`Utils/Event`, default export)

- `new Event<Arg>(...callbacks)`, `add(handler)` (returns `void`), `remove(handler)`, `invoke(arg)`.
- `publicApi(): PublicApi<Arg>` returns a function you can call or `.add`, which returns an `unsubscribe` function. The modules expose raw `Event` instances, so their `add` returns nothing and you unsubscribe with `remove(sameHandler)`.

### Promisfy (`Utils/Promisfy`)

- `promisify(target, fn, ...args)` and `promisifyWithReject(target, fn, ...args)` are generic wrappers for callback APIs.
- `Promisfy.RemoteServiceModule.performApiRequest(module, request): Promise<RemoteApiResponse>`
- `Promisfy.InternetModule.performHttpRequest(module, request): Promise<RemoteServiceHttpResponse>`
- `Promisfy.RemoteMediaModule.loadResourceAsImageTexture | loadResourceAsVideoTexture | loadResourceAsGltfAsset | loadResourceAsAudioTrackAsset(module, resource)`, which reject on failure.

## LoadingSpinner (`@component`)

`Resources/Visuals/LoadingSpinner/LoadingSpinner/LoadingSpinner.ts`, prefab `Resources/Visuals/LoadingSpinner/LoadingSpinner.prefab`.

| Input | Type | Default | Meaning |
|---|---|---|---|
| `renderOrder` | `int` | `0` | Render order of the spinner mesh |

It has no public methods. It adds (or reuses) a `RenderMeshVisual` with its own
mesh and material and fades in on start and on enable. Show or hide it by
enabling or disabling its SceneObject. The examples find it as a fixed child
index of their output objects.

## Demo assets (`Resources/`)

- `Resources/Microphone Audio.micaudio` and `Resources/Audio Output.audioOutput`: wired into `MicrophoneRecorder.micAudioTrack` and `DynamicAudioOutput.audioOutputTrack` in the prefab.
- `Resources/Visuals/Materials/Unlit.mat` (`unlit.graphShader`): the prefab's `ExampleSnap3D.modelMat`.
- `Resources/Visuals/Materials/Image.mat` and `SnapImage3D.mat` (both `flat.graphShader`, `Image.png`): the Image materials on the prefab's `ImageOutputExample` and `ImageRoot` objects.
- `Resources/Visuals/LoadingSpinner/`: the LoadingSpinner prefab, mesh, material and shader (see [LoadingSpinner](#loadingspinner-component)).

## Demo scaffolding (`Example/`)

These scripts ship in `RemoteServiceGateway.lspkg/Example/` and are wired inside
`RemoteServiceGateway__PLACE_IN_SCENE.prefab`. They only present the demo;
the RemoteServiceGateway scripts don't import them. Prefab children, in order:
`RemoteServiceGatewayCredentials`, `CredentialsWarning`, `Guide`, `ExampleCarousel`,
`Snap Hosted Examples` and `External Hosted Examples`.

| Object / script | Class | Key inputs |
|---|---|---|
| `CredentialsWarning`: `Example/CredentialsWarning/CredentialsWarning.ts` | `CredentialsWarning` | `guide: SceneObject` (here `Guide`), `rsgCredentials: ScriptComponent` (here the `RemoteServiceGatewayCredentials` component), `snapCloudRequirements: ScriptComponent` (empty: no Snap Cloud), `requireSnapToken` / `requireOpenAIToken` / `requireGoogleToken: boolean = false` (all `true` here), `buttonLabel: string = "Continue without credentials"`. When a required token is empty or a `[INSERT …]` placeholder it prints one `CredentialsWarning: …` line per token, holds the guide and shows a red-framed "Credentials needed" panel; otherwise it disables itself. Public `findMissing(): string[]` |
| `Guide`: `Example/GuideDismissPanel/GuideDismissPanel.ts` | `GuideDismissPanel` | `hideUntilDismissed: SceneObject[]` lists the objects hidden until "Ok, I understood" is pressed (here: `ExampleCarousel`, `Snap Hosted Examples` and `External Hosted Examples`). `buttonLabel: string = "Ok, I understood"` is only used when the panel is built at runtime |
| `ExampleCarousel`: `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (here the six provider views: Snap3D, DeepSeek, OpenAI, OpenAI Realtime, Gemini/Imagen/Lyria, Gemini Live), `exampleInfo: string[]` (one line per example), `steps: SceneObject[]` (empty here), `stepInfo: string[]` (one line per `steps` entry; empty entries fall back to the example's info; empty here), `startIndex: number = 0`, `previousLabel` / `nextLabel`, `examplesPushBack: number = 20`, `anchorExamples: boolean = true`, `startMinimized: boolean = false`, `extraPanelDrop: number = 0` |

`hideUntilDismissed` points at the example groups rather than the prefab root,
because hiding the root would also hide the guide and the carousel.
`RemoteServiceGatewayCredentials` stays enabled so tokens are set before any
example runs. It sits above `CredentialsWarning`, which sits above `Guide`:
the warning reads the token inputs on awake and has to hold the guide before it
is shown.

## Example components

All examples follow the same pattern. In the editor they call `onTap` from a
`TapEvent`. On device they call it from the **right-hand** `GestureModule`
pinch-down. `onTap` returns at once when `!this.sceneObject.isEnabledInHierarchy`,
and runs only the calls whose `...OnTap` / `runOnTap` input is `true`. On
failure they write `Error: <error>` into their text output. Each also has
`enableLogging` / `enableLoggingLifecycle` (`boolean`, `false`), except
`ExampleImageTo3D.ts`.

### ExampleDeepseekCalls (`HostedSnap/Examples/ExampleDeepseekCalls.ts`)

| Input | Type | Default | Meaning |
|---|---|---|---|
| `textDisplay` | `Text` | undefined | Output text (reasoning + final answer) |
| `systemPrompt` | `string` | `"Give your reasoning in no more than one sentence."` | System message (keeps R1 reasoning short) |
| `userPrompt` | `string` | `"Is a hotdog a sandwich"` | User message |
| `runOnTap` | `boolean` | `false` | Run `doChatCompletions()` on tap/pinch |

Public method: `doChatCompletions()` (`DeepSeek-R1`, `max_tokens 2048`, `temperature 0.7`).

### ExampleSnap3D (`HostedSnap/Examples/ExampleSnap3D.ts`)

| Input | Type | Default | Meaning |
|---|---|---|---|
| `prompt` | `string` | `"A cute dog wearing a hat"` | Text prompt (prefab: "A cute cartoony dog wearing a hat") |
| `refineMesh` | `boolean` | `true` | `refine` |
| `useVertexColor` | `boolean` | `false` | `use_vertex_color` |
| `imageRoot` | `Image` | undefined | Shows the preview image. Its child **index 1** must be a spinner |
| `baseMeshRoot` | `SceneObject` | undefined | Parent of the base mesh. Child index 1 is the spinner |
| `refinedMeshRoot` | `SceneObject` | undefined | Parent of the refined mesh. Child index 1 is the spinner |
| `modelMat` | `Material` | undefined | Material for `tryInstantiate` |
| `hintText` | `Text` | undefined | Status text |
| `runOnTap` | `boolean` | `false` | Submit on tap/pinch. Ignored while a request is in flight |

The roots are `@allowUndefined`, but `onAwake` dereferences them, so they are required in practice.

### ExampleSnap3DImageTo3D (`HostedSnap/Examples/ExampleSnap3DImageTo3D.ts`)

Image-to-3D: sends `image_url` and shows the image fetched from the URL.

| Input | Type | Default | Meaning |
|---|---|---|---|
| `imageUrl` | `string` | `"https://example.com/image.png"` (placeholder) | Publicly reachable image URL |
| `prompt` | `string` | `"an object"` | Optional guidance prompt |
| `refineMesh` | `boolean` | `true` | `refine` |
| `useVertexColor` | `boolean` | `false` | `use_vertex_color` |
| `sourceImage` | `Image` | undefined | Shows the fetched source image |
| `baseMeshRoot` / `refinedMeshRoot` | `SceneObject` | undefined | Mesh parents. Child **index 0** must be the spinner |
| `modelMat` | `Material` | undefined | Mesh material |
| `hintText` | `Text` | undefined | Status text (also written in `onAwake`) |
| `runOnTap` | `boolean` | `false` | Generate on tap/pinch |

### ExampleImageTo3D (`HostedSnap/Examples/ExampleImageTo3D.ts`)

Class `ExampleImageTo3D` (before this revision it was also named `ExampleSnap3DImageTo3D`,
clashing with the image-to-3D example). It does text-to-3D from `prompt` and only *shows*
`sourceTexture`. The source says the image is "displayed but not used for
generation". Inputs: `sourceTexture: Texture` (required at tap time), `prompt`
(`"an object"`), `refineMesh` (`true`), `useVertexColor` (`false`),
`sourceImage`, `baseMeshRoot`, `refinedMeshRoot`, `modelMat`, `hintText`,
`runOnTap` (`false`). It has no logging inputs. It is the only example that
imports through the consumer prefix (`RemoteServiceGateway.lspkg/HostedSnap/Snap3D`).
`ExampleSnap3DImageTo3D` is in the prefab as the **Image To 3D** carousel step (a copy of the
Snap3D step, `imageUrl` = the package's public Asset Library image). `ExampleImageTo3D` is not
in the prefab.

### ExampleOAICalls (`HostedExternal/Examples/ExampleOAICalls.ts`)

| Input | Type | Default | Meaning |
|---|---|---|---|
| `textDisplay` | `Text` | undefined | Chat / function-calling / error output |
| `systemPrompt`, `userPrompt` | `string` | witty-assistant prompt, `"Is a hotdog a sandwich"` | Chat messages |
| `doChatCompletionsOnTap` ("Run On Tap") | `boolean` | `false` | `doChatCompletions()`: `gpt-5.6-luna` (no `temperature`: the GPT-5 family rejects non-default values) |
| `imgObject` | `SceneObject` | undefined | Image output. Needs an `Image` component, and **child 0** must be the spinner |
| `imageGenerationPrompt` | `string` | `"The future of augmented reality"` | GPT Image prompt |
| `generateImageOnTap` | `boolean` | `false` | `doImageGeneration()`: `gpt-image-2`, `1024x1024`, base64 (URL handled too) |
| `editBaseImg`, `editMaskImg` | `Texture` | `Resources/Visuals/ImageEdit/ImageEditBase.png`, `ImageEditMask.png` (prefab) | Edit input and mask (transparent area = region to edit) |
| `editResultObject` | `SceneObject` | undefined | Edit output (`Image`) |
| `imageEditPrompt` | `string` | `"Add a cat into the image"` | Edit prompt |
| `doEditImageOnTap` | `boolean` | `false` | `doImageEdit()`: `gpt-image-2`, `1024x1024` |
| `voiceGenerationPrompt`, `voiceGenerationInstructions` | `string` | trailer-voice text | TTS input / style |
| `generateVoiceOnTap` | `boolean` | `false` | `doSpeechGeneration()`: `gpt-4o-mini-tts`, voice `coral` |
| `functionCallingPrompt` | `string` | `"Make the text display yellow"` | Prompt for the `set-text-color` tool |
| `doFunctionCallingOnTap` | `boolean` | `false` | `doFunctionCalling()` |

`imgObject` is dereferenced in `onAwake`, so it is required in practice.

### ExampleGeminiCalls (`HostedExternal/Examples/ExampleGeminiCalls.ts`)

| Input | Type | Default | Meaning |
|---|---|---|---|
| `textDisplay` | `Text` | undefined | Output |
| `modelPrompt`, `textPrompt` | `string` | witty-assistant prompt, `"Is a hotdog a sandwich?"` | Text generation (`gemini-2.5-flash`) |
| `doTextGenerationOnTap` ("Run On Tap") | `boolean` | `false` | `textToTextExample()` |
| `imgObject` | `SceneObject` | undefined | Image output. **Child 0** is the spinner, so it is required in practice |
| `imageGenerationPrompt` | `string` | `"The future of augmented reality"` | `gemini-3.1-flash-image`, `responseModalities ["TEXT","IMAGE"]` |
| `generateImageOnTap` | `boolean` | `false` | `generateImageExample()` |
| `functionCallingPrompt` | `string` | `"Make the text display yellow"` | `set_text_color` tool |
| `doFunctionCallingOnTap` | `boolean` | `false` | `functionCallingExample()` |

### ExampleImagenCalls (`HostedExternal/Examples/ExampleImagenCalls.ts`)

| Input | Type | Default | Meaning |
|---|---|---|---|
| `imgObject` | `SceneObject` | undefined | Output `Image` (prefab: the **Gemini** example's `ImageOutputExample`) |
| `generatePrompt` | `string` | `"A futuristic cityscape at sunset"` | Prompt (`Imagen.generateContent`, `gemini-3.1-flash-image`, `responseModalities ["TEXT","IMAGE"]`) |
| `doGenerateOnTap` ("Run On Tap") | `boolean` | `false` | Generate on tap/pinch (**`true` in the prefab**) |

Errors go only to `logger.debug` (visible when `enableLogging` is on) and to the module's own `Imagen API Error:` print. Nothing goes to a text output.

### ExampleLyriaCall (`HostedExternal/Examples/ExampleLyriaCall.ts`)

| Input | Type | Default | Meaning |
|---|---|---|---|
| `musicPrompt` | `string` | `"An energetic electronic dance track with a fast tempo"` | Prompt (prefab: "Create an upbeat electronic dance track with a driving beat") |
| `negativePrompt` | `string` | `"vocals, slow tempo"` | `negative_prompt` |
| `seed` | `number` | `12345` | `seed` (`0` is sent as undefined) |
| `sampleCount` | `number` | `1` | `sample_count` |
| `generateMusicOnTap` ("Generate Music on tap") | `boolean` | `false` | Run `generateMusic()` on tap/pinch |
| `dynamicAudioOutput` | `DynamicAudioOutput` | none, **required** | Playback (initialized at 48000 Hz, frames added as 2 channels) |
| `playAudioOnTap` ("Play Generated Audio") | `boolean` | `false` | Binds `TapEvent` **and** the right-hand pinch only when `true` (`true` in the prefab) |

`onTap()` is public. One generation runs at a time, and the in-progress flag is reset on success and on failure.

### ExampleOAIRealtime (`HostedExternal/Examples/ExampleOAIRealtime.ts`)

| Input | Type | Default | Meaning |
|---|---|---|---|
| `websocketRequirementsObj` | `SceneObject` | undefined | Enabled in `onAwake` (holds the mic and audio objects) |
| `dynamicAudioOutput` | `DynamicAudioOutput` | undefined | Audio out (24000 Hz) |
| `microphoneRecorder` | `MicrophoneRecorder` | undefined | Mic in (24000 Hz) |
| `textDisplay` | `Text` | undefined | Transcript / status |
| `instructions` | `string` | `"You are a helpful assistant that loves to make puns"` | Session instructions |
| `audioOutput` | `boolean` | `false` | Answer with audio (`output_modalities: ["audio"]`, transcript included) instead of text |
| `voice` | `string` (combo, shown when `audioOutput`) | `"coral"` (prefab: `ash`) | alloy, ash, ballad, coral, echo, sage, shimmer, verse |

It opens the session (`gpt-realtime-mini`, server VAD) on
`OnStartEvent`, streams the mic as `input_audio_buffer.append` and handles the
`set-text-color` tool. Public method: `connectToWebsocket()`.

### ExampleGeminiLive (`HostedExternal/Examples/ExampleGeminiLive.ts`)

| Input | Type | Default | Meaning |
|---|---|---|---|
| `websocketRequirementsObj` | `SceneObject` | undefined | Enabled in `onAwake` |
| `dynamicAudioOutput` | `DynamicAudioOutput` | undefined | Audio out (24000 Hz) |
| `microphoneRecorder` | `MicrophoneRecorder` | undefined | Mic in (16000 Hz) |
| `textDisplay` | `Text` | undefined | Transcript / status |
| `instructions` | `string` | `"You are a helpful assistant that loves to make puns"` | `system_instruction` |
| `haveVideoInput` | `boolean` | `false` | Also stream camera frames (`VideoController`, JPEG) |
| `haveAudioOutput` | `boolean` | `false` | `AUDIO` response with voice, else `TEXT` |
| `voice` | `string` (combo, shown when `haveAudioOutput`) | `"Puck"` | Puck, Charon, Kore, Fenrir, Aoede, Leda, Orus, Zephyr |

It opens the session (`models/gemini-live-2.5-flash`) on
`OnStartEvent`, starts the mic after `setupComplete` and handles the
`change_text_color` tool. Public method: `createGeminiLiveSession()`.

The example prefab and its hierarchy are in [examples](examples.md#example-prefab).
