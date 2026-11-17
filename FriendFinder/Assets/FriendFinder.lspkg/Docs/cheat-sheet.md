# FriendFinder cheat-sheet

[← Agent usage index](../README.md)

## Use when

Read first before dropping the prefab or selecting a media path.

1. Assign the required MobileKitModule to FriendFinderManager; services start on OnStart after component OnAwake. → [Setup](setup.md)
2. Keep one shared built-in SpectaclesMobileKitModule; MobileKitModule.getLink lazily returns its owned link. → [Components](components.md)
3. Preview Watch Your Back is synthetic; device Watch Your Back and Call Friend require native WebRTC. There is no automatic JPEG media fallback. → [API status](api-status.md)
4. Configure your own SupabaseProject/tables for device media signaling, including Watch Your Back. Disabling SnapCloudModule does not gate that source's direct RtcMailbox construction. → [Setup](setup.md)
5. Call Friend and Watch Your Back are exclusive; Find Friend can accompany either. → [Guide](guide.md)
6. Location math uses meters/degrees; labels format feet/miles. Arrow distance is clamped independently of the measured distance. → [Components](components.md)
7. Register one RTC callback per kind/from pair. RtcMailbox.send returning true means an insert was initiated, not delivery acknowledged. → [Troubleshooting](troubleshooting.md)
8. Native .so libraries do not run in Preview. Use matching SpecsNDK/dependencies only when rebuilding them. → [Guide](guide.md)
9. `simulateInPreview` (on in the prefab) feeds fake GPS only in Lens Studio; device builds always use real locations. The Snap Cloud project lives on the prefab's `SnapCloudRequirements` object (shipped empty). Until a SupabaseProject is assigned there, a red-framed "Credentials needed" panel appears before the guide and SupabaseRequirements prints a setup warning to the console. → [Troubleshooting](troubleshooting.md)
