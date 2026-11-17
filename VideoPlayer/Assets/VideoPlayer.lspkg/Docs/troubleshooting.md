# VideoPlayer troubleshooting

[← Agent usage index](../README.md)

## Use when

Use this table for package-specific failures. Generic Lens scripting, UIKit
layout and InteractionKit issues are covered by those packages' own docs.

## Known limitations

| Symptom | Package cause | Package fix |
|---|---|---|
| Preview log: `VideoPlayerNativeModule: failed to load libVideoPlayerModule.so` and the state line shows `· VideoTexture` | Native modules never run in Lens Studio | Expected. Assign `videoTexture` (or `remoteMediaModule` + `internetModule`) so Preview has something to play; test the URL on a device |
| Preview shows `Error: No playable source…` | URL source, editor, and no `videoTexture` / remote modules | Assign a `videoTexture` |
| Device: `Error: SpecsPlayer_open failed: ERROR_NETWORK (4)` | Unreachable URL, no network, or HTTP error | Check the URL in a browser and the glasses' Wi-Fi. The module embeds the `INTERNET` permission, rebuild with SpecsNDK 1.1.0+ if `specs-perm-read.py` shows none |
| Device: `ERROR_FORMAT` / `ERROR_NOT_SUPPORTED` | Container or codec not supported by the device decoder | Use H.264 / H.265 video with AAC audio in MP4, or HLS |
| Device: `ERROR_RESOURCE_EXHAUSTED` | Decoder resources are in use (another player or a video call) | Close other players (`close()`) and retry |
| Audio plays but the video cell stays empty | No frames reach JS: unsupported frame format (log `unsupported frame format`), or the panel has no player | Check the device log for `[VideoPlayerModule]` lines and that `VideoPlayerPanel.player` is set |
| Video is upside down | Frames are flipped in native for `ProceduralTextureProvider.setPixels` (bottom-left origin) | If your material samples top-left, flip the UVs in the material; do not flip twice |
| Video looks soft on a 4K source | Frames are capped at `maxFrameWidth` × `maxFrameHeight` (default 1280×720) | Raise the cap; larger frames cost CPU (YUV→RGBA + copy) and upload time each frame |
| Lens stutters while a stream starts | Should not happen: `open` runs on a worker thread. `close()` / `open()` during a slow open waits for it to finish | Avoid calling `open` repeatedly while `Opening` |
| Loop toggled on but the clip stops at the end (Preview) | VideoTexture looping restarts on `onPlaybackDone`; that event needs the provider to finish naturally | Make sure nothing pauses the provider at the last frame |
| Panel text hidden behind buttons | Manual Text placed below z 0.65 | Keep `TEXT_Z` at 0.65 or more (see [components](components.md#videoplayerpanel)) |

## Verification

After a fix, run the package README's verification steps in Preview, then on a
Specs device with an HTTPS URL.
