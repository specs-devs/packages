# SnapCloudExamples setup and backend contracts

[← Agent usage index](../README.md)

## Use when

Read before enabling configured components or invoking a network operation.

## Credentials and the warning

The shipped prefab carries no credentials: `[SnapCloudRequirements].supabaseProject` is empty. Assign your SupabaseProject there (Window > Supabase > Import Credentials creates the asset); every example reads it through its `snapCloudRequirements` input. No example uses Remote Service Gateway, so no RSG tokens are needed.

While the project is missing, a red-framed **Credentials needed** panel (`CredentialsWarning`) appears before the "Ok, I understood" guide and lists what's missing; "Continue without credentials" closes it and the guide follows. With the project assigned, the warning turns itself off and the guide shows directly. Prefab child order matters: `[SnapCloudRequirements]` (resolves its state on awake), then `CredentialsWarning`, then `Guide`.

## Configuration and lifecycle

Create/select SupabaseProject in Snap Cloud dashboard and bind its URL/public token asset, not a service-role secret. One `SnapCloudRequirements` (package root) serves every example: examples 1–4, media and leaderboard all read the project from the prefab's `[SnapCloudRequirements]` object (`Example5-Media/Scripts/SnapCloudRequirements` is now a deprecated re-export of the same class). Presence alone sets isConfigured; verify credentials, RLS, functions and storage separately. Many components authenticate on Start; realtime components subscribe even before a recording button. RealtimeCursor starts broadcasts after initialization. Keep backend components disabled for local-only inspection.

Empty token with provider snapchat is the Lens adapter authentication flow from SupabaseClient; do not copy it to browser SDK code. Core clients use 2500ms heartbeat workaround. Headers built directly by requirements/edge functions carry public token, not user's access token. Backend policy determines access. Source TableConnector logs full user/session when logging enabled; do not export such logs with credentials.

## Tables and RPCs

| Source action | Required backend |
|---|---|
| TableConnector | `test_table` message/sender/timestamp/lens_session_id; `user_interactions` action/data/timestamp/session_id; `user_preferences` user_id/preferences/updated_at. Policies must permit intended operations. `testConnection` writes samples. Mock rows for `user_interactions` and `user_preferences` ship in `ExternalServicesExamples/example-1to4-mockup-data/testData-ADD TO TABLES/`; no `test_table` CSV ships, so create that table yourself. |
| RealtimeCursor periodic debug | `cursor_debug` user_id/x/y/timestamp/channel_name (best-effort inserts every 50 broadcasts). Mock rows: `testData-ADD TO TABLES/cursor_debug.csv`. |
| Leaderboard | RPC `submit_score(p_score,p_displayname,p_sort_mode)` authenticated; `get_top_scores(p_limit,p_sort_mode)` returns displayname/score. The SQL ships: run `ExternalServicesExamples/global-leaderboard-sql-query/global-leaderboard-sql.sql` once in the SQL editor (creates `game_leaderboard_scores` with RLS and no direct table grants, the two RPCs and `leaderboard_healthcheck()`; `submit_score` is granted to `authenticated`, `get_top_scores` and the health check to `anon` and `authenticated`). Walkthrough: `ExternalServicesExamples/_guides/global-leaderboard-guide.md`. |

## Storage and functions

StorageLoader composes `<project>/storage/v1/object/public/<bucket>/<path>`. Script defaults are fox/scene.gltf, images/spectacles.jpg, audio/chill.mp3; the prefab overrides them with placeholders (see below). Make the bucket public or change the implementation. Mock files ship in `ExternalServicesExamples/example-1to4-mockup-data/testAssets-ADD TO STORAGE BUCKET/` (`rabbit.glb`, `glasses.jpg`, `chill.mp3`); they do not match the image default, so upload them under the paths you set (e.g. `models/rabbit.glb`, `images/glasses.jpg`, `audio/chill.mp3`) and enter those paths. Associated glTF resources must be downloadable. Image/audio/material/Camera Inspector refs still need assignment. Model units convert meters to cm; parent is script scene object.

Media bucket defaults `specs-bucket`. Image uploads use images/unique.jpg; VideoCaptureUploader frames frames/session/frame_00000.jpg; audio capture emits WAV whereas AudioCaptureUtility emits raw Float32 `.raw`. Composite capture emits configurable video/audio folders plus metadata/session/{session_info,final_stats}.json, then POSTs `trigger-composite-stitch`. That function receives session/bucket/frameRate/sampleRate/folders, totalFrames/totalAudioChunks/chunkDurationMs/audioDurationMs/recordingDurationMs/imageFormat/useVerticalCrop/shareToSpotlight/spotlightCaption and must return JSON success/error. Sample sources for it and for the stitching service ship in `ExternalServicesExamples/` (below); the package does not deploy them or publish to Spotlight itself.

EdgeFunctionImgProcessing posts {imageUrl} to configured functionName; expects success+processedUrl and operations array (plus sizes/storagePath for logs). Processed URL must be downloadable as image. A matching function ships as `ExternalServicesExamples/example-1to4-mockup-data/testEdgeFunction-ADD TO EDGE FUNCTION CODE/index.txt` (paste as the function's `index.ts`): it downloads `imageUrl`, re-uploads it unchanged to `specs-bucket/images/processed_<ts>.jpg` with the service-role key from the function environment, and returns `success`, `processedUrl`, `operations: ["downloaded","stored"]`, sizes and `storagePath`. It does no actual image processing.

## Streaming receiver contract

Realtime channels are independent of storage. RealtimeCursor channel is `cursor-<channelName>` and follow filters user_id prefix pc_. Video uses video-frame (Base64 JPEG frameData), audio audio-chunk (Base64 WAV data), composite composite-video-frame/composite-audio-chunk plus their start/init/end events. Browser receivers for these payloads ship in `ExternalServicesExamples/` (below); for anything else, build a receiver for the exact payload fields in source. Channel membership/status is not durable state, delivery/throughput/permissions must be tested.

## Prefab placeholder values

The main prefab ships these string inputs as instructions, not working values. Replace each before testing (some include quotes or a trailing space):

| Component (prefab) | Input | Shipped value |
|---|---|---|
| StorageLoader | `storageBucket` | `YOUR BUCKET NAME - TRY "specs-bucket"` |
| StorageLoader | `modelFileName` / `imageFileName` / `audioFileName` | `YOUR PATH - TRY "models/rabbit.glb" ` / `YOUR PATH - TRY "images/spectacles.jpg"` / `YOUR PATH - TRY "audio/chill.mp3"` |
| EdgeFunctionImgProcessing | `functionName` / `imageUrl` | `YOUR EDGE FUNCTION - TRY "specs-function"` / `[FUNCTION ENDPOINT HERE]` (set a public image URL) |
| RealtimeCursor | `channelName` | `YOUR CHANNEL NAME - TRY "spectacles-demo-channel"` |
| VideoCaptureUploader, AudioCaptureUploader, both CompositeCaptureUploader copies | `storageBucket` | `YOUR BUCKET - TRY "specs-bucket"` or `YOUR BUCKET NAME - TRY "specs-bucket"` |
| ImageCaptureUploader | `storageBucket` | `specs-bucket` (usable as is if that bucket exists) |
| AudioStreamingController / VideoStreamingController / CompositeStreamingController | `streamingChannelName` | `YOUR CHANNEL NAME - TRY "live-audio-stream"` / `... "live-video-stream" ` / `... - "composite-live-stream"` |

The suggested channel names match the defaults in the shipped web viewers.

## Shipped backend and viewer samples (`ExternalServicesExamples/`)

Everything under `SnapCloudExamples.lspkg/ExternalServicesExamples/` is a counterpart that runs outside the Lens: SQL, Edge Function code, mock data, browser pages and a Node service. No Lens component references these files. Lens Studio imports the `.js` files as JavaScript assets, so copy a folder out of the project before running or deploying it. None of it is deployed for you, and none of it has been verified end to end in this package.

| Path | What it is | Pairs with |
|---|---|---|
| `global-leaderboard-sql-query/global-leaderboard-sql.sql` | Table `game_leaderboard_scores`, RPCs `submit_score(p_score,p_displayname,p_sort_mode)`, `get_top_scores(p_limit,p_sort_mode)`, `leaderboard_healthcheck()`, RLS and grants | SupabaseLeaderboardService / GlobalLeaderboard ([leaderboard](leaderboard.md)) |
| `example-1to4-mockup-data/testData-ADD TO TABLES/` | `user_preferences.csv`, `user_interactions.csv`, `cursor_debug.csv` rows to import into tables of the same name | TableConnector, RealtimeCursor debug inserts |
| `example-1to4-mockup-data/testAssets-ADD TO STORAGE BUCKET/` | `rabbit.glb`, `glasses.jpg`, `chill.mp3` to upload to a public bucket | StorageLoader |
| `example-1to4-mockup-data/testEdgeFunction-ADD TO EDGE FUNCTION CODE/index.txt` | Deno Edge Function: download `imageUrl`, re-store it, return `processedUrl` (see above) | EdgeFunctionImgProcessing |
| `realtime-example-web-cursor-controller/` | `index.html` + `supabase-client.js` (+ `package.json`, `npm start` serves it with `http-server`). Joins `cursor-<channel>` with a `pc_` user id, sends `cursor-move` broadcasts and listens for the Lens's `cursor-move` (`spectacles_` ids) and `control-mode` | RealtimeCursor (follow mode moves the Lens cursor from the page; enter the same channel name, without the `cursor-` prefix) |
| `media-example-web-viewers/video-stream-viewer.html` | Browser viewer for `stream-init`/`stream-started`/`video-frame`/`stream-ended`; default channel `live-video-stream` | VideoStreamingController |
| `media-example-web-viewers/audio-stream-listener.html` | Browser player for `audio-chunk`; default channel `live-audio-stream`. Its start/end log handlers use `stream-started`/`stream-ended`, while the Lens sends `audio-stream-started`/`audio-stream-ended` | AudioStreamingController |
| `media-example-web-viewers/composite-stream-viewer.html` | Browser viewer for `composite-stream-init`/`-started`/`composite-video-frame`/`composite-audio-chunk`/`composite-stream-ended`; default channel `composite-live-stream` | CompositeStreamingController |
| `media-example-server-composite-stitcher-edge-function/supabase-edge-function.txt` | Source for the `trigger-composite-stitch` Edge Function: forwards the request to `<STITCHER_SERVICE_URL>/stitch` and returns its JSON | CompositeCaptureUploader (POSTs to `/functions/v1/trigger-composite-stitch`) |
| `media-example-server-composite-stitcher/` | Node 20 + Express + ffmpeg service (`index.js`, `package.json`, `env.template`, `test-local.js`, plus `railway.json`/`nixpacks.toml` deploy descriptors). Endpoints `GET /health`, `GET /debug/storage/:bucket`, `POST /stitch`; reads frames/audio from storage with `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`, writes the stitched video to `composite-stitched/` by default, optional 9:16 crop; Spotlight posting only through the third-party Ayrshare API when `AYRSHARE_API_KEY` is set | The Edge Function above |
| `_guides/` | `complete-setup-guide.md` (composite stitching end to end), `supabase-edge-function-guide.md`, `railway-guide.md` (stitcher deploy descriptors), `global-leaderboard-guide.md` | The rows above |

Keep the service-role key on the server side (Edge Function environment or the stitcher's environment); the Lens only ever uses the public token. Host the stitcher on infrastructure your organization approves.

## Prefabs and proposed live layout

Paths under `SnapCloudExamples.lspkg/`: main `SnapCloudExamples__PLACE_IN_SCENE.prefab`, shared camera `CompositeCameraWork/SnapCloudExamples_CompositeImage__PLACE_IN_SCENE.prefab`, row `Example6-GlobalLeaderboard/Prefabs/ScrollViewListItem.prefab`, leaderboard `Example6-GlobalLeaderboard/Prefabs/GlobalLeaderboard.prefab`. Scene Inspector bindings and dependency refs need a live resolved check.

The main prefab holds three panels side by side at z −90 (Get Started at x 0, Media Suite at x 42, Global Leaderboard at x −36) and the ReminderHint 40 cm in front of the origin (ships disabled and not wired to SnapCloudRequirements; see [Troubleshooting](troubleshooting.md)). Examples 1–4 are disabled children of the Get Started panel; enable one at a time. The media panel switches its five sections itself (UISectionManager). The prefab also carries the demo scaffolding: `[SnapCloudRequirements]`, `CredentialsWarning`, `Guide` and `ExampleCarousel` (see [Core components](components.md#demo-scaffolding-example)).
