// SPECS Inc. 2027
// NDK Capture Studio model: recordings (ndkcapture/1), layer tracks, settings over time and edits.
// Pure functions, no DOM, so they run in the browser and under `node --test`.

export const FORMAT = "ndkcapture/1"
export const VISUAL = ["camera", "ar", "ui"]
export const LAYERS = ["camera", "ar", "ui", "mic"]

export function defaultSettings(layer) {
  return {
    enabled: layer !== "ui",
    opacity: 1,
    blend: layer === "camera" || layer === "mic" ? "normal" : "screen",
    transform: {x: 0, y: 0, scale: 1, rotation: 0},
    z: layer === "camera" ? 0 : layer === "ar" ? 1 : 2,
    fps: layer === "mic" ? 0 : 30,
    bitrate: 0,
    keyFrameInterval: 30,
    proxyFps: layer === "mic" ? 0 : 6
  }
}

export function emptyEdits() {
  return {format: "ndkcapture-edits/1", trim: {in: 0, out: 0}, cuts: [], layers: {}, markers: [], title: ""}
}

function clone(v) {
  return JSON.parse(JSON.stringify(v))
}

export function mergeSettings(base, patch) {
  const out = Object.assign({}, base, patch || {})
  out.transform = Object.assign({}, base.transform, (patch && patch.transform) || {})
  return out
}

/** Settings of `layer` at time t (ms): recorded initial + timeline changes up to t, then the edit overrides. */
export function settingsAt(rec, layer, t) {
  const m = rec.manifest
  let s = mergeSettings(defaultSettings(layer), (m.initial && m.initial[layer]) || {})
  for (const c of rec.timeline) {
    if (c.t > t) break
    if (c.layer === layer) s = mergeSettings(s, c.set)
  }
  const o = rec.edits.layers[layer]
  if (o && o.override) s = mergeSettings(s, o.override)
  return s
}

/** Parse a proxy chunk: one JSON object per line {t, d} (t = ms, d = base64 JPEG). */
export function parseProxyChunk(text) {
  const out = []
  for (const line of String(text || "").split("\n")) {
    if (!line) continue
    try {
      const f = JSON.parse(line)
      if (typeof f.t === "number" && typeof f.d === "string") out.push({t: f.t, d: f.d})
    } catch (e) {
      /* skip a torn line */
    }
  }
  return out
}

function readU32(b, o) {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
}

function readU64(b, o) {
  return readU32(b, o) + readU32(b, o + 4) * 4294967296
}

export function base64ToBytes(s) {
  if (typeof atob === "function") {
    const bin = atob(s)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  }
  return new Uint8Array(Buffer.from(s, "base64"))
}

/** Parse NKC1-framed packets: [u8 layer][u8 flags][u16 0][u64 ts_ns][u32 size][payload]... */
export function parsePackets(bytes, offset = 0) {
  const out = []
  let o = offset
  while (o + 16 <= bytes.length) {
    const layer = bytes[o]
    const flags = bytes[o + 1]
    const ts = readU64(bytes, o + 4)
    const size = readU32(bytes, o + 12)
    if (o + 16 + size > bytes.length) break
    out.push({layer: layer, key: (flags & 1) === 1, tsNs: ts, data: bytes.subarray(o + 16, o + 16 + size)})
    o += 16 + size
  }
  return out
}

/** Parse a native NKC1 track file written on the device: "NKC1" + u32 header length + JSON + packets. */
export function parseTrackFile(bytes) {
  if (bytes.length < 8 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== "NKC1")
    throw new Error("Not an NKC1 track")
  const n = readU32(bytes, 4)
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + n)))
  return {header: header, packets: parsePackets(bytes, 8 + n)}
}

/** Parse a streamed packet chunk (one base64 NKC1 packet batch per line). */
export function parsePacketChunk(text) {
  const out = []
  for (const line of String(text || "").split("\n")) if (line) out.push(...parsePackets(base64ToBytes(line)))
  return out
}

/** Index of the last frame with t <= time (or -1). Frames are sorted by t. */
export function frameIndexAt(frames, time) {
  let lo = 0
  let hi = frames.length - 1
  let best = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (frames[mid].t <= time) {
      best = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return best
}

/** Build a recording from its manifest + edits and a loader for chunk files. */
export async function loadRecording(manifest, edits, readText) {
  if (!manifest || manifest.format !== FORMAT) throw new Error("Not an ndkcapture/1 recording")
  const rec = {
    manifest: manifest,
    edits: Object.assign(emptyEdits(), edits || {}),
    timeline: (manifest.timeline || []).slice().sort((a, b) => a.t - b.t),
    markers: (manifest.markers || []).slice().sort((a, b) => a.t - b.t),
    frames: {},
    packets: {},
    duration: manifest.durationMs || 0
  }
  const chunks = manifest.chunks || {}
  for (const layer of LAYERS) {
    const proxy = []
    for (let i = 0; i < (chunks[layer + ".proxy"] || 0); i++)
      proxy.push(...parseProxyChunk(await readText(layer + ".proxy." + i + ".ndjson")))
    proxy.sort((a, b) => a.t - b.t)
    if (proxy.length) rec.frames[layer] = proxy
    const packets = []
    for (let i = 0; i < (chunks[layer + ".nkc"] || 0); i++)
      packets.push(...parsePacketChunk(await readText(layer + ".nkc." + i + ".b64")))
    if (packets.length) rec.packets[layer] = packets
  }
  if (!rec.duration) {
    for (const layer of Object.keys(rec.frames)) {
      const f = rec.frames[layer]
      rec.duration = Math.max(rec.duration, f[f.length - 1].t)
    }
  }
  if (!rec.edits.trim.out || rec.edits.trim.out > rec.duration) rec.edits.trim.out = rec.duration
  return rec
}

/** Playback timeline after trim and cuts: list of [from, to] source ranges, in order. */
export function playRanges(rec) {
  const a = Math.max(0, rec.edits.trim.in || 0)
  const b = Math.min(rec.duration, rec.edits.trim.out || rec.duration)
  let ranges = [[a, b]]
  const cuts = (rec.edits.cuts || []).slice().sort((x, y) => x.from - y.from)
  for (const c of cuts) {
    const next = []
    for (const [s, e] of ranges) {
      if (c.to <= s || c.from >= e) next.push([s, e])
      else {
        if (c.from > s) next.push([s, c.from])
        if (c.to < e) next.push([c.to, e])
      }
    }
    ranges = next
  }
  return ranges.filter(([s, e]) => e - s > 1)
}

export function editedDuration(rec) {
  return playRanges(rec).reduce((n, [s, e]) => n + (e - s), 0)
}

/** Map an edited-timeline time to a source time. */
export function sourceTime(rec, editedT) {
  let left = editedT
  for (const [s, e] of playRanges(rec)) {
    if (left <= e - s) return s + left
    left -= e - s
  }
  const r = playRanges(rec)
  return r.length ? r[r.length - 1][1] : 0
}

/** Layer draw list at source time t: visible layers with a frame, sorted by z. */
export function drawList(rec, t) {
  const out = []
  for (const layer of VISUAL) {
    const frames = rec.frames[layer]
    if (!frames) continue
    const s = settingsAt(rec, layer, t)
    const o = rec.edits.layers[layer]
    if (!s.enabled || (o && o.hidden)) continue
    const i = frameIndexAt(frames, t)
    if (i < 0) continue
    out.push({layer: layer, frame: i, settings: s})
  }
  out.sort((a, b) => a.settings.z - b.settings.z)
  return out
}

/** Summary used by the library and the tests. */
export function describe(rec) {
  const layers = {}
  for (const layer of LAYERS) {
    const f = rec.frames[layer]
    const p = rec.packets[layer]
    if (f || p)
      layers[layer] = {
        proxyFrames: f ? f.length : 0,
        packets: p ? p.length : 0,
        keyPackets: p ? p.filter((x) => x.key).length : 0
      }
  }
  return {
    name: rec.manifest.name,
    duration: rec.duration,
    edited: editedDuration(rec),
    layers: layers,
    markers: rec.markers.length + (rec.edits.markers || []).length,
    changes: rec.timeline.length
  }
}

/** ffmpeg recipe for the full-quality native tracks (optional, for a final render outside the Studio). */
export function ffmpegRecipe(rec) {
  const native = (rec.manifest.layers || []).filter((l) => l.source === "native")
  if (!native.length) return ""
  const lines = ["# Extract the native tracks first: node tools/nkc-extract.mjs <recording folder>"]
  const inputs = native.map((l) => (l.codec === "aac" ? "-i " + l.id + ".aac" : "-r 30 -i " + l.id + ".h265"))
  lines.push("ffmpeg " + inputs.join(" ") + " -c copy layers.mkv")
  const [a, b] = [(rec.edits.trim.in || 0) / 1000, (rec.edits.trim.out || rec.duration) / 1000]
  lines.push("# trimmed: ffmpeg -ss " + a.toFixed(3) + " -to " + b.toFixed(3) + " -i layers.mkv -c copy trimmed.mkv")
  return lines.join("\n")
}

export function cloneEdits(edits) {
  return clone(edits)
}
