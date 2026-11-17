# EasyTeleprompter API status

[← Agent usage index](../README.md)

## Use when

Check installed source behavior before promising a modality, network connection, or synchronized presentation.

## Revision evidence

`package_dependencies.json` declares SpectaclesInteractionKit, SpectaclesUIKit, Utilities, SnapDecorators, Motion and Icons. The package version and Studio version are recorded in `package.native`. Device support requires separate verification.

Lens Studio Preview (SPECS 27, Interactive) QA on 2026-10-01: compile and startup clean; all 16 local slides render; the round Next / Previous buttons step and wrap (16 → 1, 1 → 16); the mic button starts ASR (Preview transcription needs a My Lenses login). Not tested: wrist soft press, companion phone, Google service, WebSocket deployment, device behavior. Fix round 2026-10-02: the Google example's round arrows and wrist pads now target GoogleSlideBridge. In Preview without credentials the arrows reach the bridge and return without errors. A credentialed run is a device check. The [component reference](components.md) is a source contract, not a device readiness certificate.

## Current

| Surface | Installed source contract |
|---|---|
| PresentationSwitcher | Direct child slides, first slide on awake, wrapping next/previous. No index getter or public navigation event. |
| SpeechToText from VoiceController.ts | ASR HighAccuracy; optional mic textures; delayed exact final-phrase matching; local/Google destination flag. |
| MobileController | Companion motion-controller Ended touches select previous on left half, next on right half. |
| SoftPressController | Selected HandVisual wrist overlap and eight collider vertices drive threshold navigation. |
| SimpleAsrTest | Starts ASR immediately and stops onDestroy; diagnostic component. |
| WebSocketController | Connect/send/retry/status and stored command receipt APIs. No automatic slide navigation on receipt. |
| GoogleSlideBridge | Credential-gated presentation, thumbnail and notes loading; bounded navigation and slide-count polling. next/previous do nothing until the presentation loads; webSocketController is optional. Subject to the gaps below. |
| SmoothRepositioning / CameraService | Local repositioning helper and initialized Main camera; stereo fields remain uninitialized. |

## Deprecated

No explicit deprecated annotations were found in package source. Historical VoiceML instructions are obsolete relative to VoiceController.ts, whose implementation now requires AsrModule; this is a documentation migration fact, not a deprecated class export.

## Experimental / incomplete integration

No formal experimental API annotations were found in the current scripts. Treat the bundled Google/relay/browser workflow as an unverified integration example:

| Gap | Source evidence and practical limit |
|---|---|
| Authorization inconsistency | GoogleSlideBridge onAwake sends accessToken verbatim; validation/content requests add `Bearer `. There is no single documented input format that correctly satisfies both without reconciling source. |
| Remote “current slide” sync | Poll compares slide counts only. Same-count content updates and another presenter's current index are not detected. |
| Local-to-Google callback | presentationChangeCallback contains TODO and is not subscribed to PresentationSwitcher. |
| Browser control guarantee | Fetching a Google presentation URL from the Lens is not evidence that another browser's presenter view navigates. Verify the actual web relay separately. |
| Relay receives commands | Stored next/previous commands have no shipped consumer that updates the Lens slides. |
| Relay deployment/authentication | server.js requires Node `ws`, contains demo authentication that accepts attempts, and does not serve the supplied direct-controller.html route. No manifest is shipped in its example folder. Host any relay on Snap-approved infrastructure only. |

## Removed / unavailable

| Surface | Current status |
|---|---|
| VoiceML implementation | No VoiceML module is required by VoiceController.ts or SimpleAsrTest.ts; both use AsrModule. |
| Public slide-index/count properties | No exported getters exist on PresentationSwitcher or GoogleSlideBridge. Their internal index/count fields are private. |
| Initialized stereo cameras from CameraService | Not implemented; requesting those enum values can return an uninitialized field. |
| Automatic bidirectional Lens navigation | Not implemented by the received-command storage alone. |

See [setup](setup.md) and [troubleshooting](troubleshooting.md) before enabling optional remote features. The tutorial's OS/app prerequisites are retained as historical prose, not encoded supported-version assertions.
