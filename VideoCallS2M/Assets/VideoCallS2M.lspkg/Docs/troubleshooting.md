# VideoCallS2M troubleshooting

[← Agent usage index](../README.md)

## Use when

The phone link waits, a media mode never becomes live, or location/simulation is mistaken for real connectivity.

## Red "Credentials needed" panel before the guide

`CredentialsWarning`: no SupabaseProject is assigned on the prefab's `SnapCloudRequirements` object (the prefab ships without one). Window > Supabase > Import Credentials, then assign the SupabaseProject on `SnapCloudRequirements`; the panel then no longer appears and the guide shows directly. "Continue without credentials" runs the demo with Snap Cloud off (no signaling, history or checkpoints). No Remote Service Gateway tokens are checked: this package doesn't use them.

## Missing phone-link block

Manager resolves required mobileKit on Start. Wire MobileKitModule itself; without it startup prints that PhoneLink is not wired and returns. Keep one built-in Mobile Kit module instance. A duplicate asset/require can attach rendezvous to the wrong instance according to source ownership notes.

## Waiting call with configured-looking cloud

SupabaseProject presence is not auth/schema readiness. RtcMailbox.start connects asynchronously; inspect isConnected and actual authentication/table/policy errors. Snapchat sign-in is attempted before anonymous fallback. Current manager supplies DB mailbox; optional SnapCloudModule disabled/unwired makes Call Friend skip. Device Watch Your Back also uses a DB mailbox.

## Synthetic pattern looks live

Watch Your Back editor source is deliberately animated 180x320 RGBA, selected by isEditor once. It proves a changing test texture, not phone video or WebRTC. Device native failure keeps waiting/unavailable state and does not switch to synthetic media. Verify real decoded frames, video/audio and remote peer separately on compatible hardware.

## Fallback or relay comments conflict

CallStreamer header describes old Mobile Kit relay signaling, and WebRTCController prints an old Realtime fallback message. Current manager creates RtcMailbox and CallStreamer has native WebRTC-only media. Watch Your Back source retains a STUB comment even though its device receive implementation exists. Read executable implementation and current [API status](api-status.md); no behavioral comment cleanup was performed here.

## Friend marker moves without a fresh fix

FriendPositionEstimator marks fixes stale after 4 seconds; it uses recent motion capped at 8m/s and projects for at most 30 seconds, or holds position when no usable velocity exists. Estimated output is intentional, not fresh phone GPS/UWB. Check ageS/estimated and real link state. simulateInPreview requires editor; usePhoneLocation chooses phone GPS versus Lens geolocation independently.

## Device camera or audio stalls

Native camera capture must have one owner; avoid competing CameraModule requests. Optional native mic/speaker APIs vary with binary revision. Current CallStreamer uses native-first audio with bounded JS fallbacks; these do not create another media transport. Read status/counters and verify on actual devices; no native call or permission change was made in this pass.

## Mode switch turns on but never off

Symptom: a start-menu switch knob moves to off but its label stays highlighted and the START summary still lists the mode. Cause: UIKit's `Switch.onFinished` passes the "explicit" flag, not the new state. Fix (in ModeMenuUI): `sw.onFinished.add(() => onChange(sw.isOn))`. Use the same pattern for any switch you add.

## Call Friend panel stays on "Good things take a second to load"

Expected in the Lens Studio Preview: the log shows `[RtcMailbox] SupabaseProject not configured — RTC signaling disabled.` and `[Call] WebRTC native module unavailable (preview?)`. The native modules only load on a Specs device, and signaling needs your own SupabaseProject on `SnapCloudRequirements`. QUIT CALL returns to the menu.

## No fake GPS in the Preview

`simulateInPreview` must be true on the manager (prefab default since 2026-10-01; older placed instances may still hold `false`). It has no effect on a device.

## Panels overlap a demo guidance bar

The Watch Your Back / Call Friend POV panel is placed about 98 cm ahead at x −11 and fills most of the vertical field of view, so any head-locked UI you add above it (for example a QA carousel bar) overlaps its top edge. Hide your own UI while a mode runs, or move it to the side.

## Validation boundary

All documentation facts/signatures were derived from installed source. Lens Studio compile, startup and the editor menu/mode flow were checked in the Preview (2026-10-01); native frames/audio, phone/location/UWB, authenticated cloud signaling, repeat-call cleanup and target hardware are unverified until the allowed live QA pass. Source snippets and links are checked separately; no success is inferred from comments, simulations or native type declarations.
