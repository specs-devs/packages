# SnapCloudExamples API status

[← Agent usage index](../README.md)

## Use when

Read before using a tutorial method or assuming a live capability.

The package and Lens Studio versions are in `package.native`. Public signatures below come from source, including public lifecycle hooks which the engine should invoke once.

| Status | Surface | Evidence / limit |
|---|---|---|
| Current | SnapCloudRequirements (one class, package root), BasicAuth, TableConnector, RealtimeCursor, StorageLoader, EdgeFunctionImgProcessing | Root/core paths in components index. |
| Current | Demo scaffolding: ExampleCarousel, GuideDismissPanel, CredentialsWarning | Components index, Demo scaffolding. |
| Current | CameraService, seven capture/stream controllers, UISectionManager, four utility classes | Media index; private record/stream callbacks are not public methods. |
| Current | Five leaderboard components and TopScoreRow/LeaderboardEntryUI types | Leaderboard index. |
| Experimental | Media broadcast protocols, composite stitching/Spotlight request | Receivers and the stitcher ship as samples in `ExternalServicesExamples/` (see [setup](setup.md#shipped-backend-and-viewer-samples-externalservicesexamples)); you deploy them yourself. No end-to-end verification. |
| Deprecated | `Example5-Media/Scripts/SnapCloudRequirements` (now a re-export of the root class); `BasicAuth.supabaseProject` (fallback when `snapCloudRequirements` isn't wired) | Kept so existing imports and wiring keep working. |
| Removed | None established by this pass | Older tutorial sketches differ from installed classes; not evidence of historical removal. |

AudioCaptureUtility.stopRecording() returns boolean, and its byte buffer (getAndClearAudioBuffer) is raw Float32 PCM, not WAV. The earlier long tutorial's code sketches (a `messages` table, storage uploads and realtime table subscriptions in the core examples, AudioCaptureModule/VideoCaptureModule) did not match the shipped scripts and were removed; [tutorial](tutorial.md) now describes only shipped behavior. Runnable snippets live in examples.md.

Static snippets were checked against the installed ambient declarations and available dependency cache. Existing source casts/any are recorded rather than copied into new examples.

Source fixes (2026-10-01 QA pass): RealtimeCursor shows/hides its cursor object with its own enabled state; the main prefab's cursor mesh/material and outline material point at existing assets again; `ImageBackground-CS` (the CameraService host) is enabled on layer 2 again. The project compiles clean and the Preview checks listed in [troubleshooting](troubleshooting.md) pass offline; backend and device behavior is not verified.
