# WorldQueryHit components

[← Agent usage index](../README.md)

## Use when

Import the installed revision’s public classes, functions and wire types, or wire component inputs. This reference was derived from TypeScript source declarations. Defaults are source initializers; prefab values may override them. Public signatures do not certify runtime availability. Lifecycle methods are included for accuracy, not as user commands.

## Prefab layout

`WorldQueryHit__PLACE_IN_SCENE.prefab` (package root):

| Object | Role |
|---|---|
| `WorldQueryHit__PLACE_IN_SCENE` | Root, at the origin. Content is world-anchored: the cursor and the copies go where the hand ray hits a surface. |
| `Guide` | Demo guide panel (UIKit `Frame` + `GuideText` + `OkButton`, 100 cm in front of the origin) with `GuideDismissPanel`; see [Demo scaffolding](#demo-scaffolding-example-not-supported-api). |
| `ExampleCarousel` | Demo panel with `ExampleCarousel`; shows the example's title and info text. |
| `World Query Hit` | Example group (origin) listed by the carousel and the guide. Hidden until the guide is dismissed. |
| `World Query Example [EDIT ME]` | Child of `World Query Hit`. Carries the TS `NewScript` placement component (prefab values: indexToSpawn 1, filter off, classification on, label on, refine off, detectCategory 0 All, labelScale 1, smoothing on / speed 10, intro hint on / 2 s, logging off). |
| `Plane` | Disabled, unused 31 cm quad (Plane.mesh / Plane.mat). Nothing moves it; keep it disabled or it sits at the user's origin. |
| `Objects to spawn [EDIT]` | `targetObject`: the cursor. Disabled at awake, shown and moved to the hit pose while a surface is hit. |
| `Statue`, `House`, `Tree`, `Cloud` | `objectsToSpawn` (in this order). Only the source at `indexToSpawn` is enabled; on pinch release it is copied with `copyWholeHierarchy` and detached at the cursor pose. |

## Demo scaffolding (`Example/`, not supported API)

Shipped in `WorldQueryHit.lspkg/Example/` and used only by `WorldQueryHit__PLACE_IN_SCENE.prefab` to present the example. Do not import them from your own scripts.

| Script | Sits on | Key inputs |
|---|---|---|
| `Example/GuideDismissPanel/GuideDismissPanel` | `Guide` (first child of the prefab root; UIKit `Frame` + text + `OkButton`) | `buttonLabel` (`"Ok, I understood"`; only used when the panel is built at runtime), `hideUntilDismissed: SceneObject[]` (prefab: `ExampleCarousel` and `World Query Hit`; enabled when the guide is closed) |
| `Example/ExampleCarousel/ExampleCarousel` | `ExampleCarousel` (builds its title / info / minimize panel at runtime; Previous / Next only appear with more than one example) | `examples: SceneObject[]` (`World Query Hit`), `exampleInfo: string[]` (panel text), `steps` (empty), `stepInfo: string[]` (one line per `steps` entry; empty entries fall back to the example's info; empty here), `startIndex` (0), `previousLabel` / `nextLabel`, `examplesPushBack` (20 cm), `anchorExamples` (off: content is world-anchored), `startMinimized` (on), `extraPanelDrop` (10 cm) |

## Assets

Visuals of the spawnable sources in the prefab (demo content; replace with your own objects):

| Object | Meshes | Material | Shader | Textures |
|---|---|---|---|---|
| `Statue` | `Meshes/statue.mesh` | `Materials/statue.mat` | `Shaders/cloud.graphShader` | `statue_base`, `statue_normal`, `statue_params` |
| `House` | `Meshes/stand.mesh`, `sit.mesh`, `eyes.mesh`, `tail.mesh`, `mouth_smile.mesh`, `mouth_open.mesh` | `Materials/house.mat` | `Shaders/cloud.graphShader` | `house_base`, `house_normal`, `house_params` |
| `Tree` | `Meshes/tree.mesh` | `Materials/tree.mat` | `Shaders/cloud.graphShader` | `Tree_base`, `Tree_normal`, `Tree_params` |
| `Cloud` | `Meshes/cloud.mesh` | `Materials/cloud.mat` | `Shaders/cloud.graphShader` | `cloud_base`, `cloud_normal`, `cloud_params` |
| `Plane` (disabled, unused) | `Meshes/Plane.mesh` | `Materials/Plane.mat` | `Shaders/pbr.graphShader` | none |

Textures are PNGs in `Textures/`.

## HitTestClassificationTS.ts

Consumer import: `WorldQueryHit.lspkg/Scripts/HitTestClassificationTS`.

SurfaceClassificationInfo and Event<SurfaceClassificationInfo> are the public semantic API. currentClassification starts null; null hits keep the last value, and onClassificationChanged fires only when the resolved name changes. createHitTestSession returns a new independent session rather than replacing the active one. getClassificationName uses the map seeded during awake; getClassificationColor returns a suggested shared vec4 color. No placement, stop or loss-event API is declared.

Source declaration (reference text, not a standalone snippet):

```text
export type SurfaceClassificationInfo = {
  /** Raw SurfaceClassification enum value reported by the runtime. */
  classification: number;
  /** Enum key name, e.g. "Ground", "Wall", "None". */
  name: string;
  /** Human-readable label, e.g. "GROUND", "WALL", "UNKNOWN". */
  displayName: string;
  /** Suggested UI color for this surface type. */
  color: vec4;
};
```

### HitTestClassification

Lens component. extends BaseScriptComponent.

| Input | Type | Source default | Meaning / annotation |
|---|---|---|---|
| `refineEnabled` | `boolean` | `false` | Request refined hit results (options.refine). Not available on every SnapOS/Lens Studio version; silently ignored when unsupported |
| `enableLogging` | `boolean` | `false` | Enable general logging (events, operations, etc.) |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

| Public member | Declaration / source default |
|---|---|
| `onClassificationChanged` | `onClassificationChanged: inferred = new Event<SurfaceClassificationInfo>()` |
| `currentClassification` | `get currentClassification(): SurfaceClassificationInfo \| null` |
| `onAwake` | `method onAwake(): inferred` |
| `createHitTestSession` | `method createHitTestSession(): inferred` |
| `getClassificationName` | `method getClassificationName(classification: number \| undefined \| null): string` |
| `getClassificationColor` | `method getClassificationColor(name: string): vec4` |
| `onHitTestResult` | `onHitTestResult: (result: WorldQueryHitTestResult) => void = bound arrow callback; see lifecycle for null-hit retention` |
| `onUpdate` | `method onUpdate(): void` |

## WorldQueryHitExampleTS.ts

Consumer import: `WorldQueryHit.lspkg/Scripts/WorldQueryHitExampleTS`.

The exported class name is NewScript. onAwake/onUpdate are lifecycle methods, not commands. setupTriggerEndCallback adds callbacks without cleanup; calling it again duplicates subscriptions. createHitTestSession returns a new session without changing the private one. setObjectIndex stores the index only; setObjectEnabled ignores its parameter and uses this.indexToSpawn. placeObject clones the selected SceneObject subtree using its parent. onHitTestResult is an internal runtime callback left public by source; no public placement event is provided. See [lifecycle](lifecycle.md).

### NewScript

Lens component. extends BaseScriptComponent.

| Input | Type | Source default | Meaning / annotation |
|---|---|---|---|
| `indexToSpawn` | `number` | `unassigned` |  |
| `targetObject` | `SceneObject` | `unassigned` |  |
| `objectsToSpawn` | `SceneObject[]` | `unassigned` |  |
| `filterEnabled` | `boolean` | `unassigned` |  |
| `smoothingEnabled` | `boolean` | `true` | Smoothly interpolate (lerp) the preview object toward the hit point instead of snapping to it |
| `smoothingSpeed` | `number` | `10.0` | Smoothing speed — higher is snappier. ~5 feels floaty, ~10 balanced, ~25 tight. Frame-rate independent |
| `showIntroHint` | `boolean` | `true` | Show a brief instruction tethered in front of the user when the Lens starts |
| `introHintText` | `string` | `"Point to surfaces using your hand to see semantic classification and pinch to instantiate the object prefab"` | Instruction text shown at start (long lines wrap automatically) |
| `introHintDuration` | `number` | `2.0` | How long the intro hint stays visible, in seconds |
| `classificationEnabled` | `boolean` | `true` | Enable surface classification (options.classification) on the hit test session |
| `showSurfaceLabel` | `boolean` | `true` | Show a color-coded label at the hit point naming the detected surface (GROUND, WALL, TABLE, ...) |
| `refineEnabled` | `boolean` | `false` | Request refined hit results (options.refine). Not available on every SnapOS/Lens Studio version; silently ignored when unsupported |
| `labelScale` | `number` | `1.0` | Uniform scale multiplier for the semantic surface label |
| `detectCategory` | `number` | `0` | The full set of detectable surface categories. 'All' labels every detected surface; pick one category to only label hits of that type |
| `groundColor` | `vec4` | `no TS initializer; Inspector @input('vec4', '{0.0, 1.0, 0.0, 1.0}')` | Label color when the detected surface is Ground |
| `wallColor` | `vec4` | `no TS initializer; Inspector @input('vec4', '{0.0, 1.0, 0.9686, 1.0}')` | Label color when the detected surface is a Wall |
| `ceilingColor` | `vec4` | `no TS initializer; Inspector @input('vec4', '{0.6667, 0.0, 1.0, 1.0}')` | Label color when the detected surface is a Ceiling |
| `tableColor` | `vec4` | `no TS initializer; Inspector @input('vec4', '{1.0, 0.0, 0.0, 1.0}')` | Label color when the detected surface is a Table |
| `unknownColor` | `vec4` | `no TS initializer; Inspector @input('vec4', '{0.0275, 0.0, 0.4392, 1.0}')` | Label color for None/Unknown surfaces — also the fallback for any category without its own color above |
| `enableLogging` | `boolean` | `false` | Enable general logging (hit tests, object placement, etc.) |
| `enableLoggingLifecycle` | `boolean` | `false` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

| Public member | Declaration / source default |
|---|---|
| `onAwake` | `method onAwake(): inferred` |
| `setupTriggerEndCallback` | `method setupTriggerEndCallback(): inferred` |
| `placeObject` | `method placeObject(): inferred` |
| `createHitTestSession` | `method createHitTestSession(filterEnabled): inferred` |
| `onHitTestResult` | `method onHitTestResult(results): inferred` |
| `onUpdate` | `method onUpdate(): inferred` |
| `setObjectIndex` | `method setObjectIndex(i): inferred` |
| `setObjectEnabled` | `method setObjectEnabled(i): inferred` |

## JavaScript script assets

These are attached ScriptComponents with `script` globals, not TypeScript named exports. Do not run both placement variants together unless duplicate sessions/callbacks are intended. Neither JS file declares enableLoggingLifecycle.

### WorldQueryHitExampleJS.js

Asset path: `WorldQueryHit.lspkg/Scripts/WorldQueryHitExampleJS.js`. Its constructor executes immediately once at file load. The public exported constructor is `script.WorldQueryHitExample`; calling it again adds sessions/callbacks, not a safe reset.

| Inspector input | JS declaration type | Declared default | Meaning |
|---|---|---|---|
| `indexToSpawn` | `int` | `not explicitly declared` | Index into wired SceneObject array; required valid integer. |
| `targetObject` | `SceneObject` | `not explicitly declared` | Preview SceneObject to move/hide; required. |
| `objectsToSpawn` | `SceneObject[]` | `not explicitly declared` | Source SceneObjects with valid parents; required. |
| `filterEnabled` | `bool` | `not explicitly declared` | Session filter option captured during awake. |
| `smoothingEnabled` | `bool` | `true` | Smoothly interpolate (lerp) the preview object toward the hit point instead of snapping to it |
| `smoothingSpeed` | `float` | `10.0` | Smoothing speed — higher is snappier. ~5 feels floaty, ~10 balanced, ~25 tight. Frame-rate independent |
| `showIntroHint` | `bool` | `true` | Show a brief instruction tethered in front of the user when the Lens starts |
| `introHintText` | `string` | `"Point to surfaces using your hand to see semantic classification and pinch to instantiate the object prefab"` | Instruction text shown at start (long lines wrap automatically) |
| `introHintDuration` | `float` | `2.0` | How long the intro hint stays visible, in seconds |
| `classificationEnabled` | `bool` | `true` | Enable surface classification (options.classification) on the hit test session |
| `showSurfaceLabel` | `bool` | `true` | Show a color-coded label at the hit point naming the detected surface (GROUND, WALL, TABLE, ...) |
| `refineEnabled` | `bool` | `not explicitly declared` | Request refined hit results (options.refine). Not available on every SnapOS/Lens Studio version; silently ignored when unsupported |
| `labelScale` | `float` | `1.0` | Uniform scale multiplier for the semantic surface label |
| `detectCategory` | `int` | `0` | The full set of detectable surface categories. 'All' labels every detected surface; pick one category to only label hits of that type |
| `groundColor` | `vec4` | `{0.0, 1.0, 0.0, 1.0}` | Label color when the detected surface is Ground |
| `wallColor` | `vec4` | `{0.0, 1.0, 0.9686, 1.0}` | Label color when the detected surface is a Wall |
| `ceilingColor` | `vec4` | `{0.6667, 0.0, 1.0, 1.0}` | Label color when the detected surface is a Ceiling |
| `tableColor` | `vec4` | `{1.0, 0.0, 0.0, 1.0}` | Label color when the detected surface is a Table |
| `unknownColor` | `vec4` | `{0.0275, 0.0, 0.4392, 1.0}` | Label color for None/Unknown surfaces — also the fallback for any category without its own color above |

| Public script member | Contract |
|---|---|
| `script.WorldQueryHitExample` | Constructor function; immediate initial invocation occurs at file load; not a reset command. |
| `script.setObjectIndex(i)` | Sets indexToSpawn without bounds checking or source visibility changes. |
| `script.setObjectEnabled(indexToEnable)` | Enables only the source matching the argument, but does not set indexToSpawn. This differs from TS. |

All other functions are scoped inside the constructor. There is no exposed JS placeObject, session setter or placement event. Smoothing/hints, runtime enum mapping, label-only category filtering and stale-cache behavior follow [lifecycle](lifecycle.md); TS has Logger inputs, JS placement does not.

### HitTestClassificationJS.js

Asset path: `WorldQueryHit.lspkg/Scripts/HitTestClassificationJS.js`. Inspector inputs: `refineEnabled: bool` and `enableLogging: bool`, with no explicit assignment defaults in the source annotations (do not confuse that with the TS explicit false initializers). Classification is always requested.

| Public script member | Contract |
|---|---|
| `script.HitTestClassification` | Constructor function, invoked immediately at file load; repeated invocation duplicates runtime processing. |
| `script.onClassificationChanged` | SIK Event with `{classification, name, displayName, color}` payload; name-change only. |
| `script.getCurrentClassification()` | Returns null before first hit, otherwise last-known payload; missed hits and inactive targeting do not clear it. |

Internal names/colors match the TS implementation: Ground green, Wall cyan, Ceiling purple, Table red and None dark blue; unknown names share None fallback color. No TS-style public name/color resolver or createHitTestSession function is exposed on script. No shutdown/loss event is implemented.
