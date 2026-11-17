// SPECS Inc. 2027
// NDK Capture Studio. Two views:
//   Live  : the Lens streams its layers; the Studio composites them and every layer control is sent
//           back to the Lens (setLayer), so encoding and composition are edited while streaming.
//   Edit  : open a recording (from the plugin, a folder, or ?recording=<url>), scrub the timeline,
//           trim / cut, override any layer setting, add markers and a title, save edits.json next to
//           the recording (tracks are never changed) and export the composite as WebM.
import {composite, drawTitle, ImageCache} from "./compositor.js"
import {
  cloneEdits,
  defaultSettings,
  describe,
  drawList,
  editedDuration,
  ffmpegRecipe,
  loadRecording,
  sourceTime,
  VISUAL
} from "./model.js"

const $ = (id) => document.getElementById(id)
const params = new URLSearchParams(location.search)
const api = params.get("api") || ""
const state = {
  view: "live",
  liveSeq: {camera: 0, ar: 0, ui: 0, mic: 0},
  liveFrames: {},
  liveSettings: null,
  liveStats: null,
  liveRecording: null,
  serverUp: false,
  rec: null,
  recSource: null, // {kind: "server", id} | {kind: "url", base} | {kind: "folder"}
  playing: false,
  t: 0, // edited-timeline ms
  lastTick: 0,
  selected: "camera",
  dirty: false
}
const cache = new ImageCache(240)
window.ndkcapture = {state: state} // test hook

// ---------- server

async function getJSON(path) {
  const r = await fetch(api + path, {cache: "no-store"})
  if (!r.ok) throw new Error(path + " " + r.status)
  return r.json()
}

async function command(action, args) {
  if (!state.serverUp) return
  try {
    await fetch(api + "/api/command", {method: "POST", body: JSON.stringify({action: action, args: args || {}})})
  } catch (e) {
    toast("Command failed: " + e)
  }
}

async function pollLive() {
  try {
    const q = Object.keys(state.liveSeq)
      .map((k) => k + "=" + state.liveSeq[k])
      .join("&")
    const live = await getJSON("/api/live?" + q)
    state.serverUp = true
    for (const layer of Object.keys(live.frames || {})) {
      const f = live.frames[layer]
      state.liveSeq[layer] = f.seq
      state.liveFrames[layer] = f
    }
    if (live.settings) state.liveSettings = live.settings
    state.liveStats = live.stats ? safeParse(live.stats) : null
    state.liveRecording = live.recording
  } catch (e) {
    state.serverUp = false
  }
  renderLiveStatus()
  setTimeout(pollLive, state.view === "live" ? 100 : 1000)
}

function safeParse(s) {
  try {
    return typeof s === "string" ? JSON.parse(s) : s
  } catch (e) {
    return null
  }
}

// ---------- layer controls (shared by Live and Edit)

const CONTROLS = [
  {key: "enabled", label: "On", type: "check"},
  {key: "opacity", label: "Opacity", type: "range", min: 0, max: 1, step: 0.01},
  {key: "blend", label: "Blend", type: "select", options: ["normal", "add", "screen", "multiply"]},
  {key: "z", label: "Order", type: "number", min: 0, max: 9, step: 1},
  {key: "transform.scale", label: "Scale", type: "range", min: 0.1, max: 3, step: 0.01},
  {key: "transform.x", label: "X", type: "range", min: -1, max: 1, step: 0.01},
  {key: "transform.y", label: "Y", type: "range", min: -1, max: 1, step: 0.01},
  {key: "transform.rotation", label: "Rotate", type: "range", min: -180, max: 180, step: 1},
  {key: "proxyFps", label: "Proxy fps", type: "number", min: 0, max: 30, step: 1, live: true},
  {key: "fps", label: "Encode fps", type: "number", min: 0, max: 60, step: 1, live: true},
  {key: "bitrate", label: "Bitrate", type: "number", min: 0, max: 50000000, step: 100000, live: true},
  {key: "keyFrameInterval", label: "Key every", type: "number", min: 0, max: 300, step: 1, live: true}
]

function getPath(o, path) {
  return path.split(".").reduce((v, k) => (v == null ? v : v[k]), o)
}

function patchFor(path, value) {
  const [a, b] = path.split(".")
  return b ? {[a]: {[b]: value}} : {[a]: value}
}

function renderLayerControls(container, settings, onChange, liveOnly) {
  container.innerHTML = ""
  for (const c of CONTROLS) {
    if (c.live && !liveOnly) continue
    const row = document.createElement("label")
    row.className = "ctl"
    const name = document.createElement("span")
    name.textContent = c.label
    row.appendChild(name)
    let input
    const value = getPath(settings, c.key)
    if (c.type === "select") {
      input = document.createElement("select")
      for (const o of c.options) {
        const opt = document.createElement("option")
        opt.value = o
        opt.textContent = o
        input.appendChild(opt)
      }
      input.value = value
    } else {
      input = document.createElement("input")
      input.type = c.type === "check" ? "checkbox" : c.type
      if (c.type === "check") input.checked = !!value
      else {
        input.min = c.min
        input.max = c.max
        input.step = c.step
        input.value = value
      }
    }
    input.dataset.key = c.key
    const fire = () => {
      const v = c.type === "check" ? input.checked : c.type === "select" ? input.value : Number(input.value)
      onChange(patchFor(c.key, v))
    }
    input.addEventListener(c.type === "range" ? "input" : "change", fire)
    row.appendChild(input)
    container.appendChild(row)
  }
}

function renderTabs(container, current, onPick) {
  container.innerHTML = ""
  for (const layer of VISUAL.concat(["mic"])) {
    const b = document.createElement("button")
    b.textContent = layer
    b.className = layer === current ? "tab on" : "tab"
    b.onclick = () => onPick(layer)
    container.appendChild(b)
  }
}

// ---------- Live view

function liveLayerSettings(layer) {
  return (state.liveSettings && state.liveSettings[layer]) || defaultSettings(layer)
}

function renderLiveControls() {
  renderTabs($("live-tabs"), state.selected, (layer) => {
    state.selected = layer
    renderLiveControls()
  })
  renderLayerControls(
    $("live-controls"),
    liveLayerSettings(state.selected),
    (patch) => {
      // Optimistic local update, then the Lens confirms with a settings message.
      const cur = liveLayerSettings(state.selected)
      const next = Object.assign({}, cur, patch)
      if (patch.transform) next.transform = Object.assign({}, cur.transform, patch.transform)
      state.liveSettings = Object.assign({}, state.liveSettings || {}, {[state.selected]: next})
      command("setLayer", {layer: state.selected, set: patch})
    },
    true
  )
}

function drawLive() {
  const canvas = $("live-canvas")
  const ctx = canvas.getContext("2d")
  const layers = []
  for (const layer of VISUAL) {
    const f = state.liveFrames[layer]
    const s = liveLayerSettings(layer)
    if (!f || !s.enabled) continue
    layers.push({image: cache.get(layer + ":" + f.seq, f.data), settings: s})
  }
  layers.sort((a, b) => a.settings.z - b.settings.z)
  composite(ctx, canvas.width, canvas.height, layers)
}

function renderLiveStatus() {
  const el = $("live-status")
  if (!el) return
  if (!state.serverUp) {
    el.textContent = "Studio server not reachable. Open this page from the NDK Capture plugin (Window → NDKCapture)."
    return
  }
  const layers = Object.keys(state.liveFrames)
  const stats = state.liveStats && state.liveStats.layers
  let text = layers.length ? "Live layers: " + layers.join(", ") : "Waiting for a Lens… press Play in Lens Studio."
  if (stats)
    text +=
      " · native: " +
      Object.keys(stats)
        .map((k) => k + " " + stats[k].frames + "f " + Math.round(stats[k].bytes / 1024) + "KB")
        .join(" · ")
  if (state.liveRecording) text += " · ● recording " + state.liveRecording
  el.textContent = text
  $("btn-record").textContent = state.liveRecording ? "Stop & Save" : "Record"
}

// ---------- Edit view

async function openFromServer(id) {
  const base = "/api/recordings/" + encodeURIComponent(id) + "/"
  const read = async (f) => {
    const r = await fetch(api + base + f, {cache: "no-store"})
    return r.ok ? r.text() : ""
  }
  const manifest = JSON.parse(await read("manifest.json"))
  const editsText = await read("edits.json")
  await openRecording(manifest, editsText ? JSON.parse(editsText) : null, read, {kind: "server", id: id})
}

async function openFromUrl(base) {
  if (!base.endsWith("/")) base += "/"
  const read = async (f) => {
    const r = await fetch(base + f, {cache: "no-store"})
    return r.ok ? r.text() : ""
  }
  const manifest = JSON.parse(await read("manifest.json"))
  const editsText = await read("edits.json")
  await openRecording(manifest, editsText ? safeParse(editsText) : null, read, {kind: "url", base: base})
}

async function openFromFolder(files) {
  const byName = {}
  for (const f of files) byName[f.name] = f
  if (!byName["manifest.json"]) return toast("That folder has no manifest.json")
  const read = async (n) => (byName[n] ? byName[n].text() : "")
  const manifest = JSON.parse(await read("manifest.json"))
  const edits = byName["edits.json"] ? safeParse(await read("edits.json")) : null
  await openRecording(manifest, edits, read, {kind: "folder"})
}

async function openRecording(manifest, edits, read, source) {
  state.rec = await loadRecording(manifest, edits, read)
  state.recSource = source
  state.t = 0
  state.playing = false
  state.dirty = false
  setView("edit")
  renderEditor()
  toast("Opened " + manifest.name)
}

function renderEditor() {
  const rec = state.rec
  if (!rec) return
  const d = describe(rec)
  $("edit-title").textContent = d.name
  $("edit-info").textContent =
    "Duration " +
    (d.duration / 1000).toFixed(1) +
    "s · edited " +
    (d.edited / 1000).toFixed(1) +
    "s · " +
    Object.keys(d.layers)
      .map((k) => k + " (" + (d.layers[k].proxyFrames || 0) + " proxy, " + (d.layers[k].packets || 0) + " native)")
      .join(" · ") +
    " · " +
    d.changes +
    " live changes · " +
    d.markers +
    " markers"
  $("trim-in").value = rec.edits.trim.in / 1000
  $("trim-out").value = rec.edits.trim.out / 1000
  $("title-text").value = rec.edits.title || ""
  $("ffmpeg").textContent = ffmpegRecipe(rec) || "No native tracks in this recording (editor capture)."
  renderTabs($("edit-tabs"), state.selected, (layer) => {
    state.selected = layer
    renderEditor()
  })
  const s = cloneEdits((rec.edits.layers[state.selected] || {}).override || {})
  const shown = Object.assign(defaultSettings(state.selected), rec.manifest.initial[state.selected] || {}, s)
  renderLayerControls(
    $("edit-controls"),
    shown,
    (patch) => {
      const o = (rec.edits.layers[state.selected] = rec.edits.layers[state.selected] || {})
      o.override = Object.assign({}, o.override || {}, patch)
      if (patch.transform) o.override.transform = Object.assign({}, (o.override || {}).transform || {}, patch.transform)
      markDirty()
    },
    false
  )
  renderMarkers()
}

function renderMarkers() {
  const rec = state.rec
  const bar = $("markers")
  bar.innerHTML = ""
  const total = rec.duration || 1
  for (const m of rec.markers.concat(rec.edits.markers || [])) {
    const dot = document.createElement("div")
    dot.className = "marker"
    dot.style.left = (100 * m.t) / total + "%"
    dot.style.background = m.color || "#f5a524"
    dot.title = m.label + " @ " + (m.t / 1000).toFixed(2) + "s"
    bar.appendChild(dot)
  }
}

function markDirty() {
  state.dirty = true
  $("btn-save").disabled = false
}

function drawEdit() {
  const rec = state.rec
  if (!rec) return
  const canvas = $("edit-canvas")
  const ctx = canvas.getContext("2d")
  const src = sourceTime(rec, state.t)
  const list = drawList(rec, src).map((l) => ({
    image: cache.get(l.layer + ":" + l.frame, rec.frames[l.layer][l.frame].d),
    settings: l.settings
  }))
  composite(ctx, canvas.width, canvas.height, list)
  drawTitle(ctx, canvas.width, canvas.height, rec.edits.title)
  const total = editedDuration(rec)
  $("scrub").max = Math.max(1, total)
  $("scrub").value = state.t
  $("time").textContent = (state.t / 1000).toFixed(2) + " / " + (total / 1000).toFixed(2) + "s"
}

async function saveEdits() {
  const rec = state.rec
  if (!rec) return
  const text = JSON.stringify(rec.edits, null, 1)
  if (state.recSource.kind === "server") {
    const r = await fetch(api + "/api/recordings/" + encodeURIComponent(state.recSource.id) + "/edits.json", {
      method: "PUT",
      body: text
    })
    if (!r.ok) return toast("Save failed (" + r.status + ")")
    toast("Edits saved next to the recording")
  } else {
    download("edits.json", new Blob([text], {type: "application/json"}))
    toast("Downloaded edits.json — put it next to manifest.json")
  }
  state.dirty = false
  $("btn-save").disabled = true
}

async function exportVideo() {
  const rec = state.rec
  if (!rec) return
  const canvas = $("edit-canvas")
  const stream = canvas.captureStream(30)
  const type = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm"
  const recorder = new MediaRecorder(stream, {mimeType: type, videoBitsPerSecond: 6000000})
  const chunks = []
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const done = new Promise((resolve) => (recorder.onstop = resolve))
  state.t = 0
  state.playing = true
  recorder.start(250)
  const total = editedDuration(rec)
  await new Promise((resolve) => {
    const check = () => (state.t >= total || !state.playing ? resolve() : setTimeout(check, 50))
    check()
  })
  state.playing = false
  recorder.stop()
  await done
  const blob = new Blob(chunks, {type: "video/webm"})
  window.ndkcapture.lastExport = {bytes: blob.size, type: blob.type}
  download((rec.manifest.name || "capture").replace(/[^A-Za-z0-9_-]+/g, "-") + ".webm", blob)
  toast("Exported " + Math.round(blob.size / 1024) + " KB")
}

function download(name, blob) {
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

// ---------- library

async function renderLibrary() {
  const list = $("library")
  list.innerHTML = ""
  if (!state.serverUp) {
    list.textContent = "Open a recording folder (Open folder…) or start Lens Studio with the NDK Capture plugin."
    return
  }
  try {
    const {recordings} = await getJSON("/api/recordings")
    if (!recordings.length) list.textContent = "No recordings yet. Press Record in the Live view."
    for (const r of recordings) {
      const b = document.createElement("button")
      b.className = "rec"
      b.textContent =
        r.name + " · " + ((r.durationMs || 0) / 1000).toFixed(1) + "s · " + (r.layers || []).join(" ") + (r.edited ? " · edited" : "")
      b.onclick = () => openFromServer(r.id).catch((e) => toast("Open failed: " + e))
      list.appendChild(b)
    }
  } catch (e) {
    list.textContent = "Couldn't list recordings: " + e
  }
}

// ---------- shell

function setView(view) {
  state.view = view
  for (const v of ["live", "edit"]) {
    $("view-" + v).hidden = v !== view
    $("nav-" + v).className = v === view ? "on" : ""
  }
  if (view === "edit" && !state.rec) renderLibrary()
}

function toast(message) {
  const el = $("toast")
  el.textContent = message
  el.className = "show"
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => (el.className = ""), 2600)
}

function frame(now) {
  const dt = state.lastTick ? now - state.lastTick : 0
  state.lastTick = now
  if (state.view === "live") drawLive()
  else if (state.rec) {
    if (state.playing) {
      state.t += dt
      const total = editedDuration(state.rec)
      if (state.t >= total) {
        state.t = total
        state.playing = false
      }
    }
    drawEdit()
  }
  requestAnimationFrame(frame)
}

function wire() {
  $("nav-live").onclick = () => setView("live")
  $("nav-edit").onclick = () => setView("edit")
  $("btn-stream").onclick = () => command("startStream")
  $("btn-stop-stream").onclick = () => command("stopStream")
  $("btn-record").onclick = () => command(state.liveRecording ? "stopRecording" : "startRecording")
  $("btn-mark").onclick = () => command("marker", {label: "Marker"})
  $("btn-key").onclick = () => command("keyFrame")
  $("btn-play").onclick = () => {
    if (!state.rec) return
    if (state.t >= editedDuration(state.rec)) state.t = 0
    state.playing = !state.playing
  }
  $("scrub").oninput = (e) => {
    state.playing = false
    state.t = Number(e.target.value)
  }
  $("trim-in").onchange = (e) => {
    state.rec.edits.trim.in = Math.max(0, Number(e.target.value) * 1000)
    markDirty()
    renderEditor()
  }
  $("trim-out").onchange = (e) => {
    state.rec.edits.trim.out = Math.max(0, Number(e.target.value) * 1000)
    markDirty()
    renderEditor()
  }
  $("btn-cut").onclick = () => {
    // Cut one second at the playhead.
    const s = sourceTime(state.rec, state.t)
    state.rec.edits.cuts.push({from: s, to: s + 1000})
    markDirty()
    renderEditor()
  }
  $("btn-add-marker").onclick = () => {
    state.rec.edits.markers.push({t: sourceTime(state.rec, state.t), label: "Edit marker", color: "#60a5fa"})
    markDirty()
    renderMarkers()
  }
  $("title-text").oninput = (e) => {
    state.rec.edits.title = e.target.value
    markDirty()
  }
  $("btn-save").onclick = () => saveEdits()
  $("btn-export").onclick = () => exportVideo().catch((e) => toast("Export failed: " + e))
  $("btn-library").onclick = () => {
    state.rec = null
    renderLibrary()
  }
  $("folder").onchange = (e) => openFromFolder(Array.from(e.target.files)).catch((err) => toast("Open failed: " + err))
}

wire()
renderLiveControls()
// Refresh the controls from the Lens's confirmed settings, but never while the user is editing one.
setInterval(() => {
  if (state.view === "live" && !$("live-controls").contains(document.activeElement)) renderLiveControls()
}, 1500)
pollLive()
requestAnimationFrame(frame)
if (params.get("recording")) {
  openFromUrl(params.get("recording")).catch((e) => toast("Open failed: " + e))
} else setView(params.get("view") === "edit" ? "edit" : "live")
window.ndkcapture.openFromUrl = openFromUrl
window.ndkcapture.exportVideo = exportVideo
window.ndkcapture.describe = () => (state.rec ? describe(state.rec) : null)
