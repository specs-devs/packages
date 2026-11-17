# VideoCallS2S troubleshooting

[← Agent usage index](../README.md)

## Use when

A ring does not arrive, a call waits, schema is missing, or preview output is mistaken for native media.

## Red "Credentials needed" panel before the guide

`CredentialsWarning`: no SupabaseProject is assigned on the prefab's `SnapCloudRequirements` object (the prefab ships without one). Window > Supabase > Import Credentials, then assign the SupabaseProject on `SnapCloudRequirements`; the panel then no longer appears and the guide shows directly. "Continue without credentials" runs the demo with Snap Cloud off (no pairing or signaling; in the Preview CALL FRIEND still opens the synthetic feed). No Remote Service Gateway tokens are checked: this package doesn't use them.

## Home shows unconfigured or schema missing

Asset presence and active SnapCloudModule are configuration gates only. RtcMailbox starts auth asynchronously and exposes onReady/onSchemaMissing; missing rtc_signals is separate from missing credentials. Verify own backend auth/providers/migrations/policies. Source tries Snapchat sign-in then anonymous fallback; it does not certify your backend configuration.

## Code rejected or wrong session

normalizePairingCode strips non-digits and requires four digits. The callee's code defines `s2s-<code>`; each sender uses its own code. Codes are unauthenticated prototype rendezvous and can collide. Calling yourself/invalid input is checked in manager's private state flow; do not substitute S2M signaling types.

## Ring times out or receives busy

Manager handles one call at a time. Incoming unanswered ring timeout is 60 seconds; outgoing unanswered call is 45 seconds. It subscribes ring/accept/decline/busy/bye on mailbox and restores UI internally. Successful cloud configuration without poll/auth readiness does not deliver the handshake.

## Animated preview looks like a completed call

With cloud not ready, previewTestPattern=true in editor opens synthetic panel even for absent/invalid code. The 320x180 gradient/scanline is deliberate layout content, not another camera, encoded media, authenticated peer or real call. Capture two timestamps to prove only animation; native video/audio still need compatible devices.

## Native module loads but no media

Check ping >=3 through isS2SCapable, then actual session connected state, decoded frames and both audio paths. Caller/offerer and callee/answerer must be distinct. Optional mic/speaker APIs depend on binary generation. Missing/old module exposes unavailableReason; no device switch to fake media makes it a pass. No hardware load/call was performed in this docs pass.

## Cross-network connection waits

Default TURN_URL is empty. STUN/native UDP reachability is insufficient evidence of successful ICE pairs on every network. Validate intended shared Wi-Fi/hotspot first, then separately provision/test any relay requirement. No server credentials or backend deployment were supplied here.

## Home panel is not in front of me

Home is created at world (0, 0, −110) in the manager's onAwake and never re-anchored; the incoming dialog and call panel are built under the same `Video Call S2S` root. If the wearer has moved or turned before the instance wakes, the panel sits where the origin's forward was. Place the instance so it wakes at session start, or move the runtime `Video Call S2S` root yourself.

## Status line lost the Snap Cloud warning

After HANG UP the home status shows "Call ended." and the earlier "Snap Cloud not configured" warning is not restored (backToHome overwrites it). Calling stays editor-only until a SupabaseProject is assigned; check the log line from SupabaseRequirements instead.

## Incoming-call dialog never appears in Preview

IncomingCallUI is only built when a `ring` row arrives on the inbox mailbox, which needs a configured Snap Cloud project and a second wearer (or a row inserted for `s2s-<your code>`). The synthetic preview path skips ringing entirely and opens the call panel directly.

## Readiness

The original README says S2S native changes were compiled but not exercised on hardware. The Lens Studio Preview checked the editor flow only (home, synthetic call panel, quality toggle, hang-up, repeat call; no runtime errors besides the LensCore Depth24 format warning). Both video/voice directions, cloud handshake/schema, the incoming dialog, repeat device calls and native teardown remain unverified.
