# SnapCloudExamples leaderboard

[← Agent usage index](../README.md)

## Use when

Read for the score/RPC contract, pooled rows and local pinch game.

## GlobalLeaderboard

Import path: `SnapCloudExamples.lspkg/Example6-GlobalLeaderboard/Scripts/GlobalLeaderboard`. Source: [`Example6-GlobalLeaderboard/Scripts/GlobalLeaderboard.ts`](../Example6-GlobalLeaderboard/Scripts/GlobalLeaderboard.ts).

Asserts service+row renderer at Awake. isReady checks configured reference only. Start refreshes when configured; ascending maps asc (lower score first), false maps desc. submitScore requires finite Number(score), nonempty trimmed displayName, calls service then refresh. refresh maps ranks starting 1, display fallback --- and score Number(row.score||0), renders rows, rethrows errors.

### Inspector inputs

A missing initializer means no source default: assign the required reference; only `@allowUndefined`/`?` inputs explicitly allow absence. Types/defaults are literal source declarations. Meanings are authored hints; behavior qualifications above take precedence.

| Input declaration / default | Meaning |
|---|---|
| `supabaseService: SupabaseLeaderboardService;` | SupabaseLeaderboardService component for RPC calls (submit_score, get_top_scores) |
| `rowInstantiator: LeaderboardRowInstantiator;` | LeaderboardRowInstantiator that renders row entries |
| `ascending: boolean = true;` | If true: lowest score ranks first (ascending). If false: highest score ranks first (descending). |
| `itemsCount: number = 10;` | Top N to show (10/20/30...). If DB has fewer, it will show fewer. |
| `enableLogging: boolean = false;` | Enable general logging (refresh, submit activity, etc.) |
| `enableLoggingLifecycle: boolean = false;` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

### Public members

Signatures are reference fragments, not standalone runnable scripts. Lifecycle methods should not be invoked repeatedly. No custom exported component event emitter is declared.

| Member | Contract / source description |
|---|---|
| `onAwake(): void` | Initializes logger and validates required inputs. Called when component is created. |
| `isReady(): boolean` | Public API: True when your project is assigned on SnapCloudRequirements (via SupabaseLeaderboardService) so refresh submit can run. Client init is lazy (runs on first RPC). |
| `async submitScore(score: number, displayName: string): Promise<void>` | Public API: Call from the game (e.g. PinchGameController) when a round ends. Submits score and displayName to Supabase (service handles init auth) and refreshes the list.  |
| `async refresh(): Promise<void>` | Public API: Can be called any time. Service init is done inside getTopScores. Callers should handle rejection (e.g. .catch or try catch around await). No-op if your project is not set on SnapCloudRequirements (avoids "Supabase client not initialized" errors). |


## LeaderboardRowInstantiator

Import path: `SnapCloudExamples.lspkg/Example6-GlobalLeaderboard/Scripts/LeaderboardRowInstantiator`. Source: [`Example6-GlobalLeaderboard/Scripts/LeaderboardRowInstantiator.ts`](../Example6-GlobalLeaderboard/Scripts/LeaderboardRowInstantiator.ts).

Creates rows at startPosition+step*i, count from linked GlobalLeaderboard.itemsCount or local input. Default step advances -X, not vertical. render binds at most pool length, enables rows used, disables remainder. Finds a bind-capable script on prefab root only. Changing count after pool creation does not rebuild automatically.

### Inspector inputs

A missing initializer means no source default: assign the required reference; only `@allowUndefined`/`?` inputs explicitly allow absence. Types/defaults are literal source declarations. Meanings are authored hints; behavior qualifications above take precedence.

| Input declaration / default | Meaning |
|---|---|
| `itemPrefab!: ObjectPrefab;` | The prefab object that will be instantiated for each row. |
| `globalLeaderboard?: GlobalLeaderboard;` | Assign GlobalLeaderboard to use its itemsCount; otherwise uses itemsCount input. |
| `itemsCount: number = 10;` | Number of rows when globalLeaderboard is not set; otherwise use globalLeaderboard's itemsCount. |
| `startPosition: vec3 = new vec3(-10, 0, 0);` | First row local position |
| `step: vec3 = new vec3(-4, 0, 0);` | Position step per row |
| `enableLogging: boolean = false;` | Enable general logging (row creation, bind calls, etc.) |
| `enableLoggingLifecycle: boolean = false;` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

### Public members

Signatures are reference fragments, not standalone runnable scripts. Lifecycle methods should not be invoked repeatedly. No custom exported component event emitter is declared.

| Member | Contract / source description |
|---|---|
| `onAwake(): void` | Initializes logger, validates itemPrefab, and creates row pool. Called when component is created. |
| `render(entries: LeaderboardEntryUI[]): void` | Public API: Update existing pooled rows with entries, hide unused slots. |


## LeaderboardEntryUI

Import path: `SnapCloudExamples.lspkg/Example6-GlobalLeaderboard/Scripts/LeaderboardRowItem`. Source: [`Example6-GlobalLeaderboard/Scripts/LeaderboardRowItem.ts`](../Example6-GlobalLeaderboard/Scripts/LeaderboardRowItem.ts).

Exported data shape; fields shown below.

```text
export type LeaderboardEntryUI = {
  rank: number;
  displayname: string;
  score: number;
};
```

## LeaderboardRowItem

Import path: `SnapCloudExamples.lspkg/Example6-GlobalLeaderboard/Scripts/LeaderboardRowItem`. Source: [`Example6-GlobalLeaderboard/Scripts/LeaderboardRowItem.ts`](../Example6-GlobalLeaderboard/Scripts/LeaderboardRowItem.ts).

bind(LeaderboardEntryUI) sets rank/displayname/score text through optional SceneObject Text components. Unassigned text objects are skipped. Rank and score are stringified; no backend action.

### Inspector inputs

A missing initializer means no source default: assign the required reference; only `@allowUndefined`/`?` inputs explicitly allow absence. Types/defaults are literal source declarations. Meanings are authored hints; behavior qualifications above take precedence.

| Input declaration / default | Meaning |
|---|---|
| `rankText: SceneObject;` | SceneObject with Text component for rank display (e.g. #1) |
| `displaynameText: SceneObject;` | SceneObject with Text component for display name |
| `scoreText: SceneObject;` | SceneObject with Text component for score |
| `enableLogging: boolean = false;` | Enable general logging (animation cycles, events, etc.) |
| `enableLoggingLifecycle: boolean = false;` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

### Public members

Signatures are reference fragments, not standalone runnable scripts. Lifecycle methods should not be invoked repeatedly. No custom exported component event emitter is declared.

| Member | Contract / source description |
|---|---|
| `onAwake(): void` | Initializes logger. Called when component is created. |
| `bind(entry: LeaderboardEntryUI): void` | Public API: Updates rank, name, and score text from entry. Called by LeaderboardRowInstantiator.render(). |


## PinchGameController

Import path: `SnapCloudExamples.lspkg/Example6-GlobalLeaderboard/Scripts/PinchGameController`. Source: [`Example6-GlobalLeaderboard/Scripts/PinchGameController.ts`](../Example6-GlobalLeaderboard/Scripts/PinchGameController.ts).

Awake resets UI; startGame resets score/timer, hides controls/leaderboard and shows game. onPinched increments only during a round; caller must wire actual interaction. Update countdown ends round and shows leaderboard, resolves display name through userContextSystem or configured fallback, submits only if leaderboard isConfigured-ready. Errors logged; UI switches do not await RPC completion. gameUIRoot falls back to this component scene object; avoid disabling the updater with incorrect root wiring.

### Inspector inputs

A missing initializer means no source default: assign the required reference; only `@allowUndefined`/`?` inputs explicitly allow absence. Types/defaults are literal source declarations. Meanings are authored hints; behavior qualifications above take precedence.

| Input declaration / default | Meaning |
|---|---|
| `countdownSeconds: number = 10;` | Timer duration in seconds for each game round |
| `countdownText: Text;` | Text component displaying the countdown timer |
| `scoreText: Text;` | Text component displaying the current score |
| `globalLeaderboard: GlobalLeaderboard;` | Assign the SceneObject that has the GlobalLeaderboard script (or the script component) |
| `gameUIRoot: SceneObject;` | SceneObject root for game UI (timer, score). If unset, this component's SceneObject is toggled. |
| `controlsUIRoot: SceneObject;` | SceneObject root for controls UI (description, Start button). Shown on awake, hidden when game starts. |
| `displayName: string = "Player";` | Fallback display name when SnapchatUser is unavailable (e.g. in editor). Leaderboard uses SnapchatUser when available. |
| `enableLogging: boolean = false;` | Enable general logging (game events, submit activity, etc.) |
| `enableLoggingLifecycle: boolean = false;` | Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.) |

### Public members

Signatures are reference fragments, not standalone runnable scripts. Lifecycle methods should not be invoked repeatedly. No custom exported component event emitter is declared.

| Member | Contract / source description |
|---|---|
| `onAwake(): void` | Initializes logger, validates required inputs, and resets UI. Called when component is created. |
| `public startGame(): void` | Public API: Starts a new game round. Call this from a button's onTriggerUp (e.g. Start Game button). Enables game UI, resets timer and score, enables update loop. Does not auto-run on scene start. |
| `onPinched(): void` | Increments score when user pinches during an active game. |


## TopScoreRow

Import path: `SnapCloudExamples.lspkg/Example6-GlobalLeaderboard/Scripts/SupabaseLeaderboardService`. Source: [`Example6-GlobalLeaderboard/Scripts/SupabaseLeaderboardService.ts`](../Example6-GlobalLeaderboard/Scripts/SupabaseLeaderboardService.ts).

Exported data shape; fields shown below.

```text
export type TopScoreRow = {
  displayname: string;
  score: number;
};
```

## SupabaseLeaderboardService

Import path: `SnapCloudExamples.lspkg/Example6-GlobalLeaderboard/Scripts/SupabaseLeaderboardService`. Source: [`Example6-GlobalLeaderboard/Scripts/SupabaseLeaderboardService.ts`](../Example6-GlobalLeaderboard/Scripts/SupabaseLeaderboardService.ts).

Lazy init sets globalThis.supabaseModule=require("LensStudio:SupabaseModule"), creates client heartbeat2500. isReady means initialized+client, not auth. Missing config marks initialized=true, so assigning configuration later does not retry initialization. submitScore ensures session/auth then RPC submit_score(p_score,p_displayname,p_sort_mode). getTopScores initializes then calls get_top_scores(p_limit,p_sort_mode) without explicit auth. Result rows are asserted, not validated. Cleanup removes channels/nulls client without resetting initialized.

### Inspector inputs

A missing initializer means no source default: assign the required reference; only `@allowUndefined`/`?` inputs explicitly allow absence. Types/defaults are literal source declarations. Meanings are authored hints; behavior qualifications above take precedence.

| Input declaration / default | Meaning |
|---|---|
| `public snapCloudRequirements?: SnapCloudRequirements;` | Reference to SnapCloudRequirements for centralized Supabase configuration |
| `enableLogging: boolean = false;` | Enable general logging (RPC calls, auth flow, etc.) |
| `enableLoggingLifecycle: boolean = false;` | Enable lifecycle logging (onStart, cleanup, etc.) |

### Public members

Signatures are reference fragments, not standalone runnable scripts. Lifecycle methods should not be invoked repeatedly. No custom exported component event emitter is declared.

| Member | Contract / source description |
|---|---|
| `isConfigured(): boolean` | Public API: True when SnapCloudRequirements is wired and fully configured. Use this to decide whether to attempt RPCs. |
| `isReady(): boolean` | Public API: True after init() succeeded and client is set. |
| `isAuthed(): boolean` | Public API: True after ensureAuthed() has established a session. |
| `public async submitScore(score: number, displayname: string, sortMode: string): Promise<void>` | Public API: Calls submit_score RPC. Requires auth (ensureAuthed). sortMode: "asc" or "desc". |
| `public async getTopScores(limit: number, sortMode: string): Promise<TopScoreRow[]>` | Public API: Calls get_top_scores RPC. No auth required. sortMode: "asc" or "desc". |
