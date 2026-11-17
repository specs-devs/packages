# VideoPlayer API status

[← Agent usage index](../README.md)

## Use when

Check this file before choosing a member or copying code. It is the
compatibility index for the package revision that contains it.

## Status meanings

- **Current** — recommended public surface for new work.
- **Deprecated** — still present; migrate to the named replacement.
- **Experimental** — public, but compatibility is not guaranteed.
- **Removed** — unavailable in this revision.
- **Internal** — resolvable implementation detail, not supported API.

## Current API

| Capability | Current surface |
|---|---|
| Player component | `SpecsVideoPlayer` from `VideoPlayer.lspkg/Scripts/SpecsVideoPlayer` |
| Playback | `open`, `play`, `pause`, `resume`, `stop`, `seek`, `seekRelative`, `setVolume`, `setLoop` |
| Queries | `isPlaying`, `getCurrentTime`, `getDuration`, `getMediaInfo`, `getState`, `getStateName`, `getLastError`, `getBackend`, `getTexture` |
| Events | `onStateChanged`, `onEnded`, `onError`, `onDurationChanged`, `onTextureChanged` |
| UI | `VideoPlayerPanel` from `VideoPlayer.lspkg/Scripts/VideoPlayerPanel` |

Exact inputs, defaults and behavior are in [components.md](components.md).

## Experimental

| Surface | Notes |
|---|---|
| Native backend (`libVideoPlayerModule.so`) | Built against SpecsNDK 1.1.0; must be verified on a Specs device. Behavior of SpecsPlayer state events, frame formats and buffering may differ by OS build |
| `VideoPlayerNativeModule` / `VideoPlayerNativeExports` | The raw native surface. Use `SpecsVideoPlayer` unless you need the exports directly; the export list may grow |
| `remoteMediaModule` + `internetModule` URL fallback | Editor-side convenience; depends on `RemoteMediaModule` support for the URL's format |
| `getMediaInfo().frameFormat`, `outputWidth`, `outputHeight` | Diagnostic fields, native backend only |

## Device-only behavior

| Feature | Device (native) | Lens Studio Preview |
|---|---|---|
| URL playback | SpecsPlayer, `file://` / `http(s)://` | `RemoteMediaModule` if both modules are assigned, else the bundled `videoTexture` |
| Audio | Speaker via SpecsPlayer | VideoTexture audio |
| Media info | Full (codecs, fps, audio) | Size only |
| Buffering state | From SpecsPlayer buffering events | `Preparing` while play was requested |

## Internal

| Surface | Why internal |
|---|---|
| `VideoPlayerPanel` helpers (`btn`, `content`, `label`, `flexRow`, …) | Private. `content()`, `btn()` and `scenePanel()` write private UIKit fields through `as any` (copied from `ExampleVideoPlayer`); do not copy these writes into new code, use UIKit's public API |
| `VideoPlayerModule.cpp` globals | One player per module instance; not a multi-player API |
