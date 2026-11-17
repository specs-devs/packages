# AnchorExamples components and API

[← Agent usage index](../README.md)

## Use when

Wire components or locate helper API signatures in the exact source layout.

The paths below are relative to `AnchorExamples.lspkg/`. `Scripts/AnchorController` and `Scripts/Logger` are reusable helpers. `Examples/` implements the supplied demo; prefer its wired prefab rather than manually reconstructing inputs. Lifecycle methods are engine callbacks. Input values without an initializer require host wiring or remain undefined.

AppController requires `rootContainer`, `widgetParent`, `worldQueryModule`; `camera` is optional and falls back to SIK WorldCameraFinderProvider. Widget prefabs are optional inputs but each missing prefab prevents that widget from spawning. Logging inputs default false. NoteWidget binds text events on OnStart; submitted text emits content changes.

## CaptureFlowManager

Import suffix under `AnchorExamples.lspkg/`: `Examples/Anchors/CaptureFlowManager`

Public surface (signature starts; multiline arguments remain defined in source):

```text
readonly onCaptureComplete: PublicApi<void> = this.onCaptureCompleteEvent.publicApi()
readonly onCaptureTimeout: PublicApi<void> = this.onCaptureTimeoutEvent.publicApi()
readonly onStateChanged: PublicApi<CaptureState> = this.onStateChangedEvent.publicApi()
readonly onMappingProgress: PublicApi<{quality?: number, capacityUsed?: number}> = this.onMappingProgressEvent.publicApi()
static getInstance(): CaptureFlowManager
get currentState(): CaptureState
get capturedAnchor(): Anchor | null
async prepareSession(areaId: string): Promise<void>
async startCapture(toWorldFromAnchor: mat4): Promise<void>
stopCapture(): void
async cancelPreparedSession(): Promise<void>
reset(): void
```

## AppController

Import suffix under `AnchorExamples.lspkg/`: `Examples/App/AppController`

Inputs (exact source declarations):

```text
rootContainer: SceneObject
widgetParent: SceneObject
camera: Camera
worldQueryModule: WorldQueryModule
noteWidgetPrefab: ObjectPrefab
watchWidgetPrefab: ObjectPrefab
photoWidgetPrefab: ObjectPrefab
enableLogging: boolean = false
enableLoggingLifecycle: boolean = false
```

Public surface (signature starts; multiline arguments remain defined in source):

```text
onAwake(): void
onDestroy(): void
getLifecycleState(): AppLifecycleState
getCurrentScreen(): AppScreen
getCurrentAreaName(): string | null
```

## Permissions

Import suffix under `AnchorExamples.lspkg/`: `Examples/Permissions`

Public surface (signature starts; multiline arguments remain defined in source):

```text
onAwake()
```

## EventBus

Import suffix under `AnchorExamples.lspkg/`: `Examples/Shared/EventBus`

Public surface (signature starts; multiline arguments remain defined in source):

```text
static getInstance(logger?: Logger): EventBus
on<T = any>(event: string, callback: EventCallback<T>): void
off<T = any>(event: string, callback: EventCallback<T>): void
emit<T = any>(event: string, data?: T): void
removeAllListeners(event?: string): void
```

## TextInputRouter

Import suffix under `AnchorExamples.lspkg/`: `Examples/Shared/TextInputRouter`

Inputs (exact source declarations):

```text
enableLogging: boolean = false
enableLoggingLifecycle: boolean = false
```

Public surface (signature starts; multiline arguments remain defined in source):

```text
readonly onKeyboardStateChanged: PublicApi<boolean>
static getInstance(): TextInputRouter
onAwake(): void
focusWidget(widget: NoteWidget): void
dismissKeyboard(): void
getFocusedWidget(): NoteWidget | null
```

## StorageController

Import suffix under `AnchorExamples.lspkg/`: `Examples/Storage/StorageController`

Public surface (signature starts; multiline arguments remain defined in source):

```text
static getInstance(): StorageController
getAreas(): Record<string, string>
saveArea(name: string, id: string): void
deleteArea(name: string): void
clearAllAreas(): void
getAreaCount(): number
saveAnchorId(areaName: string, anchorId: string): void
loadAnchorId(areaName: string): string | null
clearAnchorId(areaName: string): void
saveWidgets(areaName: string, widgets: WidgetData[]): void
loadWidgets(areaName: string): WidgetData[]
clearWidgets(areaName: string): void
saveAnchorPose(areaName: string, position: vec3, rotation: quat): void
loadAnchorPose(areaName: string): {position: vec3, rotation: quat} | null
```

## AreaGridBuilder

Import suffix under `AnchorExamples.lspkg/`: `Examples/UI/Components/AreaGridBuilder`

Public surface (signature starts; multiline arguments remain defined in source):

```text
constructor(config: AreaGridConfig)
updateAreas(areas: AreaInfo[]): void
setSelected(index: number): void
getContainer(): SceneObject
destroy(): void
```

## SideNavigation

Import suffix under `AnchorExamples.lspkg/`: `Examples/UI/Components/SideNavigation`

Public surface (signature starts; multiline arguments remain defined in source):

```text
constructor(config: SideNavConfig)
setActive(screen: AppScreen): void
getContainer(): SceneObject
destroy(): void
```

## ScreenFactory

Import suffix under `AnchorExamples.lspkg/`: `Examples/UI/ScreenFactory`

Public surface (signature starts; multiline arguments remain defined in source):

```text
constructor(uiController: UIController, eventBus: EventBus, logger: Logger)
buildAllScreens(): void
getGetStartedScreen(): GetStartedScreen
getCaptureScreen(): CaptureScreen
getInCaptureScreen(): InCaptureScreen
getMyAreasScreen(): MyAreasScreen
getInAreaScreen(): InAreaScreen
refreshMyAreas(areas: AreaInfo[]): void
setCaptureStatus(text: string): void
setRecallActive(active: boolean): void
setSnapActive(active: boolean): void
setLocalizationStatus(text: string): void
```

## CaptureScreen

Import suffix under `AnchorExamples.lspkg/`: `Examples/UI/Screens/CaptureScreen`

Public surface (signature starts; multiline arguments remain defined in source):

```text
constructor(parent: SceneObject, eventBus: EventBus, logger: Logger)
show(): void
hide(): void
destroy(): void
getContainer(): SceneObject
```

## GetStartedScreen

Import suffix under `AnchorExamples.lspkg/`: `Examples/UI/Screens/GetStartedScreen`

Public surface (signature starts; multiline arguments remain defined in source):

```text
constructor(parent: SceneObject, eventBus: EventBus, logger: Logger)
show(): void
hide(): void
destroy(): void
getContainer(): SceneObject
```

## InAreaScreen

Import suffix under `AnchorExamples.lspkg/`: `Examples/UI/Screens/InAreaScreen`

Public surface (signature starts; multiline arguments remain defined in source):

```text
constructor(parent: SceneObject, eventBus: EventBus, logger: Logger)
show(): void
hide(): void
destroy(): void
getContainer(): SceneObject
setRecallActive(active: boolean): void
setSnapActive(active: boolean): void
setLocalizationStatus(text: string): void
```

## InCaptureScreen

Import suffix under `AnchorExamples.lspkg/`: `Examples/UI/Screens/InCaptureScreen`

Public surface (signature starts; multiline arguments remain defined in source):

```text
constructor(parent: SceneObject, eventBus: EventBus, logger: Logger)
show(): void
hide(): void
setStatusText(text: string): void
destroy(): void
getContainer(): SceneObject
```

## MyAreasScreen

Import suffix under `AnchorExamples.lspkg/`: `Examples/UI/Screens/MyAreasScreen`

Public surface (signature starts; multiline arguments remain defined in source):

```text
constructor(parent: SceneObject, eventBus: EventBus, logger: Logger)
show(): void
hide(): void
updateAreas(areas: AreaInfo[]): void
setSelectedArea(index: number): void
destroy(): void
getContainer(): SceneObject
```

## UIController

Import suffix under `AnchorExamples.lspkg/`: `Examples/UI/UIController`

Inputs (exact source declarations):

```text
enableLogging: boolean = false
enableLoggingLifecycle: boolean = false
```

Public surface (signature starts; multiline arguments remain defined in source):

```text
onAwake(): void
initialize(rootContainer: SceneObject): void
getScreenContainer(screen: AppScreen): SceneObject | undefined
getFrame(): Frame
showScreen(screen: AppScreen): void
getCurrentScreen(): AppScreen | null
```

## RecallWidgets

Import suffix under `AnchorExamples.lspkg/`: `Examples/Widgets/Actions/RecallWidgets`

Public surface (signature starts; multiline arguments remain defined in source):

```text
static recallAll(widgets: WidgetBase[], cameraTransform?: Transform): void
```

## SnapToSurface

Import suffix under `AnchorExamples.lspkg/`: `Examples/Widgets/Actions/SnapToSurface`

Public surface (signature starts; multiline arguments remain defined in source):

```text
static getInstance(): SnapToSurface
constructor(worldQueryModule: WorldQueryModule, logger?: Logger)
startSession(): void
stopSession(): void
snapObjectToSurface(target: SceneObject): void
startContinuousSnap(objects: SceneObject[]): void
stopContinuousSnap(): void
isContinuousSnapActive(): boolean
hasValidHit(): boolean
unpinObject(obj: SceneObject): void
repinObject(obj: SceneObject): void
```

## NoteWidget

Import suffix under `AnchorExamples.lspkg/`: `Examples/Widgets/Types/NoteWidget`

Inputs (exact source declarations):

```text
textComponent: Text
inputFieldObject: SceneObject
enableLogging: boolean = false
enableLoggingLifecycle: boolean = false
```

Public surface (signature starts; multiline arguments remain defined in source):

```text
onAwake(): void
get serializedContent(): string
set serializedContent(value: string)
setText(text: string): void
getText(): string
```

## PhotoWidget

Import suffix under `AnchorExamples.lspkg/`: `Examples/Widgets/Types/PhotoWidget`

Inputs (exact source declarations):

```text
photoImage: Image
enableLogging: boolean = false
enableLoggingLifecycle: boolean = false
```

Public surface (signature starts; multiline arguments remain defined in source):

```text
onAwake(): void
get serializedContent(): string
set serializedContent(_value: string)
```

## WatchWidget

Import suffix under `AnchorExamples.lspkg/`: `Examples/Widgets/Types/WatchWidget`

Inputs (exact source declarations):

```text
timeText: Text
enableLogging: boolean = false
enableLoggingLifecycle: boolean = false
```

Public surface (signature starts; multiline arguments remain defined in source):

```text
onAwake(): void
get serializedContent(): string
set serializedContent(value: string)
toggleFormat(): void
getFormat(): "12h" | "24h"
```

## WidgetBase

Import suffix under `AnchorExamples.lspkg/`: `Examples/Widgets/WidgetBase`

Inputs (exact source declarations):

```text
enableLogging: boolean = false
enableLoggingLifecycle: boolean = false
```

Public surface (signature starts; multiline arguments remain defined in source):

```text
public widgetType: WidgetType
public widgetIndex: number = -1
readonly onDelete: PublicApi<number> = this.onDeleteEvent.publicApi()
readonly onContentChange: PublicApi<void>
onAwake(): void
get serializedContent(): string
set serializedContent(_value: string)
requestDelete(): void
public get widgetTransform(): Transform
```

## WidgetController

Import suffix under `AnchorExamples.lspkg/`: `Examples/Widgets/WidgetController`

Public surface (signature starts; multiline arguments remain defined in source):

```text
readonly onWidgetAdded: PublicApi<WidgetBase> =
readonly onWidgetRemoved: PublicApi<WidgetBase> =
static getInstance(): WidgetController
constructor(
spawnWidget(
    type: WidgetType,
    storageCtrl: StorageController,
    areaName: string
  ): WidgetBase | null
restoreWidgets(areaName: string, storageCtrl: StorageController): void
saveAllWidgets(storageCtrl: StorageController, areaName: string): void
clearAllWidgets(): void
recallAllWidgets(cameraTransform: Transform): void
isRecallActive(): boolean
getWidgets(): WidgetBase[]
getWidgetTransformTargets(): SceneObject[]
getWidgetFrames(): {frame: Frame; sceneObject: SceneObject}[]
getFrameForWidget(widget: WidgetBase): Frame | undefined
getTransformTargetForWidget(widget: WidgetBase): SceneObject | undefined
```

## AnchorController

Import suffix under `AnchorExamples.lspkg/`: `Scripts/AnchorController`

Public surface (signature starts; multiline arguments remain defined in source):

```text
readonly onSessionOpened: PublicApi<string | null> = this.onSessionOpenedEvent.publicApi()
readonly onSessionClosed: PublicApi<string | null> = this.onSessionClosedEvent.publicApi()
readonly onAnchorNearby: PublicApi<Anchor> = this.onAnchorNearbyEvent.publicApi()
readonly onAnchorSaved: PublicApi<Anchor> = this.onAnchorSavedEvent.publicApi()
readonly onAnchorDeleted: PublicApi<Anchor> = this.onAnchorDeletedEvent.publicApi()
readonly onTrackingStateChanged: PublicApi<TrackingStateChange> = this.onTrackingStateChangedEvent.publicApi()
readonly onUncertaintyChanged: PublicApi<UncertaintyChange> = this.onUncertaintyChangedEvent.publicApi()
static getInstance(): AnchorController
static stateName(state: AnchorTrackingState | null | undefined): string
setModule(module: AnchorModule | null | undefined): void
setLoggingEnabled(enabled: boolean): void
get isEditor(): boolean
get isSupported(): boolean
get hasActiveSession(): boolean
get activeSession(): AnchorSession | null
get currentArea(): string | null
get isSavePending(): boolean
async openSession(area: string | null = null): Promise<AnchorSession | null>
async closeSession(): Promise<void>
createWorldAnchor(toWorldFromAnchor: mat4): Promise<Anchor | null>
createWorldAnchorAt(position: vec3, forward: vec3 = vec3.forward()): Promise<Anchor | null>
async saveAnchor(anchor: Anchor): Promise<boolean>
async createAndSaveWorldAnchor(toWorldFromAnchor: mat4): Promise<Anchor | null>
async resolveAnchor(anchorId: string): Promise<Anchor | null>
async deleteAnchor(anchor: Anchor): Promise<boolean>
async clearArea(): Promise<boolean>
async clearAllAnchors(): Promise<boolean>
track(target: SceneObject, anchor: Anchor): AnchorComponent | null
untrack(target: SceneObject): void
untrackAll(): void
getTrackedAnchor(target: SceneObject): Anchor | null
getTrackingState(target: SceneObject): AnchorTrackingState | null
isTracking(target: SceneObject): boolean
```

## Logger

Import suffix under `AnchorExamples.lspkg/`: `Scripts/Logger`

Public surface (signature starts; multiline arguments remain defined in source):

```text
constructor(
setDebugEnabled(enabled: boolean): void
success(message: string): void
setEnabled(enabled: boolean): void
info(message: string): void
debug(message: string): void
warn(message: string): void
error(message: string): void
```

## Shared demo helpers (`Examples/Shared`, `Examples/Storage`, `Examples/Widgets`, `Examples/App`)

Plain modules (no components) that the demo scripts import. Reuse them only if you copy the demo.

### Examples/Shared/UIKit

Code-built SpectaclesUIKit helpers used by the screens. Re-exports `ElementContent` and `FlexAlign`, `FlexAlignSelf`, `FlexDirection`, `FlexJustify`.

```text
type TextRole = "Title1" | "Title2" | "HeadlineXL" | "Headline1" | "Headline2" | "Subheadline" | "Button" | "Callout" | "Body" | "Caption"
roleSize(role: TextRole, distanceCm: number = 110): number
applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void
const BUTTON_RENDER_ORDER = 8
const TEXT_RENDER_ORDER = 10
makeObj(parent: SceneObject, name: string, position?: vec3): SceneObject
liftZ(obj: SceneObject, dz: number): void
interface FlexAsItem {w?, h?, grow?, alignSelf?}
interface FlexOpts {name?, direction, width?, height?, gap?, padX?, padY?, justify?, align?, asItem?, zLift?}
flexContainer(parent: SceneObject, opts: FlexOpts, build: (container: SceneObject) => void): SceneObject
asFlexItem(obj: SceneObject, cfg: FlexAsItem): FlexItem
interface GridOpts {name?, columns, cellW, cellH, gap?, asItem?, zLift?}
gridContainer(parent: SceneObject, opts: GridOpts, build: (container: SceneObject) => void): SceneObject
addGridCell(parent: SceneObject, name: string, w: number, h: number): SceneObject
interface TextOpts {role?, width, height, halign?, valign?, wrap?, color?, renderOrder?, name?, asItem?}
addText(parent: SceneObject, text: string, opts: TextOpts): Text
type ButtonStyle = "Prism" | "PrismGhost" | "Primary" | "Secondary" | "Ghost"
interface ButtonOpts {label, width, height, style?, role?, toggleable?, initialOn?, name?, onTrigger?}
interface MadeButton {obj: SceneObject; button: Button; labelText: ElementContent}
makeButton(parent: SceneObject, opts: ButtonOpts): MadeButton
addButtonLabel(btnObj: SceneObject, label: string, role: TextRole = "Button"): ElementContent
```

`flexContainer` and `gridContainer` run `build` first and add the layout component last, so the layout discovers the children. `makeButton` sets the System3 Rectangle variant (default style `Primary`) before `initialize()`.

### Examples/Shared/Constants

| Constant | Value | Meaning |
|---|---|---|
| `LOCALIZATION_TIMEOUT_MS` | `15000` | Time before localization is reported as timed out |
| `CAMERA_GAZE_OFFSET` | `100` | Distance in front of the camera for new objects |
| `CAPTURE_ANCHOR_FORWARD_DISTANCE` | `5` | Camera-local forward offset of the capture-time anchor |
| `MAX_AREAS` | `9` | Maximum saved areas |
| `SAVE_AWAIT_TIMEOUT_SEC` | `60` | Wait for a background save when exiting an area |
| `FRAME_TRANSITION_DURATION` | `0.4` | Frame transition seconds |
| `FRAME_SIZES` | `Record<string, vec2>` | Frame size (cm) per screen: GetStarted 33×18, Capture 33×28, InCapture 33×28, MyAreas 33×35, InArea 30×20 |
| `AREAS_GRID_COLUMNS` / `AREAS_GRID_ROWS` / `AREAS_GRID_CELL_SIZE` | `3` / `3` / `vec2(8, 4)` | My Areas grid |
| `WIDGET_GRID_COLUMNS` / `WIDGET_GRID_ROWS` | `3` / `2` | Widget selection grid |
| `FRAME_EASING` | `"ease-in-out-cubic"` | Frame transition easing |
| `UI_COLOR_PRIMARY` / `UI_COLOR_SECONDARY` | `"#60A5FA"` / `"#94A3B8"` | Label and hint colors |

### Examples/Storage/StorageKeys

Persistent-storage key scheme used by StorageController.

```text
const STORAGE_PREFIX = "ANCHOR_EXAMPLES_V1"
const AREAS_KEY = "AREAS_KEY"
const TRANSFORM_KEY = "TRANSFORM_KEY"
const TYPE_KEY = "TYPE_KEY"
const CONTENT_KEY = "CONTENT_KEY"
const ANCHOR_POSE_KEY = "ANCHOR_POSE_KEY"   // saved widget-parent pose (Preview / fallback)
const ANCHOR_ID_KEY = "ANCHOR_ID_KEY"       // saved Anchor.id, restored with AnchorSession.resolveAnchor
areaKey(areaName: string): string            // `${STORAGE_PREFIX}_${areaName}`
widgetKey(areaName: string, subKey: string): string  // `${STORAGE_PREFIX}_${areaName}_${subKey}`
areasMapKey(): string                        // `${STORAGE_PREFIX}_${AREAS_KEY}`
```

### Examples/Widgets/WidgetTypes

```text
enum WidgetType { Note = "note", Watch = "watch", Photo = "photo" }
interface WidgetTypeEntry { componentName: string; displayName: string }
const WidgetTypeRegistry: Record<WidgetType, WidgetTypeEntry>  // NoteWidget / WatchWidget / PhotoWidget
getWidgetTypes(): WidgetType[]                                 // [Note, Watch, Photo]
```

### Examples/App/AppState

```text
enum AppScreen { GetStarted, Capture, InCapture, MyAreas, InArea }
enum AppLifecycleState { Idle, Initializing, Ready, CapturingArea, Localizing, InArea, Error }
interface AreaInfo { name: string; id: string }
interface WidgetData { position: vec3; rotation: vec3; scale: vec3; type: string; content: string }
interface NavigationEvent { screen: AppScreen; areaName?: string }   // EventBus navigation payload
enum CaptureState { Idle, Scanning, Complete, TimedOut, Cancelled }
```

## Demo assets

- `Examples/Prefabs/NoteWidgetPrefab.prefab` (NoteWidget + UIKit TextInputField), `WatchWidgetPrefab.prefab` (WatchWidget + time Text), `PhotoWidgetPrefab.prefab` (PhotoWidget + Image). The prefab wires them into AppController's `noteWidgetPrefab`, `watchWidgetPrefab`, `photoWidgetPrefab`.
- `Examples/Modules/World Query Module.worldQueryModule`: the asset wired into AppController's required `worldQueryModule` input (used by SnapToSurface).
- `Examples/Materials/` (note backgrounds, buttons, outlines, plane preview) and `Examples/Shaders/flat.graphShader`, `Examples/Textures/Image.png`.

## Demo scaffolding (`Example/`)

These scripts ship in `AnchorExamples.lspkg/Example/` and are wired inside `AnchorExamples__PLACE_IN_SCENE.prefab` (order: Guide, ExampleCarousel, then the `AnchorExample` group holding NewUIRoot, WidgetParent, NewAppController, UIController and NewTextInputRouter). They only present the example; they are not part of the anchor API, and you don't need them in your own Lens.

| Object / script | Class | Key inputs |
|---|---|---|
| `Guide` — `Example/GuideDismissPanel/GuideDismissPanel.ts` | `GuideDismissPanel` | `hideUntilDismissed: SceneObject[]` — hidden until "Ok, I understood" is pressed (here: ExampleCarousel and AnchorExample); `buttonLabel: string = "Ok, I understood"` (only used when the panel is built at runtime) |
| `ExampleCarousel` — `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | `examples: SceneObject[]` (here the single `AnchorExample` group), `exampleInfo: string[]` (one line per example), `steps: SceneObject[]` (empty here), `stepInfo: string[]` (one line per `steps` entry; empty entries fall back to the example's info; empty here), `startIndex: number = 0`, `previousLabel` / `nextLabel`, `examplesPushBack: number = 20`, `anchorExamples: boolean = true` (off here: the app stays where it is), `startMinimized: boolean = false` (on here), `extraPanelDrop: number = 0` (−26.5 here) |

Keep the Guide above the examples in the hierarchy: it hides its targets in `onAwake`.

## Input meanings and lifecycle

| Component | Inputs | Meaning |
|---|---|---|
| AppController | rootContainer, widgetParent | Programmatic UI parent; native-anchor tracked widget parent |
| AppController | camera | Optional world camera; SIK fallback |
| AppController | worldQueryModule | Surface hit-test module |
| AppController | noteWidgetPrefab, watchWidgetPrefab, photoWidgetPrefab | Matching widget prefab; missing input prevents that type from spawning |
| UIController | enableLogging, enableLoggingLifecycle | Logging controls, both false by default; initialize(rootContainer) supplies the UI parent |
| NoteWidget | textComponent, inputFieldObject | Note display Text and SceneObject bearing UIKit TextInputField |
| WatchWidget | timeText | UTC clock Text; updates on UpdateEvent |
| PhotoWidget | photoImage | Static photo Image |
| WidgetBase | enableLogging, enableLoggingLifecycle | Logging, inherited by widget types; defaults false |
| TextInputRouter | enableLogging, enableLoggingLifecycle | Logging; focusWidget routes keyboard edits to one note |
| Permissions | none | No-op component; ConnectedLensModule intentionally is not loaded |

WidgetBase is intended for subclassing; do not attach it directly. AppController builds UI on OnStart after its own onAwake initialized helpers. UIKit Frame applies runtime properties after onInitialized. The wrapper Frame is the transform target: do not persist/move WidgetContent children instead. Each widget's `serializedContent` carries only its own data (note text, watch format, static photo `{}`).
