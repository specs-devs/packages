# SnapCloudSocialMedia troubleshooting

[← Agent usage index](../README.md)

## Use when

Read this when the panel doesn't appear or looks wrong, a status message reports a problem, or
a share didn't land. Symptoms → cause → fix, for this installed revision.

## Panel and Preview

| Symptom | Cause | Fix |
|---|---|---|
| No panel; log shows `Input configAsset was not provided for the object Snap Cloud Social Media` | The instance's `configAsset` (and often `microphone`) were cleared. Seen after a scene re-save in Lens Studio, where the instance fell back to empty defaults although the prefab still had them. Or the component was created with `createComponent`. | Re-assign **Config Asset** = `social.config` and **Microphone** = `Microphone Audio` on the instance, then save. Use the prefab, not `createComponent`. |
| No panel; log: `[Snap Cloud Social Media] …` at start (e.g. `Configure HTTPS proxy, Snap Cloud URL and publishable key`, `Keep private credentials in proxy.config.json on the server`, `Capture limits: 1–12 FPS and 1–15 seconds`) | `parseConfig` rejected the JSON in `onAwake` (schema, limits, https/key with demo off, secret-like key) | Fix the reported field ([components](components.md#config-schema-socialconfig-schemaversion-1)), then restart the Preview |
| All panel rows collapsed into one row at the top; every row object sits at (0, 0); no errors | The current SIK `ReplayEvent.invoke` calls handlers **before** buffering the value. A handler added during that invoke (`layout.onInitialized.add(...)` from inside the same layout's `onInitialized` callback) never runs, so `addItems` never ran and the layout had 0 items. It worked on older SIK releases. | Fixed in this revision: `SocialPanel.child()` calls `layout.addItems([item])` directly. Every caller already runs inside the parent's `onInitialized`. Apply the same pattern in custom panels, or set `autoDiscoverItemsOnStart = false` at creation. |
| Compile error `Property 'contentAlignment' does not exist on type 'ElementContent'` | UIKit renamed it | `content.textAlignment = TextAlignment.Left` / `Center` (import `TextAlignment` from `UIKit.lspkg/Scripts/Components/Content/ElementContent`). Fixed here. |
| Turning a destination **off** didn't lower the share count | UIKit `Switch.onFinished` passes the *explicit* flag (always `true` for a user tap), not the on/off state | Read `toggle.isOn` in the handler. Fixed here. |
| Panel or carousel/other UI overlap; bottom rows hidden behind other content | The panel is ~44 × 75 cm. At 110 cm it fills the ±18° vertical field of view. | Move the `Snap Cloud Social Media` object farther (the prefab uses (0, 6, −160)) or lower `panelWidth`. Keep other panels below or beside it. |
| Preview agent can't pinch or poke any button (timeouts) on an old project | Project still on an older SIK (for example `SIK Version : 0.18.0` in the log). The preview tooling drives current SIK hands. | Use the InteractionKit and UIKit declared in `package_dependencies.json`. |
| Text looks tiny or wraps oddly | Theme font metrics differ | Adjust `fontScale` (0.8–1.4) |

## Status messages

| Status | Cause | Fix |
|---|---|---|
| `Camera is not ready` | Camera texture still 0×0 when Record was pressed | Wait a moment and record again. On device, check camera permission. |
| `Record a longer clip` | Fewer than 2 frames captured | Record longer, or raise `capture.fps` |
| `Frame capture failed. Record again.` | JPEG encoding of a frame failed | Record again |
| `Assign a microphone audio track or disable Include microphone` | `includeAudio` is true and `microphone` is empty | Assign `Microphone Audio` or turn the microphone off |
| `No microphone samples captured…` | Microphone produced no samples (not in demo mode) | Check microphone access, or disable Include microphone |
| `Capture a photo or record a clip first` | Share without media | Record or take a photo first |
| `Choose compatible media formats for <Provider>` | A photo with a video format, or a video with `photo` | Change that provider's format, or disable it |
| `Enable at least one destination` | Every switch is off | Turn one on |
| `Connect <Provider> in the editor plugin` | An enabled provider isn't connected for this Snap Cloud user | Connect it in the editor panel, then press **Refresh connections** |
| `Select TikTok, then choose privacy before sharing` | TikTok Direct Post without a privacy level | Select TikTok, then cycle the delivery button to a privacy level |
| `Snap Cloud sign-in failed…` / `Sign in to Snap Cloud again` | Snap Cloud auth failed or the session expired | Check the project URL/publishable key and that the wearer can access the project |
| `Finish the current upload before recording again` | A job is still being polled | Wait for the job to finish |
| `Waiting for connection · job remains saved on server` | Polling failed (network) | The job keeps running server-side; polling retries every 2 s |
| `Delivery uncertain · inspect your accounts before posting again` | The job ended `unknown` (timeout or ambiguous provider reply, or stuck for 10 min) | Check each account manually. The proxy never retries automatically. |

## Proxy and providers

| Symptom | Cause | Fix |
|---|---|---|
| `Install ffmpeg on the proxy host` / `Install ffprobe…` | Encoder missing | Install both on the proxy host |
| `Please wait before retrying` (429) | More than 120 requests per user per minute | Slow down |
| `Choose portrait recording for this destination` | Reel, Story, Short or Spotlight with landscape/square media | Set `capture.aspect` to `portrait` |
| `Record at least 6 seconds for Spotlight or 5 for Story` | Snapchat minimum duration | Record longer |
| `<Provider> caption exceeds N characters` | Caption limits: X 280, Threads 500, Snapchat 160, Instagram/TikTok 2200, LinkedIn 3000, YouTube 5000 | Shorten the caption |
| Stored connections stop working after a restart | `TOKEN_ENCRYPTION_KEY` changed | Restore the original key, or reconnect every account |
| OAuth finishes but the account stays "Not connected" | Wrong redirect URI or missing scopes in the provider app, or the panel wasn't refreshed | Register `https://YOUR_PROXY/oauth/<provider>/callback`, check scopes, press **Refresh account connections** |
| Connections from the editor don't show on device | Editor account and wearer resolve to different Snap Cloud users | Use the same Snap identity on both |

## Known gaps (not verified in this revision)

- On-device recording, Transparent Permission prompts for camera + internet, and microphone
  capture.
- Live posting with registered provider apps, TikTok Direct Post, and Snapchat Public Profile
  allowlisting.
- Native `.lspkg` export/reimport in a clean consumer project.
- `Editor/verify-assets.py` reports two unresolved SIK hand-mesh material references (the
  `HandMeshIndexThumb` objects) in the example `Scene.scene`. The current SIK build doesn't
  ship those older material ids. Sibling projects on the same SIK have the same references. It's
  outside this package's source.
