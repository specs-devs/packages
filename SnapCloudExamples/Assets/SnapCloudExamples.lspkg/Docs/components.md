# SnapCloudExamples core components

[← Agent usage index](../README.md)

## Use when

Read when wiring root configuration and examples 1–4, or the demo scaffolding (guide + carousel) shipped in `Example/`.

## BasicAuth

Import path: `SnapCloudExamples.lspkg/Example1-AuthAndTables/BasicAuth`. Source: [`Example1-AuthAndTables/BasicAuth.ts`](../Example1-AuthAndTables/BasicAuth.ts).

On Start reads the project from `snapCloudRequirements` (or, when that isn't wired, the deprecated `supabaseProject` input), creates a client with realtime heartbeatIntervalMs=2500 and signs in with provider snapchat/token empty using the Lens adapter. Without a project it prints a setup hint and stops. onDestroy removes channels. Logging exposes user/session information (including a token prefix); avoid enabling/sharing credential-bearing logs.

### Inspector inputs

A missing initializer means no source default: assign the required reference; only `@allowUndefined`/`?` inputs explicitly allow absence. Types/defaults are literal source declarations. Meanings are authored hints; behavior qualifications above take precedence.

| Input declaration / default | Meaning |
|---|---|
| `snapCloudRequirements: SnapCloudRequirements` (`@allowUndefined`) | SnapCloudRequirements component holding the Supabase project |
| `supabaseProject: SupabaseProject` (`@allowUndefined`) | Deprecated: use snapCloudRequirements. Only read when snapCloudRequirements isn't wired. |

### Public members

Signatures are reference fragments, not standalone runnable scripts. Lifecycle methods should not be invoked repeatedly. No custom exported component event emitter is declared.

| Member | Contract / source description |
|---|---|
| `onAwake()` | Engine lifecycle hook; see lifecycle behavior above. |
| `onStart()` | Engine lifecycle hook; see lifecycle behavior above. |
| `async initSupabase()` | See component behavior above; signature is the exact callable surface. |
| `async signInUser()` | See component behavior above; signature is the exact callable surface. |
| `onDestroy()` | Engine lifecycle hook; see lifecycle behavior above. |


## TableConnector

Import path: `SnapCloudExamples.lspkg/Example1-AuthAndTables/TableConnector`. Source: [`Example1-AuthAndTables/TableConnector.ts`](../Example1-AuthAndTables/TableConnector.ts).

On Start checks requirements then creates/authenticates client (2500ms heartbeat). testConnectionAndRun guards uid; testConnection selects test_table, sets connected, inserts a test record, reads records, and tests other tables including inserts. Generic CRUD returns {data,error} without throwing on result.error. getUserPreferences returns first result or null. retrieveLatestData reads limited batches from test_table/user_interactions/user_preferences without date ordering despite its name. clearLogs/getLogMessages manage the display buffer; manualDataRetrieval forwards to retrieval. Cleanup is an exported onDestroy method, not proof that it is bound to an engine event.

### Inspector inputs

A missing initializer means no source default: assign the required reference; only `@allowUndefined`/`?` inputs explicitly allow absence. Types/defaults are literal source declarations. Meanings are authored hints; behavior qualifications above take precedence.

| Input declaration / default | Meaning |
|---|---|
| `public snapCloudRequirements: SnapCloudRequirements` | Reference to SnapCloudRequirements for centralized Supabase configuration |
| `public dataRetrievalButton: RectangleButton` | Optional: RectangleButton to trigger data retrieval (UIKit) |
| `public logText: Text` | Optional: Text component to display logs on device |
| `enableLogging: boolean = false;` | Enable general logging (animation cycles, events, etc.) |
| `enableLoggingLifecycle: boolean = false;` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

### Public members

Signatures are reference fragments, not standalone runnable scripts. Lifecycle methods should not be invoked repeatedly. No custom exported component event emitter is declared.

| Member | Contract / source description |
|---|---|
| `onAwake(): void` | Engine lifecycle hook; see lifecycle behavior above. |
| `onStart()` | Engine lifecycle hook; see lifecycle behavior above. |
| `async initSupabase()` | See component behavior above; signature is the exact callable surface. |
| `async signInUser()` | See component behavior above; signature is the exact callable surface. |
| `async testConnectionAndRun()` | See component behavior above; signature is the exact callable surface. |
| `onDestroy()` | Engine lifecycle hook; see lifecycle behavior above. |
| `public clearLogs()` | Clear the log display |
| `public async testConnection()` | Test the connection to Supabase |
| `public async testAllTables()` | Test all tables to verify they exist and are accessible |
| `public async testOtherTableInserts()` | Test inserting data into other tables |
| `public async insertTestRecord()` | Insert a test record to verify database write access |
| `public async getAllRecords()` | Retrieve all records from the test table |
| `public async insertIntoTable(table: string, data: any)` | Generic method to insert data into any table |
| `public async selectFromTable(table: string, columns: string = "*")` | Generic method to select data from any table |
| `public async updateTable(table: string, data: any, matchColumn: string, matchValue: any)` | Generic method to update data in any table  |
| `public async deleteFromTable(table: string, matchColumn: string, matchValue: any)` | Generic method to delete data from any table  |
| `public async logUserInteraction(action: string, data: any = {})` | Example: Log user interaction for analytics |
| `public async getUserPreferences(userId: string): Promise<any>` | Example: Get user preferences |
| `public async retrieveLatestData()` | Retrieve and display latest data from all tables (triggered by button pinch) |
| `public isSupabaseConnected(): boolean` | Public methods for external scripts to use |
| `public getClient(): any` | See component behavior above; signature is the exact callable surface. |
| `public getUserId(): string` | See component behavior above; signature is the exact callable surface. |
| `public async manualDataRetrieval()` | Public method to manually trigger data retrieval |
| `public getLogMessages(): string` | Get current log messages as a string |


## RealtimeCursor

Import path: `SnapCloudExamples.lspkg/Example2-RealTime/RealtimeCursor`. Source: [`Example2-RealTime/RealtimeCursor.ts`](../Example2-RealTime/RealtimeCursor.ts).

Enables `cursorObject` on Awake and on enable, disables it on disable (the cursor ships disabled in the prefab). Initializes/authenticates on Start, subscribes cursor-${channelName}, starts broadcast mode. onTriggerUp toggles local broadcast/follow. Follow accepts cursor-move only when payload.user_id starts pc_. Broadcast sends x/y in 0–100 coordinates with user/channel/color/timestamp and periodically inserts cursor_debug (every 50 broadcasts). isServiceInitialized means local initialization, not successful SUBSCRIBED state. Coordinate/perspective scales and inversion are authored mappings, not screen-space engine APIs.

### Inspector inputs

A missing initializer means no source default: assign the required reference; only `@allowUndefined`/`?` inputs explicitly allow absence. Types/defaults are literal source declarations. Meanings are authored hints; behavior qualifications above take precedence.

| Input declaration / default | Meaning |
|---|---|
| `public snapCloudRequirements: SnapCloudRequirements` | Reference to SnapCloudRequirements for centralized Supabase configuration |
| `public channelName: string = "[Insert your channel name]"` | Channel name for cursor synchronization |
| `public toggleModeButton: RectangleButton` | RectangleButton to toggle between broadcast and follow modes (UIKit) |
| `public cursorObject: SceneObject` | The cursor object to track (broadcast) or move (follow) |
| `public modeText: Text` | Text component to display current mode |
| `public statusText: SceneObject` | Text component to display detailed status and logs |
| `@widget(new SliderWidget(0.05, 1.0, 0.05)) public broadcastInterval: number = 0.1` | Broadcast interval in seconds (when in broadcast mode) |
| `@widget(new SliderWidget(0.05, 1.0, 0.1)) public movementSpeed: number = 0.15` | Movement speed/smoothing factor (when in follow mode) |
| `@widget(new SliderWidget(0.1, 50, 0.1)) public movementScale: number = 1.5` | Movement scale factor (when in follow mode) |
| `@widget(new SliderWidget(-200, 10.0, 1)) public cursorZPosition: number = -100` | Z position for cursor (when in follow mode) - negative is away from camera |
| `@widget(new SliderWidget(-2.0, 2.0, 0.1)) public heightOffset: number = 0.0` | Height offset for the cursor object (when in follow mode) |
| `@widget(new SliderWidget(10, 200, 1)) public lsXRange: number = 50` | Lens Studio X coordinate range (from -lsXRange to +lsXRange) |
| `@widget(new SliderWidget(10, 200, 1)) public lsYRange: number = 30` | Lens Studio Y coordinate range (from -lsYRange to +lsYRange) |
| `@widget(new SliderWidget(0.1, 50.0, 0.1)) public coordinateScale: number = 10.0` | Scale factor for coordinate conversion (broadcast mode) |
| `@widget(new SliderWidget(0.1, 20.0, 0.1)) public perspectiveScale: number = 10.0` | Perspective scaling factor (broadcast mode) |
| `public invertX: boolean = false` | Invert X axis mapping |
| `public invertY: boolean = false` | Invert Y axis mapping |
| `public enableDebugLogs: boolean = true` | Show debug information in console |
| `public verboseLogging: boolean = false` | Show coordinate values in every broadcast log |
| `@widget(new SliderWidget(1, 100, 1)) public logFrequency: number = 10` | Log broadcast frequency (every N broadcasts) |
| `enableLogging: boolean = false;` | Enable general logging (animation cycles, events, etc.) |
| `enableLoggingLifecycle: boolean = false;` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

### Public members

Signatures are reference fragments, not standalone runnable scripts. Lifecycle methods should not be invoked repeatedly. No custom exported component event emitter is declared.

| Member | Contract / source description |
|---|---|
| `onAwake(): void` | Engine lifecycle hook; see lifecycle behavior above. |
| `public isServiceInitialized(): boolean` | Public getters |
| `public getChannelName(): string` | See component behavior above; signature is the exact callable surface. |
| `public getCurrentMode(): string` | See component behavior above; signature is the exact callable surface. |


## StorageLoader

Import path: `SnapCloudExamples.lspkg/Example3-Storage/StorageLoader`. Source: [`Example3-Storage/StorageLoader.ts`](../Example3-Storage/StorageLoader.ts).

Awake builds public storage URL/configures RemoteMedia and button. loadAllAssets guards configuration/internet/concurrent load, launches configured glTF/image/audio loads, records successes and tolerates per-resource failures. Model uses convertMetersToCentimeters and instantiates under script object (modelParent input is not the instantiation parent). testAssetUrls makes six GETs including alternative host guesses. clearLoadedAssets destroys model/stops audio but only clears texture bookkeeping; it does not clear the Image material texture. getLoadedAssets returns shallow state copy.

### Inspector inputs

A missing initializer means no source default: assign the required reference; only `@allowUndefined`/`?` inputs explicitly allow absence. Types/defaults are literal source declarations. Meanings are authored hints; behavior qualifications above take precedence.

| Input declaration / default | Meaning |
|---|---|
| `public snapCloudRequirements: SnapCloudRequirements` | Reference to SnapCloudRequirements for centralized Supabase configuration |
| `public storageBucket: string = "[Insert your bucket name]"` | Supabase Storage bucket name where assets are stored |
| `public modelFileName: string = "fox/scene.gltf"` | 3D model filename in storage (e.g., 'fox/scene.gltf') |
| `public imageFileName: string = "images/spectacles.jpg"` | Image filename in storage (e.g., 'images/spectacles.jpg') |
| `public audioFileName: string = "audio/chill.mp3"` | Audio filename in storage (e.g., 'audio/chill.mp3') |
| `public cameraObject: SceneObject` | Camera object to use for positioning models in front of camera |
| `public modelParent: SceneObject` | Parent scene object for the loaded 3D model |
| `public imageDisplay: Image` | Image component to display the loaded texture |
| `public audioPlayer: SceneObject` | Scene object with AudioComponent to play the loaded audio |
| `public defaultMaterial: Material` | Material to use for instantiated 3D models |
| `public loadButton: RectangleButton` | RectangleButton to trigger asset loading (UIKit) |
| `public enableProgressLogs: boolean = true` | Show loading progress in console |
| `public enableDebugLogs: boolean = true` | Enable detailed debug logging |
| `@widget(new SliderWidget(50, 300, 10)) public modelDistance: number = 100` | Distance in front of camera to place model (in cm) |
| `@widget(new SliderWidget(0.1, 5.0, 0.1)) public modelScale: number = 1.0` | Scale factor for loaded models |
| `public statusText: Text` | Text component to display loading status (optional) |
| `enableLogging: boolean = false;` | Enable general logging (animation cycles, events, etc.) |
| `enableLoggingLifecycle: boolean = false;` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

### Public members

Signatures are reference fragments, not standalone runnable scripts. Lifecycle methods should not be invoked repeatedly. No custom exported component event emitter is declared.

| Member | Contract / source description |
|---|---|
| `onAwake(): void` | Engine lifecycle hook; see lifecycle behavior above. |
| `public async loadAllAssets()` | Load all assets (3D model, image, and audio) |
| `public async testAssetUrls()` | Test asset URLs accessibility |
| `public clearLoadedAssets()` | Clear all loaded assets |
| `public getLoadingStatus(): string` | Get loading status |
| `public isServiceInitialized(): boolean` | Public getters |
| `public getStorageBucket(): string` | See component behavior above; signature is the exact callable surface. |
| `public getLoadedAssets()` | See component behavior above; signature is the exact callable surface. |


## EdgeFunctionImgProcessing

Import path: `SnapCloudExamples.lspkg/Example4-EdgeFunctions/EdgeFunctionImgProcessing`. Source: [`Example4-EdgeFunctions/EdgeFunctionImgProcessing.ts`](../Example4-EdgeFunctions/EdgeFunctionImgProcessing.ts).

Button onTriggerUp or public callFunction posts JSON {imageUrl} using performHttpRequest and public-token headers. HTTP200 result must contain success and processedUrl; operations is read with .join and size/storagePath are logged. Downloads processedUrl as an image. callFunctionWithImageUrl mutates imageUrl then triggers same flow. Awake validation only logs missing config/function name; later calls do not maintain a separate ready guard.

### Inspector inputs

A missing initializer means no source default: assign the required reference; only `@allowUndefined`/`?` inputs explicitly allow absence. Types/defaults are literal source declarations. Meanings are authored hints; behavior qualifications above take precedence.

| Input declaration / default | Meaning |
|---|---|
| `public snapCloudRequirements: SnapCloudRequirements` | Reference to SnapCloudRequirements for centralized Supabase configuration |
| `public functionName: string = "[your-function-name]"` | Edge Function name (will use SnapCloudRequirements to build full URL) |
| `public imageUrl: string = "[Insert your Supabase storage URL]/storage/v1/object/public/[bucket-name]/[path-to-image]"` | Image URL from your Supabase Storage to process |
| `public outputImage: Image` | Output image component to display processed result |
| `public processButton: RectangleButton` | RectangleButton to trigger Edge Function call (UIKit) |
| `public enableDebugLogs: boolean = true` | Enable debug logging |
| `enableLogging: boolean = false;` | Enable general logging (animation cycles, events, etc.) |
| `enableLoggingLifecycle: boolean = false;` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

### Public members

Signatures are reference fragments, not standalone runnable scripts. Lifecycle methods should not be invoked repeatedly. No custom exported component event emitter is declared.

| Member | Contract / source description |
|---|---|
| `onAwake(): void` | Engine lifecycle hook; see lifecycle behavior above. |
| `public callFunction()` | Public method to call the function manually |
| `public callFunctionWithImageUrl(imageUrl: string)` | Call function with different image URL |


## SnapCloudRequirements

Import path: `SnapCloudExamples.lspkg/SnapCloudRequirements`. Source: [`SnapCloudRequirements.ts`](../SnapCloudRequirements.ts).

Caches presence of SupabaseProject on Awake/revalidate. Missing configuration can show the setup Text; configured Start hides that Text. URL helpers trim a trailing slash and append storage/public, rest or functions paths. Header helper uses publicToken as apikey and Bearer, not the signed-in session. Missing asset gives empty strings/headers; getSupabaseProject can be undefined despite its declared return type. setDebugLogging changes its flag but general logging uses enableLogging/enableLoggingLifecycle.

### Inspector inputs

A missing initializer means no source default: assign the required reference; only `@allowUndefined`/`?` inputs explicitly allow absence. Types/defaults are literal source declarations. Meanings are authored hints; behavior qualifications above take precedence.

| Input declaration / default | Meaning |
|---|---|
| `public supabaseProject: SupabaseProject` (`@allowUndefined`) | SupabaseProject asset from Asset Browser (created via Supabase Plugin); shipped empty on the prefab |
| `public text: Text` (`@allowUndefined`) | Text component to display warning messages (optional; empty on the prefab) |
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

## Demo scaffolding (`Example/`)

The main prefab carries its own credentials warning, guide and example carousel, so the demo works when only the package is installed. These three scripts are demo scaffolding, not part of the Snap Cloud API. Child order: `[SnapCloudRequirements]`, `CredentialsWarning`, `Guide`, `ExampleCarousel`, then the examples.

### ExampleCarousel

Source: [`Example/ExampleCarousel/ExampleCarousel.ts`](../Example/ExampleCarousel/ExampleCarousel.ts). On the prefab's `ExampleCarousel` child. Builds a UIKit panel with Previous / Next and a minimize button and enables one example (or sub-example step) at a time; the others stay disabled.

| Input declaration / default | Meaning |
|---|---|
| `examples: SceneObject[] = []` | Examples to step through, in order (prefab: Get Started, Media Suite, Global Leaderboard) |
| `exampleInfo: string[] = []` | Info text per example, same order as `examples` |
| `steps: SceneObject[] = []` | Optional sub-examples shown one at a time (prefab: Tables, Realtime Cursor, Storage, Edge Functions, Media Suite, Global Leaderboard) |
| `stepInfo: string[] = []` | Info text per step, same order as `steps`; empty entries fall back to the step's example info (prefab: empty) |
| `startIndex: number = 0` | Example shown first (0-based) |
| `previousLabel: string = "Previous"` / `nextLabel: string = "Next"` | Button labels |
| `examplesPushBack: number = 20` | Extra distance (cm) the examples are pushed behind the carousel |
| `anchorExamples: boolean = true` | Move the examples in front of the user's head pose |
| `startMinimized: boolean = false` | Start collapsed to the title bar |
| `extraPanelDrop: number = 0` | Extra drop (cm) of the panel below its usual spot |

### CredentialsWarning

Source: [`Example/CredentialsWarning/CredentialsWarning.ts`](../Example/CredentialsWarning/CredentialsWarning.ts). On the prefab's `CredentialsWarning` child, between `[SnapCloudRequirements]` and `Guide`. On awake it checks the credentials; if any is missing it prints one `CredentialsWarning: …` line each, holds the guide (and what the guide hides), and builds a red-framed UIKit Frame listing what's missing with a "Continue without credentials" button that closes it and releases the guide. Everything set: it disables itself and the guide shows as usual.

| Input declaration / default | Meaning |
|---|---|
| `guide: SceneObject` | The guide shown after this warning (prefab: `Guide`) |
| `snapCloudRequirements: ScriptComponent` (`@allowUndefined`) | SnapCloudRequirements to check (prefab: `[SnapCloudRequirements]`); empty = Snap Cloud not checked |
| `rsgCredentials: ScriptComponent` (`@allowUndefined`) | RemoteServiceGatewayCredentials to check; empty in this package (no example uses RSG) |
| `requireSnapToken` / `requireOpenAIToken` / `requireGoogleToken: boolean = false` | Which RSG tokens the examples need (all false here) |
| `buttonLabel: string = "Continue without credentials"` | Close-button label |

`public findMissing(): string[]` returns the missing-credential lines.

### GuideDismissPanel

Source: [`Example/GuideDismissPanel/GuideDismissPanel.ts`](../Example/GuideDismissPanel/GuideDismissPanel.ts). On the prefab's `Guide` child (next to a UIKit Frame, with a child Text and the "Ok, I understood" button). Places the guide in front of the user and closes it when the button is pressed.

| Input declaration / default | Meaning |
|---|---|
| `buttonLabel: string = "Ok, I understood"` | Close-button label (only used when the panel is built at runtime) |
| `hideUntilDismissed: SceneObject[] = []` | Objects hidden while the guide shows (prefab: the three examples and `ExampleCarousel`; never the prefab root) |
