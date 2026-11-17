# VideoCallS2S cheat sheet

[← Agent usage index](../README.md)

## Use when

Read first for two-wearer calling, mailbox roles and preview limits.

1. **Wire an active configured SnapCloudModule.** Undefined is allowed for layout preview, but real calling requires SupabaseProject and mailbox readiness. → [Cloud setup](setup.md#snap-cloud)
2. **Use the callee's pairing-code session.** Caller is offerer; accepting wearer is callee/answerer; one duplex native connection carries both voices/cameras. → [Protocol types](components.md)
3. **S2S requires native ping >=3.** Matching names or a S2M binary are insufficient. Optional audio exports also need support checks. → [Native setup](setup.md#native-module)
4. **Preview synthesis is not a successful call.** Manager can show a 320x180 test pattern when editor cloud is not ready and previewTestPattern=true. Never infer device media from it. → [API status](api-status.md)
5. **Pairing normalization strips non-digits then requires four.** Codes identify sessions, not authenticated users; source allows anyone knowing a code to ring. → [Examples](examples.md)
6. **Mailbox start is async.** onReady/onSchemaMissing and isConnected distinguish configuration, missing schema and real readiness. Poll cadence is 1.5s idle/0.4s active. → [Mailbox reference](components.md)
7. **No TURN is configured.** Start two-device validation on the intended shared Wi-Fi/hotspot; do not promise cross-network behavior. → [Network](setup.md#network-and-role-boundary)
8. **The UI is world-placed once, at onAwake.** The manager creates a new root `Video Call S2S` and puts Home at world (0, 0, −110); it does not follow the head. Anything that disables the prefab instance until later (a demo guide) also delays the manager and its pairing code. → [Troubleshooting](troubleshooting.md#home-panel-is-not-in-front-of-me)
