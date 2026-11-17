# RemoteServiceGateway troubleshooting

[← Agent usage index](../README.md)

## Use when

Use when a request, provider view or realtime example fails. Findings below distinguish source fixes in this revision from checks that require real gateway credentials or a device.

## Requests and credentials

| Symptom | Cause | Fix or next check |
|---|---|---|
| A red "Credentials needed" panel appears before the guide | `CredentialsWarning` found a Snap, OpenAI or Google token still empty or a `[INSERT …]` placeholder on `RemoteServiceGatewayCredentials` | Expected on a fresh install. Set the listed tokens (see [setup](setup.md#2-put-the-tokens-in-the-lens)), or press "Continue without credentials" to look at the demo; calls that need a missing token will error. |
| Every call errors in Lens Studio | My Lenses sign-in or valid gateway tokens are absent | Follow [setup](setup.md); placeholders do not authorize calls. Offline demo QA only verifies layout and error-free startup. |
| OpenAI/Google calls ignore `setApiToken` | Older code only stored Snap's token | This revision handles all three enum cases. Verify the installed build's [API status](api-status.md). |
| A configured static token changes at startup | A credentials component later runs `onAwake` | Call setters after that awake, or configure the component inputs; see [credential lifecycle](setup.md#2-put-the-tokens-in-the-lens). |
| Module import fails before the call | A `requireAsset` service module path is missing or renamed | Preserve the package's folder structure and consult the [service-asset table](setup.md#4-remote-service-module-assets). |
| A copied README recipe does not compile | Older docs used incorrect import/member/request names | Use the corrected [examples](examples.md) and [removed-name table](api-status.md#names-that-never-existed-from-the-old-readme). |
| Image editing fails or uses no source image | Demo base/mask asset references do not resolve | Assign valid base and mask textures before enabling editing. `Uint8Array[]` is accepted by the type but not encoded as a file array by this revision. |
| Snap3D polling is too frequent or never finishes without refinement | Poll interval units and completion condition in the source | See [known gaps](api-status.md#known-gaps); do not treat `refine: false` as a verified completion path. |
| Only the first Lyria track runs | Older example left `isGeneratingMusic` true after success | Fixed here: the flag clears on both success and error. Live generation still needs credentialed QA. |
| Lyria plays nothing | `generateMusicOnTap` ("Run in demo") off, or `playAudioOnTap` ("Play generated audio") off | Both are on in the prefab. The request itself takes a while: the log panel shows "lyria-002 music → request sent" until it answers. |
| A step's log says "token missing" | The token for that provider is empty or a `[INSERT …]` placeholder | Set it on `RemoteServiceGatewayCredentials`. The step does nothing else until then. |
| The log shows "Proxy error: token is not valid" | The gateway rejected the token | Check the token and the My Lenses sign-in (Preview). |
| The Lens crashes on Specs right after an image is generated ("global command buffer disabled") | Two `Base64.encodeTextureAsync` calls ran at the same time (for example `Promise.all` over the edit base and mask) | Encode one texture at a time, as the demo does. Verified on device with Lens Studio 5.25. |
| The first request right after the Lens starts fails in under a second with no details | The gateway was not ready yet | The demo retries a sub-second failure once after 1.5 s; do the same in your Lens. |

## Demo and realtime flows

| Symptom | Cause | Fix or next check |
|---|---|---|
| A step runs again when you come back to it | Each step starts its demo whenever it is shown | Expected. Requests already sent by a step you left still complete server-side; their answers are ignored. |
| Realtime audio echoes in the editor | Mic and speakers are both live | Use headphones in Lens Studio. |
| A session or microphone stays active after UI is hidden | Only the demo examples close their session on disable | The demo realtime examples stop the mic, the audio output and the socket when their step is left (`stopDemo()`). Do the same in your own flow. |
| Guide binds to an old package script | Old package bundled a same-named GuideDismissPanel | This revision removes that unused script and orphan prefab component; demo guides belong to the project. |
| Nested realtime content appears above the field of view | An old project carousel moved the listed parent before reading its listed child's pose | Use the updated project carousel, which snapshots every pose before moving any example. This is a demo-project fix. |

## Verification limits

The seven auto-run steps were checked in Lens Studio 5.25 Preview without real tokens: each step started its own demo when shown, stopped when left (late responses ignored, sockets closed), and the log panel showed the missing-token lines and, with an invalid token, every request and its gateway error. No real model answer, generation, live voice conversation or microphone/playback result was confirmed. Provider model availability and quota are external to this package.
