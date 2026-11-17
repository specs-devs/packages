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
| Lyria does nothing on a tap | Its event registration checks `playAudioOnTap`, but generation checks `generateMusicOnTap` | In this revision enable both demo flags when testing generation. The two flag names do not represent independent event bindings. |

## Demo and realtime flows

| Symptom | Cause | Fix or next check |
|---|---|---|
| Hidden providers run on a right-hand pinch | GestureModule delivers global pinch events to registered handlers | The eight call-example scripts now return when their SceneObject is disabled in the hierarchy. |
| Navigating the carousel also calls the visible provider | Its global pinch handler sees the navigation pinch too | Known open issue. Check on device; the visibility guard only suppresses hidden examples. |
| A realtime view shows “Websocket connected” without a working session | Initial label reports internet availability | Verify actual `onOpen` / `onMessage` / `onError` / `onClose` events; the label alone is not connection evidence. |
| A session or microphone stays active after UI is hidden | Demo startup does not implement full disable cleanup | When integrating, retain the socket, stop microphone recording and close the socket when leaving your flow. |
| Guide binds to an old package script | Old package bundled a same-named GuideDismissPanel | This revision removes that unused script and orphan prefab component; demo guides belong to the project. |
| Nested realtime content appears above the field of view | An old project carousel moved the listed parent before reading its listed child's pose | Use the updated project carousel, which snapshots every pose before moving any example. This is a demo-project fix. |

## Verification limits

The six provider views and navigation layout were checked without a signed-in My Lenses account. No real model request, generation, live voice conversation or microphone/playback result was confirmed. Provider model availability and quota are external to this package. Device checks include the visible-provider/navigation pinch overlap.
