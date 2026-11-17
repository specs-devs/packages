# SnapCloudExamples media components

[← Agent usage index](../README.md)

## Use when

Read for camera, capture/stream controllers and every public media utility.

## CameraService

Import path: `SnapCloudExamples.lspkg/CompositeCameraWork/Scripts/CameraService`. Source: [`CompositeCameraWork/Scripts/CameraService.ts`](../CompositeCameraWork/Scripts/CameraService.ts).

Start requests Default_Color in Editor or Right_Color on device, assigns screenCropTexture CropTextureProvider input and exposes texture/provider. editorCamera input is not used by source. No readiness promise or teardown API; getters can be unset before Start. It only starts on an enabled object: in the main prefab that is `[CompositeImage]/VirtRender/Object 0/ImageBackground-CS`, on layer 2 so only the VirtRender composite camera draws its camera image (the standalone `SnapCloudExamples_CompositeImage__PLACE_IN_SCENE.prefab` uses the same layout).

### Inspector inputs

A missing initializer means no source default: assign the required reference; only `@allowUndefined`/`?` inputs explicitly allow absence. Types/defaults are literal source declarations. Meanings are authored hints; behavior qualifications above take precedence.

| Input declaration / default | Meaning |
|---|---|
| `editorCamera: Camera` | Authored Editor Camera reference; unused by implementation. |
| `screenCropTexture: Texture` | Crop texture; control must be CropTextureProvider. |
| `private camModule: CameraModule` (`@input`, declared `private`) | Required CameraModule asset used for camera request; set it in the Inspector, it is not reachable from other scripts. |

### Public members

Signatures are reference fragments, not standalone runnable scripts. Lifecycle methods should not be invoked repeatedly. No custom exported component event emitter is declared.

| Member | Contract / source description |
|---|---|
| `public get cameraTexture(): Texture` | Get the camera texture (for encoding capture) |
| `public get cameraTextureProvider(): CameraTextureProvider` | Get the camera texture provider (for onNewFrame callbacks) |
| `onAwake()` | Engine lifecycle hook; see lifecycle behavior above. |
| `start()` | Engine lifecycle hook; see lifecycle behavior above. |


## AudioCaptureUploader

Import path: `SnapCloudExamples.lspkg/Example5-Media/Scripts/AudioCaptureUploader`. Source: [`Example5-Media/Scripts/AudioCaptureUploader.ts`](../Example5-Media/Scripts/AudioCaptureUploader.ts).

Initializes microphone and auth. Button toggles recording or testSingleChunk mode; processes buffers into mono 16-bit PCM WAV and uploads <storageFolder>/<session>/chunk_<index>.wav. chunkDurationMs is a sample threshold; sampleRate controls WAV header. Source async chunk work can overlap updates; timing/error/repeat behavior needs live checks.

### Inspector inputs

A missing initializer means no source default: assign the required reference; only `@allowUndefined`/`?` inputs explicitly allow absence. Types/defaults are literal source declarations. Meanings are authored hints; behavior qualifications above take precedence.

| Input declaration / default | Meaning |
|---|---|
| `public snapCloudRequirements: SnapCloudRequirements` | Reference to SnapCloudRequirements for centralized Supabase configuration |
| `public storageBucket: string = "specs-bucket"` | Supabase Storage bucket name for audio chunks |
| `public storageFolder: string = "audio-recordings"` | Supabase Storage folder path for audio uploads |
| `public microphoneAsset: AudioTrackAsset` | Microphone audio track asset for recording |
| `@widget(new SliderWidget(8000, 48000, 1000)) public sampleRate: number = 16000` | Audio sample rate (Hz) - Use 16000 for voice, higher rates may cause chipmunk effect if not supported |
| `@widget(new SliderWidget(100, 2000, 100)) public chunkDurationMs: number = 1000` | Audio chunk size in milliseconds |
| `public recordButton: RectangleButton` | Button to start/stop audio recording |
| `public statusText: Text` | Text component to display status |
| `public buttonText: Text` | Text component to display button state (Start/Stop) |
| `public enableDebugLogs: boolean = true` | Enable detailed debug logging |
| `public testSingleChunk: boolean = false` | Test with single audio chunk capture before continuous |
| `enableLogging: boolean = false;` | Enable general logging (animation cycles, events, etc.) |
| `enableLoggingLifecycle: boolean = false;` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

### Public members

Signatures are reference fragments, not standalone runnable scripts. Lifecycle methods should not be invoked repeatedly. No custom exported component event emitter is declared.

| Member | Contract / source description |
|---|---|
| `onAwake(): void` | Engine lifecycle hook; see lifecycle behavior above. |


## AudioStreamingController

Import path: `SnapCloudExamples.lspkg/Example5-Media/Scripts/AudioStreamingController`. Source: [`Example5-Media/Scripts/AudioStreamingController.ts`](../Example5-Media/Scripts/AudioStreamingController.ts).

Microphone/realtime initialized at Start. Button starts/stops and sends audio-stream-init/started/ended and audio-chunk carrying Base64 mono PCM16 WAV plus timing/metadata. stream-control mute/stop-stream stops; adjust-quality only logs (compressionLevel is not an implemented codec). Matching listener: `ExternalServicesExamples/media-example-web-viewers/audio-stream-listener.html` (it plays `audio-chunk`; its start/end handlers listen for `stream-started`/`stream-ended`, not the `audio-stream-*` names this controller sends).

### Inspector inputs

A missing initializer means no source default: assign the required reference; only `@allowUndefined`/`?` inputs explicitly allow absence. Types/defaults are literal source declarations. Meanings are authored hints; behavior qualifications above take precedence.

| Input declaration / default | Meaning |
|---|---|
| `public snapCloudRequirements: SnapCloudRequirements` | Reference to SnapCloudRequirements for centralized Supabase configuration |
| `public streamingChannelName: string = "live-audio-stream"` | Supabase Realtime channel name for live audio streaming |
| `public microphoneAsset: AudioTrackAsset` | Microphone audio track asset for streaming |
| `@widget(new SliderWidget(8000, 48000, 1000)) public sampleRate: number = 16000` | Audio sample rate (Hz) - Use 16000 for voice, higher rates may not be supported |
| `@widget(new SliderWidget(100, 1000, 100)) public chunkSizeMs: number = 500` | Audio chunk size (milliseconds) |
| `@widget(new SliderWidget(0, 9, 1)) public compressionLevel: number = 3` | Audio compression level (0-9, higher = more compression) |
| `public streamButton: RectangleButton` | Button to start/stop audio streaming |
| `public statusText: Text` | Text component to display streaming status |
| `public buttonText: Text` | Text component to display button state (Start Stream/Stop Stream) |
| `public enableDebugLogs: boolean = true` | Enable detailed debug logging |
| `enableLogging: boolean = false;` | Enable general logging (animation cycles, events, etc.) |
| `enableLoggingLifecycle: boolean = false;` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

### Public members

Signatures are reference fragments, not standalone runnable scripts. Lifecycle methods should not be invoked repeatedly. No custom exported component event emitter is declared.

| Member | Contract / source description |
|---|---|
| `onAwake(): void` | Engine lifecycle hook; see lifecycle behavior above. |


## VideoCaptureUtility

Import path: `SnapCloudExamples.lspkg/Example5-Media/Scripts/CaptureUtilities`. Source: [`Example5-Media/Scripts/CaptureUtilities.ts`](../Example5-Media/Scripts/CaptureUtilities.ts).

Initialize from shared CameraService texture/provider (recommended) or request fallback camera. captureFrame encodes JPEG with quality>70 selecting HighQuality, otherwise IntermediateQuality (not numerical JPEG percent). uploadFrameToStorage decodes Base64 and uploads folder/session/frame_00000.jpg or .png based imageFormat with upsert; timestamp parameter is unused. Getters can be unset before initialization.

### Public members

Signatures are reference fragments, not standalone runnable scripts. Lifecycle methods should not be invoked repeatedly. No custom exported component event emitter is declared.

| Member | Contract / source description |
|---|---|
| `constructor(enableDebugLogs: boolean = true)` | See component behavior above; signature is the exact callable surface. |
| `initializeCameraFromService(cameraTexture: Texture, cameraTextureProvider: CameraTextureProvider): boolean` | Initialize camera from CameraService (RECOMMENDED - avoids conflicts) |
| `initializeCamera(): boolean` | Initialize camera for capture (FALLBACK - may conflict with CameraService!) |
| `async captureFrame(quality: number = 70): Promise<string>` | Capture current frame as base64 |
| `getCameraTexture(): Texture` | Get camera texture for streaming (onNewFrame subscription) |
| `getCameraTextureProvider(): CameraTextureProvider` | Get camera texture provider for frame events |
| `async uploadFrameToStorage( supabaseClient: any, storageBucket: string, sessionId: string, frameNumber: number, frameData: string, timestamp: number, storageFolder: string = "video-frames", imageFormat: number = 0 // 0 = JPG, 1 = PNG ): Promise<boolean>` | Upload frame to Supabase Storage  |

## AudioCaptureUtility

Import path: `SnapCloudExamples.lspkg/Example5-Media/Scripts/CaptureUtilities`. Source: [`Example5-Media/Scripts/CaptureUtilities.ts`](../Example5-Media/Scripts/CaptureUtilities.ts).

Initialize microphone/sampleRate, start resets buffer, processAudioFrame must be called from update and appends Float32 samples, stop only stops microphone and returns success. getAndClearAudioBuffer combines raw Float32 bytes and clears; it is not WAV. uploadAudioToStorage uploads .raw/audio/raw with upsert; timestamp unused. getCurrentAudioBuffer returns a shallow copy of frame array.

### Public members

Signatures are reference fragments, not standalone runnable scripts. Lifecycle methods should not be invoked repeatedly. No custom exported component event emitter is declared.

| Member | Contract / source description |
|---|---|
| `constructor(enableDebugLogs: boolean = true)` | See component behavior above; signature is the exact callable surface. |
| `initializeAudio(microphoneAsset: AudioTrackAsset, sampleRate: number = 44100): boolean` | Initialize audio with microphone asset |
| `startRecording(): boolean` | Start audio recording |
| `stopRecording(): boolean` | Stop audio recording |
| `processAudioFrame(): Float32Array \| null` | Process audio frame (call this from UpdateEvent) |
| `getAndClearAudioBuffer(): Uint8Array` | Get and clear current audio buffer as combined array |
| `getCurrentAudioBuffer(): Float32Array[]` | Get current audio buffer without clearing |
| `clearAudioBuffer(): void` | Clear audio buffer |
| `hasEnoughSamplesForChunk(chunkDurationMs: number, sampleRate: number): boolean` | Check if enough samples for chunk |
| `async uploadAudioToStorage( supabaseClient: any, storageBucket: string, sessionId: string, chunkNumber: number, audioData: Uint8Array, timestamp: number, storageFolder: string = "audio-recordings" ): Promise<boolean>` | Upload audio chunk to Supabase Storage |

## SupabaseAuthUtility

Import path: `SnapCloudExamples.lspkg/Example5-Media/Scripts/CaptureUtilities`. Source: [`Example5-Media/Scripts/CaptureUtilities.ts`](../Example5-Media/Scripts/CaptureUtilities.ts).

initializeAndAuthenticate validates nested requirements presence, creates client and signs in via snapchat empty-token adapter. Returns boolean and caches userId/auth flag. Client/user getters can be unset before success; no cleanup API.

### Public members

Signatures are reference fragments, not standalone runnable scripts. Lifecycle methods should not be invoked repeatedly. No custom exported component event emitter is declared.

| Member | Contract / source description |
|---|---|
| `constructor(enableDebugLogs: boolean = true)` | See component behavior above; signature is the exact callable surface. |
| `async initializeAndAuthenticate(snapCloudRequirements: SnapCloudRequirements): Promise<boolean>` | Initialize Supabase client and authenticate |
| `getSupabaseClient(): any` | Get Supabase client |
| `getUserId(): string` | Get user ID |
| `isAuth(): boolean` | Check if authenticated |

## SessionUtility

Import path: `SnapCloudExamples.lspkg/Example5-Media/Scripts/CaptureUtilities`. Source: [`Example5-Media/Scripts/CaptureUtilities.ts`](../Example5-Media/Scripts/CaptureUtilities.ts).

Static IDs combine prefix, Date.now and Math.random, not cryptographic identity. createSyncMetadata returns {sessionId,startTime,timestamp:Date.now(),createdBy:"spectacles_user"}.

### Public members

Signatures are reference fragments, not standalone runnable scripts. Lifecycle methods should not be invoked repeatedly. No custom exported component event emitter is declared.

| Member | Contract / source description |
|---|---|
| `static generateSessionId(prefix: string = "session"): string` | Generate unique session ID for synchronization |
| `static createSyncMetadata(sessionId: string, startTime: number)` | Generate metadata for video audio synchronization |


## CompositeCaptureUploader

Import path: `SnapCloudExamples.lspkg/Example5-Media/Scripts/CompositeCaptureUploader`. Source: [`Example5-Media/Scripts/CompositeCaptureUploader.ts`](../Example5-Media/Scripts/CompositeCaptureUploader.ts).

Records video frames and raw Float32 audio in memory, then stop uploads frames and converts/uploads WAV audio sequentially, writes metadata/session_info.json and final_stats.json, verifies metadata listing, invokes trigger-composite-stitch (sample sources: `ExternalServicesExamples/media-example-server-composite-stitcher-edge-function/` and `media-example-server-composite-stitcher/`, see [setup](setup.md#shipped-backend-and-viewer-samples-externalservicesexamples)). shareToSpotlight and caption/crop are request fields for that backend, not native publication. Defaults shareToSpotlight=false. Final metadata duration includes processing/upload time while stitching also receives actualRecordingDurationMs and chunk-derived duration; these may differ.

### Inspector inputs

A missing initializer means no source default: assign the required reference; only `@allowUndefined`/`?` inputs explicitly allow absence. Types/defaults are literal source declarations. Meanings are authored hints; behavior qualifications above take precedence.

| Input declaration / default | Meaning |
|---|---|
| `public snapCloudRequirements: SnapCloudRequirements` | Reference to SnapCloudRequirements for centralized Supabase configuration |
| `public storageBucket: string = "specs-bucket"` | Supabase Storage bucket name for composite uploads |
| `public videoStorageFolder: string = "composite-video"` | Storage folder for video frames |
| `public audioStorageFolder: string = "composite-audio"` | Storage folder for audio chunks |
| `public stitchedOutputFolder: string = "composite-stitched"` | Storage folder for final stitched video |
| `public shareToSpotlight: boolean = false` | Enable sharing to Snapchat Spotlight after video is stitched |
| `public captionInput: TextInputField` | Text input field for Spotlight caption |
| `public defaultCaption: string = "Captured with Glasses ✨"` | Default caption for Spotlight post (used if no input provided) |
| `public useVerticalCrop: boolean = false` | Default value for 9:16 vertical crop (can be toggled via Switch) |
| `public verticalCropSwitch: Switch` | Switch to toggle 9:16 vertical crop for Spotlight/Reels format |
| `@hint( "Image format for captured frames.\n\n⚡ JPG: Faster encoding, smaller files, recommended for smooth recording.\n\nPNG: Lossless quality but CPU INTENSIVE - may cause stuttering during recording!" ) @widget(new ComboBoxWidget([new ComboBoxItem("JPG (Recommended)", 0), new ComboBoxItem("PNG (CPU Intensive!)", 1)])) public imageFormat: number = 0` | Inspector reference/value used by the behavior described above. |
| `@widget(new SliderWidget(1, 100, 1)) public frameQuality: number = 70` | Video frame quality (1-100, higher = better quality). Only affects JPG format. |
| `@widget(new SliderWidget(1, 30, 1)) public frameRate: number = 30` | Frames per second for video capture |
| `@widget(new SliderWidget(5, 120, 5)) public maxRecordingDuration: number = 30` | Maximum recording duration in seconds |
| `public cameraService: CameraService` | Reference to CameraService (RECOMMENDED). Uses its camera to avoid multiple camera requests. |
| `public useCompositeTexture: boolean = false` | Default value for composite mode (can be toggled via Switch) |
| `public compositeTexture: Texture` | Pre-composed texture (with AR content) - used when useCompositeTexture is enabled |
| `public microphoneAsset: AudioTrackAsset` | Microphone audio track asset for recording |
| `@widget(new SliderWidget(8000, 48000, 1000)) public sampleRate: number = 44100` | Audio sample rate (Hz) |
| `@widget(new SliderWidget(50, 1000, 50)) public chunkDurationMs: number = 100` | Audio chunk size in milliseconds |
| `public recordButton: RectangleButton` | Button to start/stop composite recording |
| `public compositeSwitch: Switch` | Switch to toggle between camera and composite capture mode |
| `public statusText: Text` | Text component to display recording status |
| `public buttonText: Text` | Text component to display button state |
| `public previewImage: Image` | Image component to show camera preview |
| `public enableDebugLogs: boolean = true` | Enable detailed debug logging |
| `enableLogging: boolean = false;` | Enable general logging (animation cycles, events, etc.) |
| `enableLoggingLifecycle: boolean = false;` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

### Public members

Signatures are reference fragments, not standalone runnable scripts. Lifecycle methods should not be invoked repeatedly. No custom exported component event emitter is declared.

| Member | Contract / source description |
|---|---|
| `onAwake(): void` | Called when component is initialized |


## CompositeStreamingController

Import path: `SnapCloudExamples.lspkg/Example5-Media/Scripts/CompositeStreamingController`. Source: [`Example5-Media/Scripts/CompositeStreamingController.ts`](../Example5-Media/Scripts/CompositeStreamingController.ts).

Authenticates through SupabaseAuthUtility, initializes shared/fallback camera and audio, subscribes realtime, sends composite-stream-init/started/ended, composite-video-frame JPEG and composite-audio-chunk PCM16 WAV. request-higher/lower-quality changes quality threshold; mute-audio only logs and is not implemented. No public start/stop methods. Matching receiver: `ExternalServicesExamples/media-example-web-viewers/composite-stream-viewer.html` (not verified end to end).

### Inspector inputs

A missing initializer means no source default: assign the required reference; only `@allowUndefined`/`?` inputs explicitly allow absence. Types/defaults are literal source declarations. Meanings are authored hints; behavior qualifications above take precedence.

| Input declaration / default | Meaning |
|---|---|
| `public snapCloudRequirements: SnapCloudRequirements` | Reference to SnapCloudRequirements for centralized Supabase configuration |
| `public streamingChannelName: string = "composite-live-stream"` | Supabase Realtime channel name for composite streaming |
| `@widget(new SliderWidget(1, 100, 1)) public streamQuality: number = 40` | Stream quality (lower = better performance, higher = better quality) |
| `@widget(new SliderWidget(1, 30, 1)) public streamFPS: number = 30` | Frames per second for video streaming |
| `@widget(new SliderWidget(0.1, 1.0, 0.1)) public resolutionScale: number = 0.6` | Stream resolution scale (0.5 = half resolution) |
| `public cameraService: CameraService` | Reference to CameraService (RECOMMENDED). Uses its camera to avoid multiple camera requests. |
| `public useCompositeTexture: boolean = false` | Default value for composite mode (can be toggled via Switch) |
| `public compositeTexture: Texture` | Pre-composed texture (with AR content) - used when useCompositeTexture is enabled |
| `public microphoneAsset: AudioTrackAsset` | Microphone audio track asset for streaming |
| `@widget(new SliderWidget(8000, 48000, 1000)) public sampleRate: number = 16000` | Audio quality (samples per second) |
| `@widget(new SliderWidget(50, 500, 50)) public chunkSizeMs: number = 100` | Audio chunk size (milliseconds) |
| `@widget(new SliderWidget(0, 9, 1)) public compressionLevel: number = 3` | Audio compression level (0-9, higher = more compression) |
| `public streamButton: RectangleButton` | Button to start/stop composite streaming |
| `public compositeSwitch: Switch` | Switch to toggle between camera and composite streaming mode |
| `public statusText: Text` | Text component to display streaming status |
| `public buttonText: Text` | Text component to display button state |
| `public previewImage: Image` | Image component to show local preview |
| `public enableDebugLogs: boolean = true` | Enable detailed debug logging |
| `enableLogging: boolean = false;` | Enable general logging (animation cycles, events, etc.) |
| `enableLoggingLifecycle: boolean = false;` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

### Public members

Signatures are reference fragments, not standalone runnable scripts. Lifecycle methods should not be invoked repeatedly. No custom exported component event emitter is declared.

| Member | Contract / source description |
|---|---|
| `onAwake(): void` | Engine lifecycle hook; see lifecycle behavior above. |


## ImageCaptureUploader

Import path: `SnapCloudExamples.lspkg/Example5-Media/Scripts/ImageCaptureUploader`. Source: [`Example5-Media/Scripts/ImageCaptureUploader.ts`](../Example5-Media/Scripts/ImageCaptureUploader.ts).

Binds capture/still buttons, composite Switch and starts authentication/camera initialization. Camera capture encodes JPEG, still capture uses CameraModule image frame; uploads to images/<unique>.jpg with upsert. Composite source is accepted only when a texture is assigned; setUseCompositeTexture updates selection and UI. Public isUsingCompositeTexture is flag && texture. Authentication retries/readiness waits are implementation details, not public methods.

### Inspector inputs

A missing initializer means no source default: assign the required reference; only `@allowUndefined`/`?` inputs explicitly allow absence. Types/defaults are literal source declarations. Meanings are authored hints; behavior qualifications above take precedence.

| Input declaration / default | Meaning |
|---|---|
| `public snapCloudRequirements: SnapCloudRequirements` | Reference to SnapCloudRequirements for centralized Supabase configuration |
| `public storageBucket: string = "specs-bucket"` | Supabase Storage bucket name for images |
| `public cameraService: CameraService` | Reference to CameraService (RECOMMENDED). Uses its camera to avoid multiple camera requests. |
| `@widget(new SliderWidget(1, 100, 1)) public imageQuality: number = 85` | Image quality for JPEG compression (0-100) |
| `public useCompositeTexture: boolean = false` | Default value for composite mode (can be toggled via Switch) |
| `public compositeTexture: Texture` | Pre-composed texture (with AR content) - used when useCompositeTexture is enabled |
| `public captureButton: RectangleButton` | Button to capture image (texture-based) |
| `public stillCaptureButton: RectangleButton` | Button to capture high-quality still image (Camera Module API) |
| `public compositeSwitch: Switch` | Switch to toggle between camera and composite capture mode |
| `public statusText: Text` | Text component to display status |
| `public previewImage: Image` | Image component to display captured frame preview |
| `public enableDebugLogs: boolean = true` | Enable detailed debug logging |
| `enableLogging: boolean = false;` | Enable general logging (animation cycles, events, etc.) |
| `enableLoggingLifecycle: boolean = false;` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

### Public members

Signatures are reference fragments, not standalone runnable scripts. Lifecycle methods should not be invoked repeatedly. No custom exported component event emitter is declared.

| Member | Contract / source description |
|---|---|
| `onAwake(): void` | Engine lifecycle hook; see lifecycle behavior above. |
| `public setUseCompositeTexture(useComposite: boolean)` | Switch between camera and composite texture modes |
| `public isUsingCompositeTexture(): boolean` | Get current capture mode |


## SnapCloudRequirements

Deprecated import path: `SnapCloudExamples.lspkg/Example5-Media/Scripts/SnapCloudRequirements` now re-exports the package-root class (`SnapCloudExamples.lspkg/SnapCloudRequirements`, see [Core components](components.md#snapcloudrequirements)); it is no longer a separate component. The media scripts import the root class and are wired to the prefab's single `[SnapCloudRequirements]`. The members below are those of the root class.

Caches presence of SupabaseProject on Awake/revalidate. Missing configuration can show the setup Text; configured Start hides that Text. URL helpers trim a trailing slash and append storage/public, rest or functions paths. Header helper uses publicToken as apikey and Bearer, not the signed-in session. Missing asset gives empty strings/headers; getSupabaseProject can be undefined despite its declared return type. setDebugLogging changes its flag but general logging uses enableLogging/enableLoggingLifecycle.

### Inspector inputs

A missing initializer means no source default: assign the required reference; only `@allowUndefined`/`?` inputs explicitly allow absence. Types/defaults are literal source declarations. Meanings are authored hints; behavior qualifications above take precedence.

| Input declaration / default | Meaning |
|---|---|
| `public supabaseProject: SupabaseProject` | SupabaseProject asset from Asset Browser (created via Supabase Plugin) |
| `public text: Text` | Text component to display warning messages (optional) |
| `public disableWarningsWhenConfigured: boolean = true` | Disable warnings when requirements are properly set (auto-detected) |
| `public showSetupInstructions: boolean = true` | Show detailed setup instructions in console |
| `public enableDebugLogs: boolean = true` | Enable debug logging |
| `enableLogging: boolean = false` | Enable general logging (animation cycles, events, etc.) |
| `enableLoggingLifecycle: boolean = false` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

### Public members

Signatures are reference fragments, not standalone runnable scripts. Lifecycle methods should not be invoked repeatedly. No custom exported component event emitter is declared.

| Member | Contract / source description |
|---|---|
| `onAwake(): void` | Called when component is initialized |
| `onStart()` | Engine lifecycle hook; see lifecycle behavior above. |
| `public getSupabaseProject(): SupabaseProject` | PUBLIC API - Get Supabase Project Other scripts can call this to get the configured Supabase Project |
| `public isConfigured(): boolean` | PUBLIC API - Check if all requirements are configured |
| `public getSupabaseUrl(): string` | PUBLIC API - Get Supabase URL Convenience method to get the Supabase project URL |
| `public getSupabasePublicToken(): string` | PUBLIC API - Get Supabase Public Token Convenience method to get the Supabase public API token |
| `public getSupabaseHeaders(): {[key: string]: string}` | PUBLIC API - Get HTTP headers for Supabase requests Convenience method to get pre-configured headers |
| `public getStorageApiUrl(): string` | PUBLIC API - Get Storage API URL Convenience method to get the Supabase Storage base URL |
| `public getRestApiUrl(): string` | PUBLIC API - Get REST API URL Convenience method to get the Supabase REST API base URL |
| `public getFunctionsApiUrl(): string` | PUBLIC API - Get Functions API URL Convenience method to get the Supabase Edge Functions base URL |
| `public setDebugLogging(enabled: boolean): void` | PUBLIC API - Enable Disable debug logging at runtime |
| `public revalidate(): void` | PUBLIC API - Manually trigger validation Useful if configuration is set programmatically |


## UISectionManager

Import path: `SnapCloudExamples.lspkg/Example5-Media/Scripts/UISectionManager`. Source: [`Example5-Media/Scripts/UISectionManager.ts`](../Example5-Media/Scripts/UISectionManager.ts).

Requires ToggleGroup and nonempty uiSections at Awake; hides all then activates default index. Toggle names map Image/Video/Audio/Composite/Sharing (or Value0–4), else first numeric name. switchToSectionManually/selectToggle activate section but selectToggle does not update ToggleGroup selection. Out-of-range index logs and preserves current section; getActiveSectionIndex returns first enabled or -1.

### Inspector inputs

A missing initializer means no source default: assign the required reference; only `@allowUndefined`/`?` inputs explicitly allow absence. Types/defaults are literal source declarations. Meanings are authored hints; behavior qualifications above take precedence.

| Input declaration / default | Meaning |
|---|---|
| `public toggleGroup: ToggleGroup` | ToggleGroup component that controls the section switching |
| `public uiSections: SceneObject[]` | Array of SceneObjects representing the UI sections (index matches toggle index) |
| `@widget(new SliderWidget(-1, 10, 1)) public defaultSectionIndex: number = 0` | Index of the default section to show on start (-1 for none) |
| `public enableDebugLogs: boolean = true` | Enable debug logging |
| `enableLogging: boolean = false;` | Enable general logging (animation cycles, events, etc.) |
| `enableLoggingLifecycle: boolean = false;` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

### Public members

Signatures are reference fragments, not standalone runnable scripts. Lifecycle methods should not be invoked repeatedly. No custom exported component event emitter is declared.

| Member | Contract / source description |
|---|---|
| `onAwake(): void` | Engine lifecycle hook; see lifecycle behavior above. |
| `public switchToSectionManually(sectionIndex: number)` | Public method to manually switch to a section (for external scripts) |
| `public getActiveSectionIndex(): number` | Public method to get the currently active section index |
| `public selectToggle(toggleIndex: number)` | Public method to manually switch to a section without using toggles |
| `public debugLogSections()` | Debug: Log all sections and their current state |


## VideoCaptureUploader

Import path: `SnapCloudExamples.lspkg/Example5-Media/Scripts/VideoCaptureUploader`. Source: [`Example5-Media/Scripts/VideoCaptureUploader.ts`](../Example5-Media/Scripts/VideoCaptureUploader.ts).

Button toggles recording, captures/encodes queued JPEG frames, then on stop converts/uploads sequentially to frames/<session>/frame_<index>.jpg (its own uploader; the `video-frames` default belongs to CaptureUtilities' uploadFrameToStorage, used by CompositeCaptureUploader). captureFrameRate=0 means maximum available frame rate, not disabled. Blocks another record during upload; max duration stops a session. No public start/stop method. Capture FPS/quality do not guarantee device throughput.

### Inspector inputs

A missing initializer means no source default: assign the required reference; only `@allowUndefined`/`?` inputs explicitly allow absence. Types/defaults are literal source declarations. Meanings are authored hints; behavior qualifications above take precedence.

| Input declaration / default | Meaning |
|---|---|
| `public snapCloudRequirements: SnapCloudRequirements` | Reference to SnapCloudRequirements for centralized Supabase configuration |
| `public storageBucket: string = "specs-bucket"` | Supabase Storage bucket name for video frames |
| `public cameraService: CameraService` | Reference to CameraService (RECOMMENDED). Uses its camera to avoid multiple camera requests. |
| `@widget(new SliderWidget(0, 30, 1)) public captureFrameRate: number = 0` | Target FPS for capture. Set to 0 for MAX rate (captures every camera frame via onNewFrame) |
| `public useHighQuality: boolean = false` | JPEG quality (lower = smaller files, faster uploads). Low recommended for video. |
| `@widget(new SliderWidget(1, 60, 1)) public maxRecordingDuration: number = 30` | Maximum recording duration in seconds |
| `public useCompositeTexture: boolean = false` | Default value for composite mode (can be toggled via Switch) |
| `public compositeTexture: Texture` | Pre-composed texture (with AR content) - used when useCompositeTexture is enabled |
| `public recordButton: RectangleButton` | Button to start/stop recording |
| `public compositeSwitch: Switch` | Switch to toggle between camera and composite capture mode |
| `public statusText: Text` | Text component to display status |
| `public buttonText: Text` | Text component to display button state (Start/Stop) |
| `public previewImage: Image` | Image component to display captured frame preview |
| `public enableDebugLogs: boolean = false` | Enable detailed debug logging (disable for better performance) |
| `enableLogging: boolean = false;` | Enable general logging (animation cycles, events, etc.) |
| `enableLoggingLifecycle: boolean = false;` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

### Public members

Signatures are reference fragments, not standalone runnable scripts. Lifecycle methods should not be invoked repeatedly. No custom exported component event emitter is declared.

| Member | Contract / source description |
|---|---|
| `onAwake(): void` | Engine lifecycle hook; see lifecycle behavior above. |


## VideoStreamingController

Import path: `SnapCloudExamples.lspkg/Example5-Media/Scripts/VideoStreamingController`. Source: [`Example5-Media/Scripts/VideoStreamingController.ts`](../Example5-Media/Scripts/VideoStreamingController.ts).

Initializes auth, camera and realtime channel. Button starts/stops; video-frame carries sessionId/frameNumber/timestamp/frameData Base64 JPEG and metadata. Events stream-init/started/ended accompany frames; incoming viewer-joined/viewer-left/stream-control affect status/control. Composite buffering delays delivery by configured seconds. Matching receiver: `ExternalServicesExamples/media-example-web-viewers/video-stream-viewer.html`; resolutionScale is metadata and must not be treated as evidence of actual pixel resizing.

### Inspector inputs

A missing initializer means no source default: assign the required reference; only `@allowUndefined`/`?` inputs explicitly allow absence. Types/defaults are literal source declarations. Meanings are authored hints; behavior qualifications above take precedence.

| Input declaration / default | Meaning |
|---|---|
| `public snapCloudRequirements: SnapCloudRequirements` | Reference to SnapCloudRequirements for centralized Supabase configuration |
| `public streamingChannelName: string = "live-video-stream"` | Supabase Realtime channel name for live streaming |
| `@widget(new SliderWidget(1, 100, 1)) public streamQuality: number = 15` | Stream quality (lower = better performance, higher = better quality) - Keep LOW for Realtime 250KB limit |
| `@widget(new SliderWidget(1, 30, 1)) public streamFPS: number = 30` | Frames per second for live streaming (lower = less bandwidth) |
| `@widget(new SliderWidget(0.1, 1.0, 0.1)) public resolutionScale: number = 0.3` | Stream resolution scale - Keep LOW for Realtime 250KB limit (0.3 = 30% resolution) |
| `@widget(new SliderWidget(1, 30, 1)) public compositeBufferDelay: number = 5` | Buffer delay in seconds for composite mode - frames are captured, buffered, then sent after this delay |
| `public cameraService: CameraService` | Reference to CameraService (RECOMMENDED). Uses its camera to avoid multiple camera requests. |
| `public useCompositeTexture: boolean = false` | Default value for composite mode (can be toggled via Switch) |
| `public compositeTexture: Texture` | Pre-composed texture (with AR content) - used when useCompositeTexture is enabled |
| `public streamButton: RectangleButton` | Button to start/stop streaming |
| `public compositeSwitch: Switch` | Switch to toggle between camera and composite streaming mode |
| `public statusText: Text` | Text component to display streaming status |
| `public buttonText: Text` | Text component to display button state (Start Stream/Stop Stream) |
| `public previewImage: Image` | Image component to show local preview |
| `public textLog: Text` | On-device debug log display |
| `public enableDebugLogs: boolean = true` | Enable detailed debug logging |
| `enableLogging: boolean = false;` | Enable general logging (animation cycles, events, etc.) |
| `enableLoggingLifecycle: boolean = false;` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

### Public members

Signatures are reference fragments, not standalone runnable scripts. Lifecycle methods should not be invoked repeatedly. No custom exported component event emitter is declared.

| Member | Contract / source description |
|---|---|
| `onAwake(): void` | Engine lifecycle hook; see lifecycle behavior above. |
