# InteractionKitExamples components

[← Agent usage index](../README.md)

## Use when

Use this as the import and member index after choosing an example in
[api-status.md](api-status.md). Everything below comes from the TypeScript source
of this revision. Defaults are the field initialisers, which are also the Inspector
defaults.

Import paths are relative to the package root:

- `InteractionKitExamples.lspkg/Scripts/UI/<Name>`
- `InteractionKitExamples.lspkg/Scripts/Interaction/<Name>`
- `InteractionKitExamples.lspkg/Scripts/Utils/<Name>`
- `InteractionKitExamples.lspkg/Scripts/GuideDismissPanel/GuideDismissPanel`
- `InteractionKitExamples.lspkg/Showcase/Scripts/<Name>`
- `InteractionKitExamples.lspkg/Showcase/Jellyfish/Scripts/physics` (vendored solver)

All `@component` classes are created with `obj.createComponent(X.getTypeName())`
or added in the Inspector. Unless noted, each one builds its UI on
`OnStartEvent`, so set inputs and data **before** OnStart. Every UI builder also
has the logging inputs `enableLogging` / `enableLoggingLifecycle` (`false`),
which are omitted from the tables.

## Interaction Showcase (`Showcase/Scripts/`)

All are `@component` classes authored in the prefab and wired with `@input`
(they don't build UI in code). Each subscribes to its events on `OnStartEvent`.

| Class | Inputs (default) | Public methods / notes |
|---|---|---|
| `ShowcaseSelector` | `toggleGroup: ToggleGroup`, `showcases: SceneObject[]`, `controlSections: SceneObject[]` (same order as the toggles), `jellyfishControls: JellyfishControls`, `chainControls: ChainControls` | Shows showcase *i* and control section *i* for toggle *i*; starts on the toggle set Default On. Switching resets the jellyfish and regroups the chain. |
| `CrystalChain` | `crystals: InteractableManipulation[]`, `spacing = 6` (cm), `reelSpeed = 2`, `springDuration = 0.3` | `regroup()`, `setSpringDuration(duration)`, `layOut()`. The grabbed crystal leads; the rest follow in a line, nearest first. |
| `ThrowOnRelease` | `manipulation: InteractableManipulation`, `throwRoot: SceneObject`, `damping = 2` | `stop()`. On release the object glides on along the hand's velocity and eases to a stop (no physics). |
| `PokeShrink` | `interactable: Interactable` (Poke targeting mode), `visual: SceneObject`, `pressedScale = 0.6`, `springDuration = 0.2` | `setSpringDuration(duration)`. Only the visual shrinks; the collider keeps its size. |
| `PinchGrow` | `interactable: Interactable` (Direct targeting mode), `hoverScale = 1.1`, `springDuration = 0.15` | Grows while a hand is within pinching reach. |
| `PinchSpin` | `interactable: Interactable`, `idleSpeed = 20`, `pinchBoost = 120`, `spinDamping = 0.7` | Each pinch adds a burst of spin that decays exponentially. |
| `JellyfishControls` | `jellyfish: SceneObject`, `throwOnRelease: ThrowOnRelease`, `tentaclePhysics: Physics`, `sizeSlider: Slider`, `throwSwitch: Switch`, `resetButton: Button`, `minScale = 0.2`, `maxScale = 0.6` | `reset()`. |
| `ChainControls` | `chain: CrystalChain`, `followSpeedSlider` / `spacingSlider: Slider`, `depthPullSwitch: Switch`, `regroupButton: Button` | `regroup()`. |
| `PokeControls` | `pokeShrink: PokeShrink`, `crystal: Interactable`, `shrinkAmountSlider` / `shrinkSpeedSlider: Slider`, `frontOnlySwitch: Switch` | Front only turns on poke directionality. |
| `PinchControls` | `pinchSpin: PinchSpin`, `pinchSpinSlider: Slider`, `idleTurnSwitch: Switch` | |
| `ColorPanel` | `hueSlider: ColorSlider`, `resetButton: Button`, `materials: Material[]` (each exposes a `tintColor` parameter) | Hold the button (the Interactable's secondary trigger) to slide the hue back. |
| `NearMenuToggle` | `placement: SceneObject` (leave disabled), `nearFrame: Frame`, `toggleButton: Button`, `camera: SceneObject` (optional; empty = the scene's world camera) | Each `toggleButton.onTriggerUp` opens the near panel along the user's gaze, or closes it if it is open. In the prefab the button is the far panel's Color panel button. |
| `Physics` (`Showcase/Jellyfish/Scripts/physics`) | `mainObject: SceneObject[]`, gravity, damping, tension, collider, wind and performance inputs | Vendored soft-body chain solver for the jellyfish tentacles, kept as-is. |

## UI examples (`Scripts/UI/`)

### Shared panel inputs

Most panel builders share this group (exact defaults per class below):
`frameAppearance: string` (`"Large"`/`"Small"`, Menu examples also `"Medium"`),
`framePadding: vec2`, `contentInset: vec2 = (1.5, 1.0)`,
`showCloseButton = true`, `showFollowButton = true`, `frameAutoHide = false`,
`flexLayoutResize = false` (corner-grab reflows content instead of scaling it),
`positionX = 0`, `positionY = 0`, `positionZ = -110` (local to the host),
optional `fontLight/fontRegular/fontMedium/fontBold: Font` (SpecsSans loaded
when empty).

| Class | Specific inputs (default) | Public methods / data |
|---|---|---|
| `ExampleMenuHorizontalLayout` | `panelTitle = "Menu Horizontal"`, `useFrame = true` (false → `BackPlate`, `backplateStyle = "dark"`), `frameInnerSize = (40,28)`, `framePadding = (0.8,0.8)`, `homeColumns = 3`, `homeRows = 10`, `galleryColumns = 4`, `galleryRows = 10`, `settingsColumns = 1`, `settingsRows = 10`, `testMode = true`, `placeholderImage: Texture`, `galleryImages: Texture[]`, `tabNames: string[]` (exactly 3, else Home/Gallery/Settings), `tabIcons: Texture[]` (exactly 3), `tabTextSize = 24`, `titleTextSize = 36`, `homeCardTextSize = 18`, `settingsCardTextSize = 22` | `homeItems`, `galleryItems`, `settingsItems: ButtonItem[]` (`{text, image, method}`); populate before OnStart |
| `ExampleMenuVerticalLayout` | as Horizontal, but `panelTitle = "Menu Vertical"`, `frameInnerSize = (42,28)`, `galleryColumns = 3` | same `ButtonItem` arrays |
| `ExampleGridSimple` | `rows = 2`, `columns = 4`, `buttonWidth = 10`, `buttonHeight = 10`, `spacing = 0.5`, `theme = "Dark"` (`Default/Dark/Bright/Focus`), `buttonStyle = "Primary"` (used when theme is `Default`), `testMode = true`, `buttonImages: Texture[]`, `frameAppearance = "Small"` | `items: GridSimpleItem[]` (`{label, subtitle?, image?, callback?}`), `addItem(item)` (rebuilds if already built), `getItemCount()`, `getButton(i)` / `getButtons()` (**1-based**, `RectangleButton`), `setButtonCallback(i, cb)` (adds to `onTriggerUp`), `updateButtonText(i, label?, subtitle?)`, `updateButtonImage(i, texture)`, `getFrame()`, `clearGrid()` |
| `ExampleGrid` | `panelTitle = "Grid"`, `rows = 2`, `columns = 4`, `buttonWidth = 10`, `buttonHeight = 10`, `buttonImageTexture` / `buttonImageMaterial` (optional), `draggable = false`, `scrollable = false`, `totalItems = 24`, `navGridGap = 3` | `generateGrid()` (auto-called 0.2 s after OnStart), `goToPage(index)` (0-based page), `clearGrid()`, `getButton(i)` / `getButtons()` (**1-based**), `updateButtonText(i, title?, subtitle?)`, `updateButtonImage(i, texture?, material?)`, `setButtonCallback(i, cb)`, `updateGridSize()`, `getGridSize(): vec2` |
| `ExampleCarouselLayout` | `testMode = true`, `panelTitle = "Carousel"`, `frameInnerSize = (36,28)`, `framePadding = (1,1)`, `row1Label = "Featured"`, `row1Count = 8`, `row1CardStyle = "Primary"`, `row1CardShape = "Rectangle"`, `row1Images`, `row2Label = "Recommended"`, `row2Count = 8`, `row2CardStyle = "Secondary"`, `row2CardShape = "Rectangle"`, `row2Images`, `visibleCards = 3`, `cardGap = 0.8`, `cardImageSize = 5.5`, `titleTextSize = 36`, `sectionTextSize = 22`, `cardTextSize = 22` | `row1Items`, `row2Items: {label, image?}[]`; populate before OnStart (test fill only when empty) |
| `ExampleModalLayout` | `testMode = true`, `frameAppearance = "Large"`, `primaryInnerSize = (30,18)`, `framePadding = (0.8,0.8)`, `modalInnerSize = (28,20)`, `titleFontSize = 36`, `bodyFontSize = 22`, `buttonFontSize = 26`, `modalTitleFontSize = 32`, `modalBodyFontSize = 22`, `modalButtonFontSize = 24` | `showModal()`, `hideModal(confirmed: boolean)` |
| `ExampleDeck` | `testMode = true`, `cardImages: Texture[]`, `swipeThreshold = 50`, `animationSpeed = 0.5`, `swipeSpeedThreshold = 100`, `leftCardRotationZ = 0`, `rightCardRotationZ = 0`, `imageToDescGap = 0.5` | `deckCards: {title, description, image?}[]`, `addCard(title, description, image?): number` (safe before or after start; before start it queues the card in `deckCards` and returns its future index), `getCardCount()`, `getCurrentIndex()`, `getCard(i)`, `getCurrentCard()`, `manualSwipeLeft()`, `manualSwipeRight()` |
| `ExampleChat` | `textColor = "white"` (`black`, `gray`), `colorStyle = "blue_gray"` (`green_gray`), `layoutStyle = "aligned"` (`shifted`), `testMode = true`, `mask = true` | `addUserMessage(text)` (≤200 chars), `addBotMessage(text)` (≤500 chars), `setScrollValue(0..1)`, `getCurrentIndex()`, `getCardCount()`, `getCard(i)`, `getCardMessage(i)`. Call after its OnStart (it creates the card container there). |
| `ExampleRoundedRectangle` | `content = "Card content"`, `style = "bot"` (`user`), `textColor = "white"` (`black`, `gray`) | `buildRoundedRectangle()`, `setContent(text)`, `getSize(): vec3`. Module exports `createRoundedRectangle(parent, name, options)`, `buildRoundedRectangleOnto(so, options)`, `getRoundedRectangleSizeFromText(content, width = 21, minHeight = 4, maxHeight?, maxLines?)`, types `ExampleRoundedRectangleOptions`, `ExampleRoundedRectangleStyle`, `ExampleRoundedRectangleTextColor` |
| `ExampleDynamicLayout` | `frameAppearance = "Large"`, `framePadding = (1,1)`, `homeFrameSize = (33,18)`, `screenAbSize = (33,28)`, `screenCSize = (33,35)`, `animDuration = 0.4`, `navWidth = 8`, `titleTextSize = 36`, `bodyTextSize = 22`, `navTextSize = 22`, `fontLight` / `fontRegular` / `fontMedium` / `fontBold: Font` (optional, SpecsSans when unset) | `currentState` getter, `transitionTo(state)`; `export enum UIState` (`Home`, `ScreenA`, `ScreenB`, `ScreenC`) from the same module |
| `ExampleScrollWindowLayout`, `ExampleSlidersLayout`, `ExampleSwitchToggleGroupLayout`, `ExampleToggleGroupLayout`, `ExampleReactiveLayout` | none (ScrollWindow: `flexLayoutResize = false`); fixed at local `(0,0,-110)` | none; self-contained `buildUI()` on OnStart |
| `UIController` | `sceneObjects: SceneObject[]`, `textObject: Text`, `counterText: Text`, `nextButton` / `previousButton: RoundButton` | `activateCurrentObject()`. Enables one `sceneObjects` entry at a time (index 0 first); nav taps switch after 0.2 s. |
| `UIManager` | `frame: Frame`, `initialFrameSize = (33,18)`, `expandedSize1 = (33,28)`, `expandedSize2 = (33,35)`, `resizeAnimationDuration = 0.4`, 6 `RectangleButton` and 5 content `SceneObject` inputs | `initialize()`, `getCurrentState()`, `setState(state)` with its own exported `UIState` (`MainMenu`, `Home`, `ScreenA`, `ScreenB`, `ScreenC`) (scene-wired predecessor of `ExampleDynamicLayout`) |
| `UIKitCustomVisualsFrame` | none; same SceneObject as a `Frame` | Draws a gradient `RoundedRectangle` over the Frame's glass |
| `UIKitCustomVisualsRectangleButton` | none; same SceneObject as a `RectangleButton` | Applies the same gradient to the button visual |
| `ButtonContentLayout`, `ButtonContentLayoutConfig` | plain classes | `new ButtonContentLayout(buttonObject, config)`, `create()`, `updateText(title?, subtitle?)`, `updateColors(titleColor?, subtitleColor?)`, `getContainerObject/ImageObject/TitleObject/SubtitleObject()`, `getImageComponent()`, `destroy()` |
| `GridRearrangement`, `GridGeometry` | plain class (used by `ExampleGrid` when `draggable`) | `new GridRearrangement(gridLayout, geometry, scriptComponent, lerpSpeed = 0.8, zOffset = 0, enableLogging = false, dragProximityThreshold = 3)`, `setupDragInteractions(children)`, `isDragRelease` (true while an item is dragged and for the trigger-up that ends the drag; a pinch that moves the item less than 1.5 cm stays a tap), `destroy()` (also removes the manipulation listeners) |

## Interaction examples (`Scripts/Interaction/`)

| Class | Inputs (default) | Notes |
|---|---|---|
| `ExampleSimpleManipulation` | `statusTextObject: SceneObject` (required, has a `Text`), `object0..object3: SceneObject` (optional, each with InteractionKit `Interactable` + `InteractableManipulation`) | Writes hover / grab / release + object name to the text from InteractionKit `onHoverEnter`, `onHoverExit`, `onTriggerStart`, `onTriggerEnd` |
| `InteractionModesManager` | `statusText: Text`, `testMode = true`, `mockHandA/B`, `testHandSpeed = 0.35`, `testHandAmplitude = 2.5`, `mockPinchA/B`, `testPinchSpeed = 0.5`, `testPinchAmplitude = 2.5`, `usePinchRightHand = true`, `distancePinchMin = 0.5`, `distancePinchMax = 5`, `distanceHandMin = 10`, `distanceHandMax = 60`, `scalePinchButton` / `scaleHandDistButton` / `rotatePinchButton` / `rotateHandDistButton: RectangleButton`, `cubePrefab`, `cubeCount = 5`, `cubeSpacing = 7`, `scaleAtZero = 0.4`, `scaleAtOne = 2`, `scalePinchAxes = (0,1,0)`, `scaleHandDistAxes = (1,0,0)`, `rotationAtZero = 0`, `rotationAtOne = 360`, `rotatePinchAxis = (1,0,0)`, `rotateHandDistAxis = (0,1,0)`, `smoothSpeed = 7`, `enableLogging = false` | Four independent toggle modes. `testMode` simulates hands only in the editor (`deviceInfoSystem.isEditor()`); on device it reads `IK.HandInputData`. Cubes are hidden until a mode is active. |
| `DistanceField` | `controlPoints: SceneObject[]` (≥2, required), `interpolationSteps = 20`, `closedLoop = false`, `particlePrefab` (required), `instancesPerCluster = 8`, `clusterRadius = 5`, `referenceObject` (required), `projectionPrefab` (optional), `pushDistance = 15`, `pushStrength = 8`, `pushSmoothSpeed = 6`, `showCurve = true`, `lineMaterial` (optional), `lineColor = (0.2,0.6,1.0)`, `lineWidth = 0.4` | Catmull-Rom path; particles near the reference object's projection are pushed away |
| `ExampleDiamondGrid` | `cubePrefab` (required), `cols = 5`, `rows = 5`, `cubeSize = 1`, `rotX = 35.264`, `rotY = 45`, `rotZ = 0`, `gap = 0`, `depthStep = 0` | `rebuild()`; not used by the shipped prefab |

## Utilities and guide

| Symbol | Path after prefix | Notes |
|---|---|---|
| `CHARACTER_LIMITS` | `Scripts/Utils/TextLimiter` | `{BOT_CARD_TEXT: 500, USER_CARD_TEXT: 200}` |
| `TreeStructureUtils`, `TreeNodeRef`, `TreeStats`, `YSeparationConflict` | `Scripts/Utils/TreeStructureUtils` | static `establishParentChild`, `getNodesAtLevel`, `getTreeStats`, … |
| `GuideDismissPanel` | `Scripts/GuideDismissPanel/GuideDismissPanel` | `buttonLabel = "Ok, I understood"`. Presents the host's `Text` on a `Frame` with a close button. Not used by the shipped prefab. |

## Demo scaffolding (`Example/`)

These two scripts run the shipped prefab's guide and carousel. They are demo
scaffolding, not examples to copy, and they are separate from the older
`Scripts/GuideDismissPanel/GuideDismissPanel` above (same class name, different
file). Import from `InteractionKitExamples.lspkg/Example/<Name>/<Name>` if you reuse them.

| Class | Path after prefix | Key inputs (defaults) | Notes |
|---|---|---|---|
| `ExampleCarousel` | `Example/ExampleCarousel/ExampleCarousel` | `examples: SceneObject[]`, `exampleInfo: string[]`, `steps: SceneObject[]` (optional sub-examples), `stepInfo: string[] = []` (one line per step, same order as `steps`; empty entries fall back to the example info; unset in the prefab), `startIndex = 0`, `previousLabel = "Previous"`, `nextLabel = "Next"`, `examplesPushBack = 20` (prefab: 60), `anchorExamples = true`, `fixedExamples: SceneObject[] = []` (examples left where they are authored; prefab: the Showcase), `startMinimized = false`, `extraPanelDrop = 0` | Builds a Frame with title, info text, counter, Previous / Next and a minimize button. Enables one example (or step) at a time. In the prefab: `examples` = the three `[EXAMPLES]` groups (Showcase first), `steps` = the 15 individual examples. |
| `GuideDismissPanel` | `Example/GuideDismissPanel/GuideDismissPanel` | `buttonLabel = "Ok, I understood"`, `hideUntilDismissed: SceneObject[]` | Shows the guide text on a Frame in front of the user. Objects in `hideUntilDismissed` that start enabled are hidden until the button is pressed. In the prefab: the carousel and the three example groups. |

## Prefabs

| Prefab | Contents |
|---|---|
| `InteractionKitExamples__PLACE_IN_SCENE.prefab` | Map in [guide](guide.md#prefab-map) |
| `Prefabs/Box.prefab` | `InteractionModesManager.cubePrefab` in the shipped prefab |
| `Prefabs/Particles.prefab` / `Prefabs/Spaceship.prefab` | `DistanceField.particlePrefab` / `projectionPrefab` in the shipped prefab |
| `Prefabs/[Manipulate Example] Box 1.prefab` | Standalone manipulable box; not referenced by the shipped prefab |
| `Showcase/Crystal/`, `Showcase/Jellyfish/`, `Showcase/Audio/` | Showcase meshes (`crystal_shapes.fbx`, `Jelly_Flow_v1.fbx`), `Crystal` and `Jelly_Flow_Shader` graph shaders and materials (with the `tintColor` the color panel drives), textures and grab / pinch / poke sounds |
| `Materials/*.mat`, `Shaders/*.graphShader`, `Textures/image_unlit.graphShader`, `Fonts/` | Shared materials, shaders and SpecsSans fonts used by the examples |
