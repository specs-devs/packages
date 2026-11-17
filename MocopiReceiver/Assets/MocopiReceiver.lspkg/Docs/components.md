# MocopiReceiver components

[← Agent usage index](../README.md)

## Use when

Look up exact inputs, public methods, callbacks and protocol shapes. Named imports come from `MocopiReceiver.lspkg/Scripts/<filename>`. Unassigned object inputs must be configured before lifecycle use. Public lifecycle hooks below are runtime hooks, not reinitialization APIs.

## MocopiWebSocketClient

Import `MocopiReceiver.lspkg/Scripts/MocopiWebSocketClient`.

| Input | Type | Default | Meaning |
|---|---|---|---|
| serverUrl | string | `wss://your-mocopi-server.example.com` | Source example endpoint; configure your relay. Basic avatar prefab overrides with invalid instructional string. |
| autoConnect | boolean | true | Connect on decorated Start. |
| maxReconnectAttempts | number | 0 | Zero means unlimited; positive value bounds retries. |
| reconnectInterval | number | 3 | Retry delay seconds. |
| enableDebugMode | boolean | true | Debug message logging; prefab sets false. |
| enableLogging | boolean | false | Logger flag. Native/direct connectivity prints remain. |
| enableLoggingLifecycle | boolean | false | Lifecycle Logger output. |

Nullable callback slots (initially null): `onSkeletonReceived: (skeleton: SkeletonDefinition) => void`, `onFrameReceived: (frame: FrameData) => void`, `onConnected: () => void`, `onDisconnected: () => void`, `onError: (error: string) => void`. Main overwrites all on Awake. These are assignments, not PublicApi events.

| Method | Return / behavior |
|---|---|
| onAwake() | Initialize Logger; bind OnDestroy to disconnect. |
| onStart() | Decorated Start; print setup and auto-connect if enabled. |
| update() | Decorated Update; service retry timer and calculate FPS. |
| connect() | Create InternetModule WebSocket, binaryType=blob, callbacks; guard only already-connected state. On open request skeleton, reset retry state and call onConnected. |
| disconnect() | Clear retry flag; close socket only if connected; null socket and connected stats. Socket onclose may restart retry. |
| sendMessage(message: any): boolean | JSON stringify/send if connected; false on absent connection or exception. Existing API accepts any; no consumer cast needed. |
| sendPing() | Send `{type:"ping"}`. |
| getSkeleton(): SkeletonDefinition | Stored skeleton, initially null despite declared return type. |
| getLatestFrame(): FrameData | Stored frame, initially null despite declared return type. |
| getStats(): ConnectionStats | Return live internal stats object. |
| getIsConnected(): boolean | Current connection flag. |

Text or Blob JSON type routes to skeleton/frame; pong only logs. FPS=(sampleCount−1)/(newest−oldest) using last 30 received timestamps. Counters and timestamps persist across reconnection. Errors handling incoming JSON are logged, not forwarded to onError; socket/open failures use onError. Retry state increments when scheduling, with zero for unlimited attempts.

## MocopiMainController

Import `MocopiReceiver.lspkg/Scripts/MocopiMainController`.

| Input | Type | Default | Meaning |
|---|---|---|---|
| webSocketClient | MocopiWebSocketClient | Unassigned | Required for successful Awake; owns callback fields. |
| avatarController | MocopiAvatarController | Unassigned | Used when present and showAvatar=true. |
| showAvatar | boolean | true | Gate initialization/frame routing; does not directly toggle scene visibility. |
| enableLogging | boolean | false | General Logger enable. |
| enableLoggingLifecycle | boolean | false | Lifecycle Logger enable. |

Public `onAwake()` validates client and installs callback routes. Decorated public `update()` performs lifecycle logging but no additional data processing. `connect()` / `disconnect()` forward to client if assigned. `resetAvatarController()` forwards avatar.resetAvatar() to clear mappings/init state; `resetAvatar()` forwards avatar.resetPose() to identity-reset bones. `getConnectionStats()` returns ConnectionStats or null if client absent.

Main has no public event fields of its own. Skeleton callback sets hasReceivedSkeleton before avatar.initializeAvatar; a failed avatar initialization does not clear it. Frames before first skeleton are dropped. Reconnect does not clear Main's skeleton-received flag.

## MocopiAvatarController

Import `MocopiReceiver.lspkg/Scripts/MocopiAvatarController`.

| Input | Type | Default | Meaning |
|---|---|---|---|
| prefabPlacement | PrefabPlacement | Unassigned, allowUndefined | Required to find instantiated avatar; assigned by placement after instantiation. |
| updatePositions | boolean | false | Write bone-local positions in addition to rotations. |
| applyCoordinateConversion | boolean | true | Negate position X and quaternion W/X. |
| smoothFactor | number | 0.3 | Interpolation uses 1−factor when >0; no clamp; 1 freezes current state. |
| avatarScale | number | 1 | Multiply incoming positions only. |
| enableLogging | boolean | false | General logging. |
| enableLoggingLifecycle | boolean | false | Lifecycle logging. |

| Public method | Return / behavior |
|---|---|
| onAwake() | Logger setup. While `prefabPlacement` is still unset (PrefabPlacement assigns itself right after `instantiate()`), logs an info line and returns. |
| initializeAvatar(skeleton: SkeletonDefinition) | Validate bones/placement, find instantiated root, store skeleton, clear/rebuild automatic mappings, mark initialized. |
| updateFrame(frame: FrameData) | Return unless initialized/skeleton/frame.bones. Update mapped local bones; frame parameter itself is not null-guarded. |
| resetAvatar() | Clear maps/targets/current root, mark uninitialized. Stored skeleton remains. |
| resetPose() | Set mapped local rotations identity; positions zero only if updatePositions=true. Not captured bind-pose restore. |
| mapBone(mocopiBoneId: number, avatarObject: SceneObject) | Reject negative ID/missing object; map, using name array or bone_ID fallback. Does not initialize avatar. |
| unmapBone(mocopiBoneId: number) | Delete mapping. |
| getBoneMappings(): Map<number, BoneMapping> | Live internal map; BoneMapping interface is not exported. |
| clearMappings() | Clear map and mark uninitialized. |
| getStats() | Object `{initialized:boolean,totalBones:number,mappedBones:number,unmappedBones:number}`; total from stored skeleton.num_bones. |

Private `BoneMapping` shape: `mocopiBoneId: number`, `mocopiBoneName: string`, `avatarObject: SceneObject`. Do not attempt a named import of BoneMapping. Root search checks human_low+root or names ending :_root/:root, else uses entire instantiated prefab. Utilities name-variation search supplies bone matching. Rotations build `new quat(w,x,y,z)` then optionally `new quat(-w,-x,y,z)`. Position conversion is (-x,y,z). Smoothing writes local transforms once per received bone, not time-scaled. No public events.

## PrefabPlacement

Import `MocopiReceiver.lspkg/Scripts/PrefabPlacement`.

| Input | Type | Default | Meaning |
|---|---|---|---|
| objectVisuals | SceneObject | Unassigned, allowUndefined | Required runtime parent; dereferenced on Start/startPlacement. |
| prefabToPlace | ObjectPrefab | Unassigned, allowUndefined | Instantiate after surface found, if assigned. |
| placementSettingMode | number, input int | 0 | 0 Tabletop, 1 Ground, 2 Wall; invalid value falls back Tabletop. Example sets 1. |
| autoStart | boolean | true | Begin placement on Start. |
| enableLogging | boolean | false | General Logger. |
| enableLoggingLifecycle | boolean | false | Lifecycle Logger. |

`mocopiMainController` is private/autodetected, not an input. SurfacePlacement singleton is acquired by field initializer. Public `onAwake()` caches transform/logger. Private decorated Start disables visuals and optionally starts placement.

- `startPlacement()`: destroy prior prefab, reset retained Main's avatar controller, hide visuals, start SurfacePlacement with chosen settings.
- `resetPlacement()`: guard singleton, stop placement then call startPlacement.
- `onDestroy()`: destroy current instantiated prefab; source has no decorator or explicit destroy-event binding here, so verify whether this hook runs under installed lifecycle handling.

Private surface callback enables visuals, places owning transform, instantiates child at local (0,0,0), identity rotation, unit scale, detects Main once and assigns avatar.prefabPlacement. No public placed-instance getter or event; Avatar reads private instance via existing source cast. Main reference is retained across replacements.

## ResetButton

Import `MocopiReceiver.lspkg/Scripts/ResetButton`. Input `prefabPlacement: PrefabPlacement`, unassigned. Public `onAwake()` validates/logs. `onResetButtonPressed()` guards assignment and calls resetPlacement; `resetPlacement()` is an alias. Example CapsuleButton TriggerUp callback targets this alias. No public events.

## MocopiDataTypes

Import named interfaces/types/constants from `MocopiReceiver.lspkg/Scripts/MocopiDataTypes`:

- `Vector3`: x/y/z numbers.
- `Quaternion`: x/y/z/w numbers.
- `MocopiBone`: id number, name string, parent_id number, rotation Quaternion, position Vector3.
- `SkeletonDefinition`: type literal "skeleton_definition", timestamp string, num_bones number, bones MocopiBone[].
- `FrameData`: type literal "frame_data", timestamp string, frame_id number, bones MocopiBone[], optional raw_data string and data_length number.
- `MocopiMessage`: SkeletonDefinition or FrameData union.
- `ConnectionStats`: connected boolean, framesReceived number, lastFrameTime number (getTime seconds), averageFPS number, reconnectAttempts number.
- `MOCOPI_BONE_NAMES`: 27 strings in order: root; torso_1–torso_7; neck_1,neck_2; head; l_shoulder,l_up_arm,l_low_arm,l_hand; r_shoulder,r_up_arm,r_low_arm,r_hand; l_up_leg,l_low_leg,l_foot,l_toes; r_up_leg,r_low_leg,r_foot,r_toes.

The array supplies manual-name fallback by numeric ID. The automatic mapper uses names/IDs from received skeleton, not this list alone. The client does not comprehensively validate these shapes.

## Demo scaffolding (`Example/`)

These scripts ship in `MocopiReceiver.lspkg/Example/` and are wired inside
`MocopiReceiver__PLACE_IN_SCENE.prefab`. They only present the demo; the
receiver components don't need them.

| Object / script | Class | Key inputs |
|---|---|---|
| `Guide`: `Example/GuideDismissPanel/GuideDismissPanel.ts` | `GuideDismissPanel` | `hideUntilDismissed: SceneObject[]` lists the objects hidden until "Ok, I understood" is pressed (here: `ExampleCarousel` and `MocopiReceiverExample`). `buttonLabel: string = "Ok, I understood"` is only used when the panel is built at runtime |
| `ExampleCarousel`: `Example/ExampleCarousel/ExampleCarousel.ts` | `ExampleCarousel` | Declared defaults: `examples: SceneObject[] = []`, `exampleInfo: string[] = []` (one line per example), `steps: SceneObject[] = []` (optional sub-examples), `stepInfo: string[] = []` (one line per step; empty entries fall back to the example info), `startIndex: number = 0`, `previousLabel: string = "Previous"`, `nextLabel: string = "Next"`, `examplesPushBack: number = 20`, `anchorExamples: boolean = true`, `startMinimized: boolean = false`, `extraPanelDrop: number = 0`. Values set in this prefab: `examples` = `MocopiReceiverExample`, `steps` / `stepInfo` empty, `examplesPushBack` 20, `anchorExamples` false (surface placement stays world-anchored), `startMinimized` true, `extraPanelDrop` 14 |

Both inputs point at the `MocopiReceiverExample` group rather than the prefab
root, because hiding the root would also hide the guide and the carousel. With a
single example the carousel hides Previous / Next and only carries the guidance.
