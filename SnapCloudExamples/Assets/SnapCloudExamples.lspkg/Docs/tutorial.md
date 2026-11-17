# SnapCloudExamples tutorial

[← Agent usage index](../README.md)

## Use when

Read for an end-to-end walkthrough: what each example does when you press its button, and which backend piece (from `ExternalServicesExamples/`) it needs. Exact inputs, defaults and public methods are in [components](components.md), [media](media.md) and [leaderboard](leaderboard.md); backend contracts in [setup](setup.md).

## Revision note

This page replaces an older long tutorial whose code sketches did not match the shipped scripts (a `messages` table, realtime table subscriptions in TableConnector, storage uploads and bucket listing in StorageLoader, base64 bodies via `functions.invoke` in EdgeFunctionImgProcessing, and AudioCaptureModule/VideoCaptureModule capture). None of those exist in the package. Everything below is taken from the shipped scripts and prefab; backend and device behavior is not verified (see [troubleshooting](troubleshooting.md)).

## 1. Project and credentials

1. Create a Snap Cloud (Supabase) project, then in Lens Studio use Window > Supabase > Import Credentials to create a SupabaseProject asset.
2. Drop `SnapCloudExamples__PLACE_IN_SCENE.prefab` into the scene and assign the asset on `[SnapCloudRequirements]`. Every example reads the project from there. Until it is set, the red Credentials needed panel shows before the guide.
3. Replace the placeholder strings on the prefab (bucket, paths, channel and function names): [setup](setup.md#prefab-placeholder-values).

All clients are created with `createClient(url, publicToken, {realtime: {heartbeatIntervalMs: 2500}})` and sign in with `auth.signInWithIdToken({provider: "snapchat", token: ""})`, the Lens adapter flow from SupabaseClient. The service-role key never goes into the Lens.

## 2. Get Started panel (examples 1–4)

`Get Started` holds four disabled children; enable one at a time (the carousel steps through them).

| Child | Script | On Awake/Start | On its panel button |
|---|---|---|---|
| `Tables` | TableConnector | Creates the client and signs in | `ButtonTable` → `retrieveLatestData()`: reads a few rows from `test_table`, `user_interactions`, `user_preferences` (no ordering) |
| `Realtime Cursor` | RealtimeCursor | Signs in, joins channel `cursor-<channelName>`, starts broadcasting the arrow cursor's position (`cursor-move`) | `ButtonRealTime` toggles broadcast / follow; follow moves the cursor from `pc_` senders only |
| `Storage` | StorageLoader | Builds the public storage base URL | `ButtonStorage` → `loadAllAssets()`: downloads the glTF, image and audio from `<project>/storage/v1/object/public/<bucket>/<path>` through RemoteMediaModule; no uploads |
| `Edge Functions` | EdgeFunctionImgProcessing | Configures the request | `ButtonEdgeFunctions` → POSTs `{imageUrl}` to `<project>/functions/v1/<functionName>` with the public-token headers, then downloads and shows `processedUrl` |

Backend for each:

- Tables: create `test_table` (message, sender, timestamp, lens_session_id), `user_interactions` and `user_preferences`; import the mock CSVs from `ExternalServicesExamples/example-1to4-mockup-data/testData-ADD TO TABLES/` (there is no `test_table` CSV). `testConnection()` is a separate public method that also inserts sample rows; nothing in the prefab calls it.
- Realtime: no table needed (optional `cursor_debug` receives a debug row every 50 broadcasts). To drive or watch the cursor from a browser, serve `ExternalServicesExamples/realtime-example-web-cursor-controller/` and enter the same channel name.
- Storage: create a public bucket and upload `ExternalServicesExamples/example-1to4-mockup-data/testAssets-ADD TO STORAGE BUCKET/` (`rabbit.glb`, `glasses.jpg`, `chill.mp3`) under the paths you enter in StorageLoader.
- Edge Functions: deploy `ExternalServicesExamples/example-1to4-mockup-data/testEdgeFunction-ADD TO EDGE FUNCTION CODE/index.txt` as the function. It downloads the image, re-stores it unchanged in `specs-bucket/images/` and returns the public URL; it does no image processing. Set `imageUrl` to a public image.

`BasicAuth` (same folder as TableConnector) is the minimal sign-in-only script; it is not placed in the prefab.

## 3. Media Suite (example 5)

`Media Suite` switches five sections with its side bar (UISectionManager): Image, Video, Audio, Composite, Sharing. All capture uses the one shared CameraService in `[CompositeImage]` ([media](media.md#cameraservice)).

| Section | Storage upload | Live stream (Realtime broadcast) | Receiver that ships |
|---|---|---|---|
| Image | ImageCaptureUploader: JPEG to `images/…` (still HD capture on device only) | none | none needed |
| Video | VideoCaptureUploader: JPEG frames to `frames/<session>/` | VideoStreamingController: `video-frame` on `live-video-stream` | `media-example-web-viewers/video-stream-viewer.html` |
| Audio | AudioCaptureUploader: WAV chunks to `audio-recordings/<session>/` (default `storageFolder`) | AudioStreamingController: `audio-chunk` on `live-audio-stream` | `media-example-web-viewers/audio-stream-listener.html` |
| Composite | CompositeCaptureUploader: frames, WAV audio and metadata, then POST `trigger-composite-stitch` | CompositeStreamingController: `composite-video-frame` / `composite-audio-chunk` on `composite-live-stream` | `media-example-web-viewers/composite-stream-viewer.html` |
| Sharing | CompositeCaptureUploader with `shareToSpotlight` and a caption | none | the stitcher below |

Backend: a storage bucket (prefab suggests `specs-bucket`). For stitching, deploy `media-example-server-composite-stitcher-edge-function/supabase-edge-function.txt` as `trigger-composite-stitch` and run `media-example-server-composite-stitcher/` (Node + ffmpeg) where the function's `STITCHER_SERVICE_URL` can reach it; see `ExternalServicesExamples/_guides/complete-setup-guide.md`. Spotlight posting in that sample goes through a third-party API and is optional.

## 4. Global Leaderboard (example 6)

1. Run `ExternalServicesExamples/global-leaderboard-sql-query/global-leaderboard-sql.sql` once (table, `submit_score`, `get_top_scores`, `leaderboard_healthcheck`); guide: `ExternalServicesExamples/_guides/global-leaderboard-guide.md`.
2. In the Lens, press Start on the `Example - TapGame` panel, tap the button until the countdown ends; PinchGameController submits the score through GlobalLeaderboard → SupabaseLeaderboardService (`submit_score`, signed in) and refreshes the list (`get_top_scores`, public).
3. `GlobalLeaderboard.ascending` defaults to true (lower scores first) and the prefab keeps true; set it false so the highest tap total ranks first. Rows are pooled by LeaderboardRowInstantiator from `Prefabs/ScrollViewListItem.prefab`. Details: [leaderboard](leaderboard.md).

## 5. Check it

Follow the Verification list in the [README](../README.md#verification). Without a backend you can check the credentials panel, the carousel, the cursor drag, the media tabs and the leaderboard countdown; everything that talks to Snap Cloud needs a configured project.
