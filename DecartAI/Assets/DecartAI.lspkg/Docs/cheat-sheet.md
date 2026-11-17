# DecartAI cheat sheet

[← Agent usage index](../README.md)

## Use when

Read first when selecting or wiring this installed revision.

1. The prefab wires the engine's `targetImage` (its own `DecartDisplayQuad`) and the UI's **ScriptComponent-typed** `decartScript`; check the rig's `cameraObject`, the only reference outside the prefab tree (the scene's `Camera Object`). → [Setup](setup.md#prefab-wiring)
2. `target` / `mode` store short keys (`auto`/`editor`/`device`, `bridge`/`http`). Older scenes that stored the dropdown label text are mapped back to the keys in `onAwake`; any other unknown `mode` still falls into HTTP. Keep `autoStart=false` during local setup. Camera initialization happens on Start, but transport start is explicit; native library loading can still happen during initialization on device. → [Lifecycle](setup.md#lifecycle)
3. `target=auto` means editor→Mac path, device→native. Forcing `device` in Preview cannot load device-only libraries. Native load failure returns null without invoking the engine callback. → [Troubleshooting](troubleshooting.md)
4. Effective native settings are fixed endpoint, `lucy-restyle-2`, H.264, 4000 kbps; only `nativeFps` and `nativeMaxWidth` feed through. `nativeDownlinkKbps` is inactive. → [Inputs](components.md#decartrealtimerestyle)
5. Bridge credentials belong to `DECART_API_KEY` or the bridge CLI; HTTP/native use engine `apiKey`, falling back to `DecartRequirements`. The shipped bridge default key is empty. → [Credentials](setup.md#credentials)
6. Stop HTTP before resetting/editing: Stop cannot abort the in-flight request, and its result can still update the display. Historical crash reports are not a regression test for the current editor. → [Troubleshooting](troubleshooting.md)
7. Use the display setters for live changes. Decoded aspect updates are implemented on the native path; bridge/HTTP use the initial 16:9 aspect. → [Display](components.md#decartrealtimerestyle)
8. Do not combine the standalone native smoke-test controller with the main engine. Its animated gradient only proves local frame delivery. → [Native helpers](components.md#native-module-and-session)
9. Both native `.so` assets ship with an empty Permissions list and no embedded `.snap.permissions` section; on-device WebRTC needs INTERNET (and camera) granted before it can open sockets. → [Prefab findings](troubleshooting.md#prefab-and-package-findings)
