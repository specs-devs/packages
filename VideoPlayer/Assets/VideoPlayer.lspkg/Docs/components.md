# VideoPlayer components

[← Agent usage index](../README.md)

## Use when

Use this as the import, input and behavior index after choosing the package.
Everything here is derived from `Scripts/SpecsVideoPlayer.ts`,
`Scripts/VideoPlayerPanel.ts`, `Scripts/VideoPlayerNativeModule.ts` and
`VideoPlayerModule/VideoPlayerModule.cpp` in this revision.

## Imports

| Symbol | Import |
|---|---|
| `SpecsVideoPlayer` (component) | `import {SpecsVideoPlayer} from "VideoPlayer.lspkg/Scripts/SpecsVideoPlayer"` |
| `VideoPlayerState` (const enum), `VideoPlayerMediaInfo` (type), `VideoPlayerEvent`, `VIDEO_PLAYER_STATE_NAMES`, `VideoPlayerBackend` | same module |
| `VideoPlayerPanel` (component) | `import {VideoPlayerPanel} from "VideoPlayer.lspkg/Scripts/VideoPlayerPanel"` |
| `VideoPlayerNativeModule` (decorator + `load`), `VideoPlayerNativeExports` | `import {VideoPlayerNativeModule} from "VideoPlayer.lspkg/Scripts/VideoPlayerNativeModule"` |

`SpecsVideoPlayer` and `VideoPlayerNativeModule` import nothing outside this
package. `VideoPlayerPanel` imports `UIKit.lspkg/Scripts/Themes/ThemeService`
first (a side-effect import that avoids a UIKit circular-import crash), then
UIKit `Button`, `RoundedRectangle`, `ElementContent`, `Frame`, `FlexLayout`,
`FlexItem`, `Slider`, and `SnapDecorators.lspkg/decorators`
(`bindStartEvent`, `bindUpdateEvent`).

## `SpecsVideoPlayer`

Plays one media source and writes the video into a texture.

### Inputs

| Input | Type | Default | Meaning |
|---|---|---|---|
| `source` | `"url"` \| `"bundled"` | `"url"` | `url` plays `url` (natively on device). `bundled` always plays `videoTexture` through its `VideoTextureProvider`, on device too |
| `url` | string | `""` | `file:///absolute/path`, `http://` or `https://`. Opened at start when not empty |
| `videoTexture` | Texture | — | Bundled video. Used when `source = bundled` and as the editor fallback for a URL |
| `autoPlay` | bool | `true` | Play as soon as the media is ready |
| `loop` | bool | `false` | Initial loop setting |
| `volume` | number 0–1 | `1` | Initial volume |
| `displayVisual` | MaterialMeshVisual | — | Optional Image / RenderMeshVisual whose `mainMaterial.mainPass[textureParameter]` receives the texture |
| `displayMaterial` | Material | — | Optional material that receives the texture |
| `textureParameter` | string | `"baseTex"` | Material parameter to write |
| `maxFrameWidth` / `maxFrameHeight` | int | `1280` / `720` | Cap for native RGBA frames. Bigger videos are scaled down with nearest-neighbour sampling, aspect kept, never upscaled |
| `backend` | `"auto"` \| `"native"` \| `"videoTexture"` | `"auto"` | `auto`: native on device, VideoTexture in the editor. A failed native load always falls back |
| `remoteMediaModule`, `internetModule` | assets | — | Optional. When both are set, the VideoTexture backend loads a URL source through `RemoteMediaModule.loadResourceAsVideoTexture` (Preview can then play the real URL) |
| `enableLogging` | bool | `false` | Print state changes |

### Public methods

| Method | Behavior |
|---|---|
| `open(url: string)` | Closes the current media and opens `url`. Native open runs on a worker thread; the state is `Opening` until preroll. Plays when `autoPlay` is on |
| `play()` / `resume()` | Plays; after `Ended` or `Stopped` it restarts from 0. Called while opening, it plays once ready |
| `pause()` | Pauses at the current position |
| `stop()` | Pauses and rewinds to 0. The media stays open |
| `seek(seconds)` / `seekRelative(delta)` | Absolute / relative seek, clamped to `[0, duration]` |
| `setVolume(v)` / `getVolume()` | Linear volume 0–1 |
| `setLoop(b)` / `getLoop()` | Loop at end of stream; can change during playback |
| `isPlaying()` | `true` in `Playing` or `Buffering` |
| `getCurrentTime()` / `getDuration()` | Seconds (`0` while unknown) |
| `getMediaInfo()` | `VideoPlayerMediaInfo`: `available`, `hasVideo`, `hasAudio`, `width`, `height`, `framerate`, `videoCodec`, `audioCodec`, `sampleRate`, `channels` (native also `frameFormat`, `outputWidth`, `outputHeight`). VideoTexture backend reports only the size |
| `getState()` / `getStateName()` | `VideoPlayerState` / its display name (`Opening` displays as "Loading") |
| `getLastError()` | Last error text, `""` if none |
| `getBackend()` | `"none"`, `"native"` or `"texture"` |
| `getTexture()` | Current texture (`ProceduralTexture` on device, the `VideoTexture` in the editor) |
| `getCurrentUrl()` | Last URL passed to `open` |
| `close()` | Closes and releases the native player |

### Events

`VideoPlayerEvent<T>`: `add(cb)` returns an unsubscribe function; `remove(cb)`.

| Event | Payload | When |
|---|---|---|
| `onStateChanged` | `VideoPlayerState` | Any state change |
| `onEnded` | — | End of stream with loop off |
| `onError` | string | Entering `Error` (and on each later failure) |
| `onDurationChanged` | number | Duration became known or changed |
| `onTextureChanged` | Texture | A new texture object is shown (first native frame, frame size change, new VideoTexture) |

### `VideoPlayerState`

`Idle 0`, `Opening 1`, `Buffering 2`, `Playing 3`, `Paused 4`, `Stopped 5`,
`Ended 6`, `Error 7`. The native module returns the same numbers.

### Lifecycle

Disabling the SceneObject pauses playback and enabling it resumes. Destroying
it closes the native player. Unloading the native module also tears the player
down.

## `VideoPlayerPanel`

UIKit UI built at runtime (no prefab). Ported from InteractionKitExamples'
`ExampleVideoPlayer`, with the same frame, video cell, time label, draggable timeline (knob drag or tap on the bar, live scrubbing, paused while dragging),
transport buttons and volume. It adds a state line, a media info line, Stop and
a Loop toggle.

| Input | Default | Meaning |
|---|---|---|
| `player` | — | `SpecsVideoPlayer` to drive. Empty: the one on the same SceneObject |
| `seekStep` | `1` | Seek step in seconds of the -/+ buttons; presses stack from the requested time, not from the decoder position |
| `showVolumeSlider` | `true` | Volume row |
| `showMediaInfo` | `true` | Info line: resolution · fps · codecs · source host (`local file` / `bundled`) |
| `flexLayoutResize` | `false` | Corner grab reflows (on) or scales (off) |
| `panelWidth` | `32` | Content width, cm |
| `aspectRatio` | `"auto"` | `auto` fits the video's aspect in a 16:9 cell; `16:9` / `4:3` / `1:1` fix it |
| `positionX/Y/Z` | `0, 0, -110` | Local position of the panel |
| `videoCornerRadius` | `1.5` | Video corner radius, cm |
| `uiScale` | `1.4` | Multiplies row and button heights (1 = the original compact panel) |
| `textScale` | `3.2` | Multiplies every text size below; UIKit text units are small, 3.2 gives about 1.4 cm tall button labels |
| `timeLabelFontSize`, `buttonFontSize`, `volumeLabelFontSize`, `stateFontSize`, `infoFontSize` | `24, 20, 22, 20, 16` | Text sizes before `uiScale` |

Public methods: `getPlayer()`, `play()`, `pause()`, `stop()`,
`seekRelative(dt)`, `setVolume(v)`, `setLoop(b)`.

Layout rules kept from the source example: button labels are `ElementContent`
at z `0.08` in front of the button; Text placed manually (state, info, time)
sits at z `0.65` so a 1 cm button face never hides it; each layout level is
lifted `0.02`; the panel content is lifted `0.05` from the Frame. Seek-slider
drags are throttled to one seek every 0.2 s.

## Native module exports (`libVideoPlayerModule.so`)

Loaded with `VideoPlayerNativeModule.load(this, cb)` into a field decorated
with `@VideoPlayerNativeModule()`. Commands return a `SpecsPlayer_Result_t`
code (0 = success).

| Export | Notes |
|---|---|
| `ping(): number` | Returns 1 |
| `open(url, loop): number` | Tears down any player, then create → event callback → video output CALLBACK + frame callback → audio SPEAKER → `SpecsPlayer_open` on a worker thread. 0 = started |
| `play()`, `pause()`, `stop()` | `playAsync` / `pauseAsync` (sync fallback). `stop` = pause + seek 0. Recorded and applied after open if called while opening |
| `seek(seconds)`, `setLoop(bool)`, `setVolume(0..1)` | Loop and volume are remembered for the next open |
| `getState(): number` | `VideoPlayerState` |
| `getLastError(): string` | e.g. `SpecsPlayer_open failed: ERROR_NETWORK (4)` |
| `getDuration()`, `getPosition()` | Seconds; cached values while the player is busy opening |
| `getMediaInfo(): string` | JSON, see `VideoPlayerMediaInfo` |
| `pullFrameInto(ArrayBuffer): {updated, width, height}` | Copies the newest RGBA frame, already flipped for `setPixels`. `updated=false` when nothing new or the buffer is too small (width/height still report the frame size) |
| `setMaxFrameSize(w, h)` | Frame cap, default 1280×720 |
| `close()` | `SpecsPlayer_close` + `SpecsPlayer_destroy` |

Decoded frames may arrive as RGBA, I420 or NV12; the module converts YUV with
BT.601 limited-range coefficients.
