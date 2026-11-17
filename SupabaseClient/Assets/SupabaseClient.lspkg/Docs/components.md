# SupabaseClient demo components

[← Agent usage index](../README.md)

## Use when

Read when wiring or debugging the demo prefab `SupabaseClient__PLACE_IN_SCENE.prefab`: the guide, the example carousel and the two test examples shipped in `Example/`. The client library itself (`supabase-snapcloud`) has no components; see [API](api.md).

## Demo scaffolding (`Example/`)

The prefab carries its own guide and example carousel, so the demo works when only the package is installed. Drop it into a Specs scene that already has Camera, lighting and SIK. These scripts are demo scaffolding, not part of the client API.

Prefab layout: `SnapCloudRequirements`, `CredentialsWarning` (shown first, only while credentials are missing), `Guide`, `ExampleCarousel`, then the examples `Client Tests` and `Realtime Test` (both disabled; the carousel enables one at a time).

### SnapCloudRequirements

Source: [`SnapCloudRequirements.ts`](../SnapCloudRequirements.ts) (the SnapCloudExamples `SnapCloudRequirements`, copied unchanged; consumer import `SupabaseClient.lspkg/SnapCloudRequirements`). On the prefab's first child. The one place the Snap Cloud project lives; `supabaseProject` ships EMPTY. Validated on awake, so its object sits above `CredentialsWarning` and the guide.

| Input declaration / default | Meaning |
|---|---|
| `supabaseProject: SupabaseProject` (`@allowUndefined`) | SupabaseProject asset (Window > Supabase > Import Credentials) |
| `text: Text` (`@allowUndefined`) | Optional warning Text (prefab: empty) |
| `disableWarningsWhenConfigured` / `showSetupInstructions` / `enableDebugLogs: boolean = true` | Warning and console options |
| `enableLogging` / `enableLoggingLifecycle: boolean = false` | Logger output |

Public: `getSupabaseProject()`, `isConfigured()`, `getSupabaseUrl()`, `getSupabasePublicToken()`, `getSupabaseHeaders()`, `getRestApiUrl()`, `getStorageApiUrl()`, `getFunctionsApiUrl()`, `setDebugLogging(enabled)`, `revalidate()`.

### CredentialsWarning

Source: [`Example/CredentialsWarning/CredentialsWarning.ts`](../Example/CredentialsWarning/CredentialsWarning.ts). On the prefab's `CredentialsWarning` child (after `SnapCloudRequirements`, before `Guide`). While a credential is missing it prints `CredentialsWarning: …`, holds the guide (and what the guide hides) and shows a red-framed "Credentials needed" panel listing what's missing; "Continue without credentials" closes it and the guide appears. When everything is set it disables itself.

| Input declaration / default | Meaning |
|---|---|
| `guide: SceneObject` | The guide shown after the warning (prefab: `Guide`) |
| `snapCloudRequirements: ScriptComponent` (`@allowUndefined`) | Checked for a Snap Cloud project (prefab: the `SnapCloudRequirements` object) |
| `rsgCredentials: ScriptComponent` (`@allowUndefined`) | Remote Service Gateway credentials (prefab: empty, not used) |
| `requireSnapToken` / `requireOpenAIToken` / `requireGoogleToken: boolean = false` | RSG tokens the examples need (prefab: all off) |
| `buttonLabel: string = "Continue without credentials"` | Close-button label |

Public: `findMissing(): string[]` returns what is missing, one line per credential with where to set it (the Snap Cloud project when `snapCloudRequirements` is wired and not configured; required RSG tokens when `rsgCredentials` is wired).

### ExampleCarousel

Source: [`Example/ExampleCarousel/ExampleCarousel.ts`](../Example/ExampleCarousel/ExampleCarousel.ts). On the prefab's `ExampleCarousel` child. Builds a UIKit panel with Previous / Next and a minimize button and enables one example (or sub-example step) at a time; the others stay disabled.

| Input declaration / default | Meaning |
|---|---|
| `examples: SceneObject[] = []` | Examples to step through, in order (prefab: Client Tests, Realtime Test) |
| `exampleInfo: string[] = []` | Info text per example, same order as `examples` |
| `steps: SceneObject[] = []` | Optional sub-examples shown one at a time (prefab: empty) |
| `stepInfo: string[] = []` | Info text per step, same order as `steps`; empty entries fall back to the example info (prefab: empty) |
| `startIndex: number = 0` | Example shown first (0-based) |
| `previousLabel: string = "Previous"` / `nextLabel: string = "Next"` | Button labels |
| `examplesPushBack: number = 20` | Extra distance (cm) the examples are pushed behind the carousel |
| `anchorExamples: boolean = true` | Move the examples in front of the user's head pose (prefab: `false`, the examples have no visuals) |
| `startMinimized: boolean = false` | Start collapsed to the title bar |
| `extraPanelDrop: number = 0` | Extra drop (cm) of the panel below its usual spot |

### GuideDismissPanel

Source: [`Example/GuideDismissPanel/GuideDismissPanel.ts`](../Example/GuideDismissPanel/GuideDismissPanel.ts). On the prefab's `Guide` child (next to a UIKit Frame, with a child Text and the "Ok, I understood" button). Places the guide in front of the user and closes it when the button is pressed.

| Input declaration / default | Meaning |
|---|---|
| `buttonLabel: string = "Ok, I understood"` | Close-button label (only used when the panel is built at runtime) |
| `hideUntilDismissed: SceneObject[] = []` | Objects hidden while the guide shows (prefab: `ExampleCarousel`, `Client Tests`, `Realtime Test`; never the prefab root) |

## Examples

Both read the Snap Cloud project from `SnapCloudRequirements`; without one they print a guard message and stop. Results print as PASS / FAIL lines in the Logger.

### Client Tests (`NewScript`)

Source: [`Example/ts__test.ts`](../Example/ts__test.ts) (row types: [`Example/DatabaseTypes.ts`](../Example/DatabaseTypes.ts)). Runs once when shown: sign-in, edge functions, `test_table` read/write and Storage upload/download.

| Input declaration / default | Meaning |
|---|---|
| `snapCloudRequirements: SnapCloudRequirements` (`@allowUndefined`) | Source of the Snap Cloud project used by `createClient` (prefab: the `SnapCloudRequirements` object) |
| `supabaseProject: SupabaseProject` (`@allowUndefined`) | Deprecated: use `snapCloudRequirements`. Only read when it isn't wired (prefab: empty) |
| `texture: Texture` | Text texture encoded and uploaded by the Storage tests (prefab: `Example/Text Texture.textTexture`) |

### Realtime Test (`TsTestRealtime`)

Source: [`Example/ts_test_realtime.ts`](../Example/ts_test_realtime.ts). Joins a broadcast channel, sends a message and logs the channel status and the broadcast it receives.

| Input declaration / default | Meaning |
|---|---|
| `snapCloudRequirements: SnapCloudRequirements` (`@allowUndefined`) | Source of the Snap Cloud project used by `createClient` (prefab: the `SnapCloudRequirements` object) |
| `supabaseProject: SupabaseProject` (`@allowUndefined`) | Deprecated: use `snapCloudRequirements`. Only read when it isn't wired (prefab: empty) |
| `channelName: string = 'test-channel'` | Realtime channel name (prefab: `test_realtime`) |
