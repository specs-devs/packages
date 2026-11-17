# NDK Capture — format

## Layers and settings

| Layer | Native (Specs) | Proxy | Notes |
|---|---|---|---|
| `camera` | SpecsRecorder `VIDEO` → H.265 | JPEG from the native camera proxy (editor: camera texture) | |
| `ar` | SpecsRecorder `AR_VIDEO` → H.265 | JPEG of **AR Texture** | AR eye: `SpecsRecorder_ArCameraPosition_t` (default right eye) |
| `ui` | — | JPEG of **UI Texture** | proxy-only |
| `mic` | SpecsRecorder `AUDIO` → AAC | — | not in the editor |

`LayerSettings` (see [components](components.md)) is the same object in the Lens, the manifest and
the Studio.

## Recording folder (`NDKCaptureRecordings/<id>/`)

- `manifest.json` — `ndkcapture/1`:
  `format, version, id, name, createdAt, lens, durationMs, device ("specs" | "editor"), ndk,
  layers[] ({id, kind, codec, source "native" | "proxy", file}), initial {layer: LayerSettings},
  timeline[] ({t ms, layer, set: Partial<LayerSettings>}), markers[] ({t, label, color, layer?}),
  clock {nativeStartNs}, chunks {"<layer>.proxy": n, "<layer>.nkc": n}, deviceFiles?, composite?`
- `<layer>.proxy.<n>.ndjson` — one JSON object per line: `{"t": ms, "d": "<base64 JPEG>"}`
- `<layer>.nkc.<n>.b64` — one line per streamed batch: base64 of NKC1-framed packets
- `edits.json` — `ndkcapture-edits/1`: `trim {in, out}, cuts [{from, to}], layers {layer:
  {override: Partial<LayerSettings>, hidden?}}, markers [], title`

The plugin flushes a new chunk every 2 s, so a crash loses at most the last 2 s.

## NKC1 packets and track files

Packet: `[u8 layer (0 camera, 1 ar, 2 mic)][u8 flags (bit 0 = key)][u16 0][u64 ts_ns][u32 size][payload]`,
little-endian. `ts_ns` is the native monotonic clock; subtract `manifest.clock.nativeStartNs`.
H.265 payloads are Annex-B access units; AAC payloads are raw encoder frames.

A device track file (`Device Folder`) is `"NKC1"`, `u32 headerLength`, a JSON header
(`{layer, codec, id}`), then packets.

## Plugin API (`http://127.0.0.1:47792`)

- `GET /api/status` — server, Lenses, current recording, recent saves, errors
- `GET /api/live?camera=<seq>&ar=<seq>&ui=<seq>` — newer frames per layer, settings, native stats
- `POST /api/command` — `{action, args}`; actions: `setLayer {layer, set}`, `startStream`,
  `stopStream`, `startRecording {name?}`, `stopRecording`, `marker {label}`, `keyFrame`
- `GET /api/recordings` — the library; `GET /api/recordings/<id>/<file>` — any recording file;
  `PUT /api/recordings/<id>/edits.json` — save edits (the only writable file)

## Lens ⇄ plugin messages (`ws://…:47793`)

Lens → plugin: `hello`, `settings`, `frame {layer, t, codec "jpeg", data}`, `packets {layer, codec,
data}`, `stats`, `record-begin {manifest}`, `record-change {change}`, `record-marker {marker}`,
`record-end {manifest}`. Plugin → Lens: `{type: "command", action, args}`.
