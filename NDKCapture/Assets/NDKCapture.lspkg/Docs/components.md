# NDK Capture — components

## `NDKCapture` (`Scripts/NDKCapture.ts`)

| Input | Default | Meaning |
|---|---|---|
| Studio Url | `ws://127.0.0.1:47793` | The plugin's Lens socket. On Specs: your computer's LAN address. |
| Connect On Start | on | Connect to the Studio (and keep reconnecting every 3 s). |
| Stream On Start | on | Start streaming the enabled layers when the Lens starts. |
| Camera Layer / Ar Layer / Ui Layer / Mic Layer | on / on / off / on | Which layers exist. |
| Ar Texture | — | Render target used for the AR layer's proxy frames. |
| Ui Texture | — | Render target for the optional ui layer. |
| Proxy Width | 480 | Width of the native JPEG camera proxy. |
| Proxy Quality | 50 | JPEG quality of the native camera proxy. |
| Device Folder | empty | Specs only: folder for NKC1 tracks and the composite MP4. Empty = Studio only. |
| Record Composite | off | Specs only: also record a `SpecsCapture` MP4 (camera + AR + audio). |
| Composite Alpha / Composite Blend | 1 / Alpha | AR blend for the composite MP4. |
| Status Text | — | Optional Text showing the state. |
| Verbose | off | Print state changes. |

Methods:

- `setLayer(layer: LayerId, patch: Partial<LayerSettings>)` — change a layer live (and log it).
- `getLayer(layer): LayerSettings` — a copy of the current settings.
- `startStream()` / `stopStream()`
- `startRecording(name?: string)` / `stopRecording(): SessionManifest | null`
- `addMarker(label: string, layer?: LayerId, color?: string)`
- `isStreaming`, `isRecording`, `studioConnected`

`LayerSettings`: `enabled`, `opacity` (0–1), `blend` (`normal` | `add` | `screen` | `multiply`),
`transform` `{x, y, scale, rotation}` (x/y in output widths/heights), `z` (order), `fps`, `bitrate`
(bps, 0 = default), `keyFrameInterval` (frames), `proxyFps`.

## `StudioLink` (`Scripts/StudioLink.ts`)

The WebSocket to the plugin. `connect()`, `close()`, `tick(now)` (reconnects), `send(message)`
(drops messages over 512 KB), `connected`, `bytesSent`, `dropped`. Used by `NDKCapture`; you only
need it for a custom component.

