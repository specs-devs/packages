# Snap Cloud Examples

## What it is
A package of wired examples that show how a Specs Lens talks to a Snap Cloud backend: Snapchat sign-in, tables,
realtime broadcasts, storage downloads, edge functions, media capture and streaming, and a global leaderboard. Each
example is a component with Inspector wiring, grouped in one self-contained demo prefab. It is for developers learning
particular cloud operations; it is not a reusable SDK (use the SupabaseClient package for that).

## What it does
1. Drop `SnapCloudExamples__PLACE_IN_SCENE.prefab` into a Specs scene and assign your project asset on the root
   `[SnapCloudRequirements]` object (shipped empty). Until then a red "Credentials needed" panel appears before the guide.
2. The guide and example carousel step through the examples:
   - **Auth and tables** - `BasicAuth` signs in with the Snapchat provider; `TableConnector` reads and writes rows.
   - **Realtime cursor** - `RealtimeCursor` broadcasts or follows a cursor over a realtime channel, paired with a web
     cursor controller.
   - **Storage** - `StorageLoader` downloads 3D models, images and audio from public bucket URLs and places them.
   - **Edge functions** - `EdgeFunctionImgProcessing` sends an image URL to a function and shows the returned image.
   - **Media** - capture and upload images, video, audio or synchronized composites, or stream them live to web viewers.
   - **Global leaderboard** - a pinch game submits scores through RPCs and shows the top entries in pooled rows.
3. Examples 1-4 share the `Get Started` panel and are one-at-a-time alternatives; enable only the one you test.

## Highlights
- One shared `SnapCloudRequirements` provides the project to every example; the copy under `Example5-Media/Scripts/`
  is a deprecated re-export.
- `CompositeCameraWork/` holds the shared `CameraService` and composite render targets used by the media examples.
- Backend and browser counterparts (leaderboard SQL, edge function sources, mock data, web viewers, a cursor
  controller, a composite-stitcher service and guides) ship in `ExternalServicesExamples/`; nothing is deployed for you.
- Some actions have backend effects: `TableConnector.testConnection` inserts sample rows and `RealtimeCursor` starts
  broadcasting automatically.
- Leaderboard `ascending = true` ranks lower scores first; choose descending for pinch totals.

## Core scripts
| Script | What it does |
|---|---|
| `SnapCloudRequirements.ts` | Holds the project asset shared by every example and checks it is configured. |
| `Example1-AuthAndTables/BasicAuth.ts` | Creates the client and signs in with the Snapchat provider. |
| `Example1-AuthAndTables/TableConnector.ts` | Authenticates and runs table queries and inserts with UI feedback. |
| `Example2-RealTime/RealtimeCursor.ts` | Broadcasts or follows a cursor over a realtime channel. |
| `Example3-Storage/StorageLoader.ts` | Loads models, images and audio from public storage URLs. |
| `Example4-EdgeFunctions/EdgeFunctionImgProcessing.ts` | Calls an image-processing edge function and displays the result. |
| `Example5-Media/Scripts/CompositeCaptureUploader.ts` | Records synchronized video and audio, uploads them and triggers stitching. |
| `Example5-Media/Scripts/VideoStreamingController.ts` | Streams camera or composite frames live over realtime. |
| `CompositeCameraWork/Scripts/CameraService.ts` | Shared camera request and crop texture for the media examples. |
| `Example6-GlobalLeaderboard/Scripts/GlobalLeaderboard.ts` | Submits scores and renders the top entries. |

## Extra info
- **Requires:** InteractionKit, UIKit, SupabaseClient, Utilities, SnapDecorators, Motion, Icons. A configured Snap Cloud
  project (Window > Supabase > Import Credentials) plus the matching tables, buckets, functions and viewers from
  `ExternalServicesExamples/`. Without credentials the Lens Studio Preview only shows the UI, the camera and the cursor;
  auth, uploads, broadcasts and camera/microphone capture need a backend and Specs. Replace the placeholder bucket,
  path, channel and function strings on the prefab before testing.
- **Get started:** `SnapCloudExamples__PLACE_IN_SCENE.prefab`, then follow tutorial.md example by example.
- **More docs:**
  - [cheat-sheet.md](cheat-sheet.md) - wiring rules and actions with backend effects, read first.
  - [setup.md](setup.md) - project, schema, storage, function and viewer contracts.
  - [tutorial.md](tutorial.md) - end-to-end walkthrough of every example.
  - [components.md](components.md) - requirements, auth, tables, cursor, downloads and demo scaffolding.
  - [media.md](media.md) - capture and streaming components and shared utilities.
  - [leaderboard.md](leaderboard.md) - RPCs, rows, score ordering and the pinch game.
  - [examples.md](examples.md) - small compile-checked integrations.
  - [api-status.md](api-status.md) - current versus historical APIs and verification limits.
  - [troubleshooting.md](troubleshooting.md) - known limitations and pending QA.
