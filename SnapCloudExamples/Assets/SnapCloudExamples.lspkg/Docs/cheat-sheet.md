# SnapCloudExamples cheat sheet

[← Agent usage index](../README.md)

## Use when

Read first before enabling an example.

1. Assign a SupabaseProject asset on the prefab's `[SnapCloudRequirements]` (shipped empty); isConfigured only checks its presence, not URL/token/backend health. Until it's set, a red **Credentials needed** panel shows before the guide. → [Setup](setup.md)
2. Every example, media included, uses the one root `SnapCloudRequirements`; `Example5-Media/Scripts/SnapCloudRequirements` is a deprecated re-export. → [Core](components.md)
3. Starting components can authenticate/subscribe; RealtimeCursor begins broadcasting automatically. Guide visibility does not establish backend inactivity. → [Setup](setup.md)
4. TableConnector.testConnection is a write test, including sample inserts in three tables. → [Core](components.md)
5. StorageLoader uses public object URLs; private buckets require a different download contract. → [Setup](setup.md)
6. Share one CameraService for camera capture. It initializes on Start, so consumers must await readiness. → [Media](media.md)
7. Record/stream buttons trigger private implementations; there is no exported startRecording/startStreaming component API. → [Media](media.md)
8. Leaderboard ascending=true means lower scores rank first; choose descending for pinch totals. → [Leaderboard](leaderboard.md)
9. Examples 1–4 are the disabled children `Tables`, `Realtime Cursor`, `Storage` and `Edge Functions` of the `Get Started` panel. They are one-at-a-time alternatives: each listens to one button on the shared panel, so enable only the one you test. → [Troubleshooting](troubleshooting.md)
10. Keep `ImageBackground-CS` (CameraService) enabled on layer 2; disabling it leaves every capture without a camera. → [Media](media.md)
11. Most string inputs on the prefab are placeholders such as `YOUR BUCKET - TRY "specs-bucket"`; replace each with your real bucket, path, channel or function name before testing. → [Setup](setup.md#prefab-placeholder-values)
12. Backend SQL, Edge Function sources, mock data and web viewers ship in `ExternalServicesExamples/`; nothing there is deployed for you. → [Setup](setup.md#shipped-backend-and-viewer-samples-externalservicesexamples)
13. Source-only compilation is not evidence of auth, uploads, network viewers, device permissions or visual fit. → [Status](api-status.md)
