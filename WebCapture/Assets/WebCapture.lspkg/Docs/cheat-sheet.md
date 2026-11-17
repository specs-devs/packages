# WebCapture cheat sheet (load-bearing rules)

[← Agent usage index](../README.md)

## Use when

Read this **first**, and again before wiring the package into a Lens. These are the rules that most
often break a capture. Each links to the detail.

## The rules

1. **Local mode needs Experimental APIs.** Lens Studio refuses a plain `ws://127.0.0.1` URL
   otherwise (status: *Lens Studio blocks ws:// URLs unless Experimental APIs are enabled*). A
   Lens with Experimental APIs on can't be published: switch **Mode** to *Snap Cloud* (or turn the
   setting off) before you publish. → [setup](setup.md)
2. **The portal must be unpacked at the project root** (`<project>/WebCapturePortal/index.html`).
   Without it the plugin serves an instructions page and the API still works. → [setup](setup.md)
3. **The plugin runs per Lens Studio window on fixed ports 47790 (HTTP) and 47791 (Lens socket).**
   Two Lens Studio windows with Web Capture projects compete for them: the second one logs
   *Could not start the portal server*. Use one at a time, or Restart Server in the window you use.
   → [troubleshooting](troubleshooting.md)
4. **Poses are relative to the Capture Origin** (empty = the `WebCapture` SceneObject), in cm, +Y
   up. Put captured objects under it and don't scale it unless you mean it: its world scale divides
   every object's scale. → [protocol](protocol.md)
5. **Ids must be unique and stable.** They default to the SceneObject name (max 80 characters).
   Duplicates get `#2`, `#3`… with a warning, and that suffix depends on order. Set **Target Id**
   on `WebCaptureTarget`. The portal's per-object edits are keyed by id. → [components](components.md)
6. **Disabled objects register only once enabled.** A `WebCaptureTarget` under a disabled parent
   doesn't exist yet; with Record On Start the recording waits for the first object. Use
   `startRecording()` yourself when your content appears later. → [components](components.md)
7. **Recordings are layers, not a screen recording.** Scene tracks (poses, shapes, text, optional real
   meshes) plus, on Specs with **NDK Video** on, the camera as H.265 and its calibration. The portal
   re-composites the virtual layer over the camera video; without the camera layer it shows proxies. → [portal](portal.md)
8. **Snap Cloud mode: credentials only from a `SupabaseProject` asset** on `SnapCloudRequirements`,
   `setup.sql`, `storage.sql` and `fixed-code.sql` installed once, and the portal uses the project's
   **public** key only. Set a long random **Capture Code**: it is the key to the recordings, so treat it
   like a share link. → [setup](setup.md), [protocol](protocol.md)
9. **Limits:** 128 objects, recordings up to 90 s (30 / 60 / 90 s on the panel; camera video makes 90 s about 45 MB, which may exceed Snap Cloud Storage's default 50 MB file limit),
   scene snapshots up to 512 KB, 50 recordings per Snap Cloud session. → [protocol](protocol.md)
10. **Specs camera needs the `NDKCapture` package** (a dependency of this package) and a Lens pushed to the
    glasses; in Lens Studio the Device Camera Texture is used instead. Turn **Record Reference** off unless
    you are checking alignment: it runs a second layer next to the camera. → [components](components.md)
11. **The portal's Lock and Hands run in the browser** when a recording opens (about 5–25 s for a 15 s
    capture); playback is blocked until they finish. Nothing leaves your machine. → [portal](portal.md)
12. **Scheduling needs no credentials to plan; publishing does.** The built-in engine only queues. Automatic
    posting needs an engine that holds *your own* social API tokens. → [guide](guide.md)
