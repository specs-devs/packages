# VideoPlayer

VideoPlayer plays video on Specs with the SpecsNDK **SpecsPlayer** media
library. A native module (`Modules/libVideoPlayerModule.so`) opens a local file
or an HTTP(S) URL, sends audio to the glasses' speakers and hands decoded
frames to a texture. A UIKit panel adds transport controls. In Lens Studio
Preview, where native modules do not run, the player falls back to a
`VideoTexture`, so you can still build and test the UI in the editor. Requires
Lens Studio 5.25+.

## Features

- **Native URL playback**: `file://`, `http://` and `https://` media decoded by SpecsPlayer (SpecsNDK 1.1.0), audio on the speaker
- **Texture output**: RGBA frames are scaled to a capped size (default 1280×720) and uploaded to a `ProceduralTexture`, only when a new frame arrives
- **Full transport**: open, play, pause, resume, stop, seek, relative seek, volume and loop
- **State and media info**: Loading / Buffering / Playing / Paused / Stopped / Ended / Error, plus resolution, fps, codecs, sample rate and channels
- **Editor fallback**: in Preview, the bundled `VideoTexture` (or a URL loaded through `RemoteMediaModule`) is driven through the same API
- **UIKit panel**: frame, video cell, state line, media info line, time label, a draggable timeline (drag the knob or tap the bar; the video pauses while you drag and resumes on release), -1 s / +1 s buttons that stack on rapid presses, a loading spinner in front of the video while it opens, buffers or seeks, Play / Pause, Stop, a Loop toggle and volume, all sized for reading on glasses (`uiScale` for rows, `textScale` for text)

## Usage

This section ships with the package and describes the exact installed revision.
Read it, then follow the links into `Docs/` for the topic you need. It is
written for both people and coding agents; generic Lens scripting, scene
construction, and Specs spatial design are out of scope here.

### Package identity

- Package descriptor: `VideoPlayer.lspkg/package.native`
- Consumer import prefix: `VideoPlayer.lspkg/Scripts/`. The modules are
  `SpecsVideoPlayer` (the player component, events and state enum),
  `VideoPlayerPanel` (the UIKit UI) and `VideoPlayerNativeModule` (the typed
  native loader). See [components](Docs/components.md).
- Native module: `VideoPlayer.lspkg/Modules/libVideoPlayerModule.so`
  (aarch64, SpecsNDK 1.1.0). It embeds a `.snap.permissions` manifest with
  `INTERNET`. Its C++ source is `VideoPlayerModule/` beside the project's
  `Assets/`.
- Required companion packages (`package_dependencies.json`): `UIKit`,
  `InteractionKit` and `SnapDecorators` (imported by `VideoPlayerPanel`), plus
  `Motion` and `Icons` (UIKit companions). `SpecsVideoPlayer` alone imports
  nothing outside this package. The panel needs the InteractionKit prefab in
  the scene to be pinched.
- Fonts: `VideoPlayerPanel` loads `Fonts/SpecsSans-{Light,Regular,Medium,Bold}.otf`
  from this package with `requireAsset`.

### Version and API status

Read [API status](Docs/api-status.md) before you copy code. The native path
needs a Specs device: nothing in `libVideoPlayerModule.so` runs in Lens Studio.

### Applicability

Use VideoPlayer to play a video from a URL or a file on the device inside a
Lens, with your own controls or the included panel. For a short clip shipped
with the Lens, a `VideoTexture` on its own is simpler (set `source` to
`bundled` to keep this API). Live camera or WebRTC video is out of scope.

### Package Docs (ship in `Docs/`)

Lens Studio auto-extracts these files into the project's install Cache on
import, so an agent can read them there. Treat only the members documented
here as supported API; never guess an import path.

- [components](Docs/components.md) - imports, inputs, defaults, public methods, events, native exports
- [API status](Docs/api-status.md) - Current / Experimental / Internal, and what is device-only
- [troubleshooting](Docs/troubleshooting.md) - package-specific symptoms and fixes

### Verification

1. Compile with no TypeScript errors; imports are
   `VideoPlayer.lspkg/Scripts/SpecsVideoPlayer` and
   `VideoPlayer.lspkg/Scripts/VideoPlayerPanel`.
2. Preview: with a `videoTexture` assigned, the panel shows
   `Paused · VideoTexture` (or `Playing` with autoPlay), the video plays, and
   Play / Pause / seek / Stop / Loop / volume act on it.
3. On a Specs device with an HTTPS URL: the state line goes Loading →
   Playing with `· SpecsPlayer`, the info line shows the resolution, fps,
   codecs and host, audio plays, and the video cell updates.
4. Turn Loop on and let the video reach the end: it restarts. With Loop off it
   shows `Ended`, and Play restarts it from 0.

## Native development (SpecsNDK)

**Download SpecsNDK from https://github.com/specs-devs/ndk.** The included
`libVideoPlayerModule.so` works without installing it. To rebuild the module
from `VideoPlayerModule/`, install **SpecsNDK 1.1 (1.1.0)** or later (1.1.0
ships `SpecsPlayer.h` and `libspecs_player.so`), then:

```bash
export SPECSNDK_ROOT="/path/to/extracted/SpecsNDK"
cd VideoPlayerModule
bash ./build.sh "$SPECSNDK_ROOT"
```

The script builds, strips and copies the library into
`Assets/VideoPlayer.lspkg/Modules/`. The toolchain embeds the `INTERNET`
permission automatically because the module calls `SpecsPlayer_open`. See
`VideoPlayerModule/README.md` for details.

## Built with 👽 by the SPECS team

---

[See more packages](https://github.com/specs-devs/packages)
