# VideoCallS2M cheat sheet

[← Agent usage index](../README.md)

## Use when

Read first before adding blocks, selecting a mode, or interpreting a preview.

1. **Wire MobileKitModule to the manager.** PhoneLink is required and owns the single built-in Mobile Kit module; a second instance can rendezvous incorrectly. → [Setup](setup.md#phone-link)
2. **Cloud is optional for history, not magically optional for current calls.** Inactive SnapCloudModule returns null; Call Friend skips without its mailbox, and device Watch Your Back also creates an RtcMailbox. → [Cloud](setup.md#snap-cloud)
3. **Editor media is synthetic, device media is WebRTC.** Watch Your Back chooses once; device failure does not switch to fake media. → [Status](api-status.md)
4. **Watch Your Back and Call Friend are mutually exclusive.** Find Friend can combine with either; the GPS-source switch is local to the Lens. → [Types and menu](components.md)
5. **Native camera has one owner.** Do not start another CameraModule capture while the native stream/session owns the camera. Prebuilt binaries are device-only. → [Native setup](setup.md#native-modules)
6. **SupabaseProject presence is a configuration gate.** Authentication, schema, policies and mailbox isConnected still need proof. → [Cloud setup](setup.md#snap-cloud)
7. **Estimated friend position is not a fresh fix.** Source marks data stale after 4s and caps projection to 30s/8m/s. → [Estimator](components.md)
8. **Ignore stale fallback/relay comments.** Current manager supplies DB mailbox and CallStreamer is WebRTC-only; retained Realtime/JPEG exports are not an automatic call fallback. → [Troubleshooting](troubleshooting.md#fallback-or-relay-comments-conflict)
9. **Read `sw.isOn` in Switch callbacks.** UIKit's `Switch.onFinished` passes the "explicit" flag, not the new state; ModeMenuUI reads `sw.isOn`. Passing the callback straight through makes switches turn on but never off. → [Switch stuck on](troubleshooting.md#mode-switch-turns-on-but-never-off)
