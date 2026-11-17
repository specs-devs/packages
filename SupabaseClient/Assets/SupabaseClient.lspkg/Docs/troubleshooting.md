# SupabaseClient troubleshooting

[← Agent usage index](../README.md)

## Use when

Read when declarations compile but Lens/backend behavior differs.

| Symptom | Source-derived cause / action |
|---|---|
| Helper declared but signInWithSnapchat absent at runtime | Use exported createClient factory; direct constructor bypasses helper assignment. |
| Module import fails outside Lens | Bundle requires LensStudio:SupabaseModule/native Request/global scene and installs globals/timer object. |
| Separate polyfills import resolves TS but not runtime | Loose paths have .d.ts only; use main bundle/exports rather than direct JS imports. |
| Query mutation data null | Mutation defaults return minimal; add .select() for returned rows and inspect error first. |
| getPublicUrl points to inaccessible file | URL generation is local; bucket/policy/object/backend must permit public download. |
| HEAD count downloads a row | Adapter falls back GET with Range0–0 when native HEAD absent. |
| AbortSignal/timeouts do not cancel native request | Adapter stores signal but does not forward it to native request. |
| Multipart form fields lost | Adapter handles only Blob at empty key; general multipart not serialized. |
| Binary upload corruption | Prefer supported Uint8Array; ArrayBuffer path is decoded as text. |
| Auth session missing after relaunch | Supplied/localStorage/memory selection; default persistSession flag does not prove native secure persistence. |
| WebSocket listeners replace each other | Polyfill one handler per event type; cannot assume browser multiple-listener behavior. |
| `TypeError: Cannot read property 'url' of undefined` at `onAwake` (unhandled promise rejection) | The `SupabaseProject` input is empty. Mark it `@allowUndefined` and return early with a message when it is not set (see [Examples](examples.md)). |
| `SupabaseProject` url/publicToken access throws in Preview | The demo's realtime script treats this as "fields blocked by platform, only works on a paired device"; wrap the access in try/catch. Not reproduced in the 2026-10-01 pass (no project assigned). |
| SIK `Cannot read property 'isSame' of null` / `HandInteractor … Component is not yet awake`, "Rendering failed 5 times" | Not this package: the scene camera's Render Target was dangling (the demo project had it; fixed 2026-10-01). Point the Camera and the scene Render Output at a real Render Target and add Device Tracking (World). |
| Red "Credentials needed" panel before the guide | `CredentialsWarning`: no SupabaseProject on the prefab's `SnapCloudRequirements` object (the prefab ships without one). Window > Supabase > Import Credentials, assign it on `SnapCloudRequirements`; the panel then no longer appears. "Continue without credentials" runs the demo; the examples stop at their guard message. No Remote Service Gateway tokens are checked (not used). See [Setup](setup.md). |
| Callback continues after component destruction | Retain and clear timer tokens/subscriptions/channels; package has no app controller teardown. |

Verified in the Preview (2026-10-01): the bundle imports and the demo project runs without errors; with no Supabase Project assigned both demo tests stop at their guard message. Not verified: transport, auth/session persistence, Storage binary round-trips, functions, realtime, RLS and device behavior (needs a test Snap Cloud project and a paired device).
