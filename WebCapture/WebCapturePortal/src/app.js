// SPECS Inc. 2027
// Web Capture portal: Recordings, Edit (replay,
// re-frame, trim/cut/speed, look, titles, music, export). Static files only: serve this folder
// with the WebCapture Lens Studio plugin (http://127.0.0.1:47790) or any static server.
import {Exporter} from "./exporter.js";
import {mountScheduler} from "./scheduler-ui.js";
import {mountAccordion} from "./accordion.js";
import {
  advance,
  clipLength,
  clipTimeForSource,
  defaultEdits,
  formatTime,
  frameAt,
  frameFromSnapshot,
  LOOKS,
  autoFloor,
  defaultFx,
  normalizeCuts,
  normalizeRecording,
  OUTPUTS,
  outputSize,
  PRESETS,
  applyPreset,
  sceneBounds,
  SPEEDS,
  summarize,
  titlesAt,
  toJson,
  trimRange
} from "./model.js";
import {CloudSource, download, loadPortalConfig, loadSettings, LocalSource, readFileAsRecording, saveSettings} from "./sources.js";
import {autoSync} from "./autosync.js";
import {matchMove} from "./matchmove.js";
import {VIDEO_PROFILE} from "./video.js";
import {detectHands} from "./handseg.js";
import {Viewer} from "./viewer.js";
import {
  cacheClear,
  cacheLoad,
  DEFAULT_PROMPT,
  enhanceBackground,
  loadAiSettings,
  MODELS,
  saveAiSettings
} from "./ai.js";

const $ = (id) => document.getElementById(id);
const state = {
  settings: loadSettings(),
  view: "library",
  rec: null,
  origin: null, // {source: LocalSource|CloudSource|null, key, file}
  t: 0,
  playing: false,
  lastTick: 0,
  cutStart: null,
  music: null, // {buffer, name}
  selected: null,
  dirty: false
};

// When the portal is served by the plugin, the API is on the same origin.
if (location.protocol.startsWith("http") && location.port === "47790") state.settings.local = location.origin;
const local = () => new LocalSource(state.settings.local);
const cloud = (code) => new CloudSource(state.settings.cloudUrl, state.settings.cloudKey, code || state.settings.code);

const edViewer = new Viewer($("edViewport"));
edViewer.cameraMode = "recorded";
const exporter = new Exporter(edViewer);

// ---------- helpers

function toast(message, error) {
  const el = $("toast");
  el.textContent = message;
  el.className = "toast" + (error ? " err" : "");
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(
    () => {
      el.hidden = true;
    },
    error ? 6000 : 3000
  );
  if (error) console.warn("[WebCapture] " + message);
}

function hex(c) {
  if (!Array.isArray(c)) return c || "#cccccc";
  const h = (x) => ("0" + Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16)).slice(-2);
  return "#" + h(c[0]) + h(c[1]) + h(c[2]);
}

function fromHex(s) {
  const n = parseInt(s.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
}

function setView(view) {
  state.view = view;
  for (const b of document.querySelectorAll(".tab")) b.classList.toggle("active", b.dataset.view === view);
  for (const s of document.querySelectorAll(".view")) s.classList.toggle("active", s.id === "view-" + view);
  if (view === "library") refreshLibrary();
  if (view === "editor" && state.rec && !state.rec._prepared) void prepareRecording(); // opened quietly for a preview
  requestAnimationFrame(() => {
    edViewer.resize();
    drawTimeline();
  });
}

function setConn(text, mode) {
  $("connText").textContent = text;
  $("conn").className = "conn" + (mode ? " " + mode : "");
}

// ---------- Connection status (top bar)

async function pollStatus() {
  try {
    const st = await local().status();
    const lens = st.lenses && st.lenses.length;
    const cloudOn = cloud().configured();
    setConn(lens ? "Lens Studio · " + st.lenses[0].lens : cloudOn ? "Snap Cloud" : "Lens Studio plugin", lens || cloudOn ? "on" : "");
  } catch (e) {
    const cloudOn = cloud().configured();
    setConn(cloudOn ? "Snap Cloud" : "Not connected", cloudOn ? "on" : "");
  }
  setTimeout(pollStatus, 3000);
}

// ---------- 2 · Recordings

let scheduler = null;

async function refreshLibrary() {
  const rows = [];
  const errors = [];
  try {
    rows.push(...(await local().list()));
  } catch (e) {
    errors.push("Lens Studio: not reachable");
  }
  const c = cloud();
  if (c.configured()) {
    try {
      rows.push(...(await c.list()));
    } catch (e) {
      errors.push("Snap Cloud: " + e.message);
    }
  }
  // One list, newest first, whatever the source.
  rows.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  state.libraryRows = rows;
  if (scheduler) scheduler.refresh();
  const tb = $("libRows");
  tb.innerHTML = "";
  for (const r of rows) {
    const tr = document.createElement("tr");
    const when = r.createdAt ? new Date(r.createdAt).toLocaleString() : "";
    tr.innerHTML =
      '<td class="n"></td><td><span class="badge"></span></td><td>' +
      formatTime(r.duration || 0) +
      "</td><td>" +
      (r.objects || "") +
      "</td><td>" +
      when +
      '</td><td class="a"></td>';
    tr.querySelector(".n").textContent = r.name + (r.edited ? " · edited" : "") + (r.broken ? " · unreadable" : "");
    tr.querySelector(".badge").textContent = r.source === "local" ? "Lens Studio" : "Snap Cloud";
    const open = document.createElement("button");
    open.textContent = "Open";
    open.className = "primary";
    open.onclick = () => openFrom(r.source === "local" ? local() : c, r.key);
    tr.querySelector(".a").appendChild(open);
    if (r.source === "local") {
      const del = document.createElement("button");
      del.textContent = "Delete";
      del.onclick = async () => {
        if (confirm("Delete " + r.name + "?")) {
          await local().remove(r.key);
          refreshLibrary();
        }
      };
      tr.querySelector(".a").appendChild(del);
    }
    tb.appendChild(tr);
  }
  $("libEmpty").hidden = rows.length > 0;
  if (errors.length && !rows.length)
    $("libEmpty").textContent = errors.join(" · ") + ". Open a file or the sample instead.";
}

async function openFrom(source, key) {
  try {
    const rec = await source.load(key);
    openRecording(rec, {source, key});
  } catch (e) {
    toast("Could not open: " + e.message, true);
  }
}

// ---------- 3 · Editor

let quietOpen = false; // true while a recording is opened only to render a preview frame

function openRecording(rec, origin, opts) {
  quietOpen = !!(opts && opts.quiet);
  state.preparing = false;
  $("prepOverlay").hidden = true;
  state.rec = normalizeRecording(rec);
  state.origin = origin || null;
  state.t = trimRange(state.rec)[0];
  state.playing = false;
  state.cutStart = null;
  state.selected = null;
  state.dirty = false;
  edViewer.clear();
  edViewer.select(null);
  edViewer.setAssets(state.rec);
  const e = state.rec.edits;
  edViewer.cameraMode = e.camera.mode || "recorded";
  if (edViewer.cameraMode === "recorded" && !state.rec.camera.t.length) edViewer.cameraMode = "orbit";
  $("edCamera").value = edViewer.cameraMode;
  edViewer.setLook(e.look, e.background);
  edViewer.showLabels = !!e.showLabels;
  edViewer.logo = Object.assign({}, e.logo);
  $("edLabels").checked = edViewer.showLabels;
  $("edLogo").checked = !!e.logo.on;
  $("edLogoColor").value = e.logo.color;
  $("edLogoPlace").value = e.logo.place;
  $("edLogoSize").value = String(Math.round(e.logo.size * 100));
  $("edLook").value = e.look;
  $("edBg").value = e.background || LOOKS[e.look].background;
  applyFx();
  applySync();
  quietOpen = false;
  loadAiFrames();
  $("edSpeed").value = String(e.speed || 1);
  $("edOutput").value = e.output.preset;
  $("edFit").value = e.output.fit || "fill";
  $("edZoom").value = String(Math.round((e.output.zoom || 1) * 100));
  $("edPanX").value = String(Math.round((e.output.panX == null ? 0.5 : e.output.panX) * 100));
  $("edPanY").value = String(Math.round((e.output.panY == null ? 0.5 : e.output.panY) * 100));
  applyOutput();
  $("edFps").value = String(e.output.fps);
  const s = summarize(state.rec);
  $("edName").textContent = s.name;
  $("edMeta").textContent =
    formatTime(s.duration) +
    " · " +
    s.objects +
    " objects · " +
    s.keyframes +
    " keyframes" +
    (s.cameraKeys ? " · camera" : "") +
    (origin && origin.source ? " · " + origin.source.label() : " · file");
  renderEdObjects();
  renderTitles();
  renderSelected();
  edViewer.update(frameAt(state.rec, edViewer.sceneTime(state.t)));
  edViewer.frameBounds(sceneBounds(state.rec));
  $("edSaveState").textContent = "";
  if (!(opts && opts.quiet)) setView("editor");
}

// ---------- AI background

let aiAbort = null;

function aiSettings() {
  return (state.ai = state.ai || loadAiSettings());
}

function wireAi() {
  const ai = aiSettings();
  const sel = $("aiModel");
  for (const m of MODELS) {
    const o = document.createElement("option");
    o.value = m.id;
    o.textContent = m.label;
    sel.appendChild(o);
  }
  sel.value = MODELS.some((m) => m.id === ai.model) ? ai.model : MODELS[0].id;
  $("aiKey").value = ai.key;
  $("aiPrompt").value = ai.prompt || DEFAULT_PROMPT;
  $("aiSize").value = ai.size || "1K";
  $("aiEvery").value = ai.every || 1;
  const save = () => {
    Object.assign(ai, {
      key: $("aiKey").value.trim(),
      model: $("aiModel").value,
      prompt: $("aiPrompt").value.trim() || DEFAULT_PROMPT,
      size: $("aiSize").value,
      every: Math.max(1, Math.min(30, parseInt($("aiEvery").value, 10) || 1))
    });
    saveAiSettings(ai);
    updateAiInfo();
  };
  for (const id of ["aiKey", "aiModel", "aiPrompt", "aiSize", "aiEvery"]) $(id).onchange = save;
  $("aiKey").oninput = save;
  $("aiPromptReset").onclick = () => {
    $("aiPrompt").value = DEFAULT_PROMPT;
    save();
  };
  $("aiUse").onchange = () => {
    edViewer.useEnhanced = $("aiUse").checked;
    drawEditor();
  };
  $("aiRun").onclick = runAi;
  $("aiCancel").onclick = () => aiAbort && aiAbort.abort();
  $("aiReset").onclick = async () => {
    if (!state.rec || !state.rec.background) return;
    await cacheClear(state.rec);
    edViewer.enhanced = new Map();
    updateAiInfo();
    drawEditor();
  };
}

function aiIndexes() {
  const n = state.rec && state.rec.background ? state.rec.background.frames.length : 0;
  const step = aiSettings().every || 1;
  const out = [];
  for (let i = 0; i < n; i += step) out.push(i);
  return out;
}

function updateAiInfo() {
  const has = !!(state.rec && state.rec.background && state.rec.background.frames.length);
  $("aiRun").disabled = !has;
  if (!has) {
    $("aiStatus").textContent = "This recording has no camera background to improve.";
    return;
  }
  const done = edViewer.enhanced ? edViewer.enhanced.size : 0;
  const total = state.rec.background.frames.length;
  $("aiStatus").textContent =
    total + " frames" + (done ? " · " + done + " improved" : "") + " · this run: " + aiIndexes().length + " image requests.";
}

async function runAi() {
  const ai = aiSettings();
  if (!state.rec || !state.rec.background) return;
  if (!ai.key) {
    toast("Paste your API key in the AI background section first", true);
    $("aiKey").focus();
    return;
  }
  if (!ai.consent) {
    if (
      !confirm(
        "Improve the background with AI?\n\nThe camera frames of this recording are sent to Google's Gemini API with your key. They are not sent anywhere else.\n\nContinue?"
      )
    )
      return;
    ai.consent = true;
    saveAiSettings(ai);
  }
  const indexes = aiIndexes();
  aiAbort = new AbortController();
  $("aiRun").hidden = true;
  $("aiCancel").hidden = false;
  $("aiProgress").hidden = false;
  $("aiBar").style.width = "0%";
  let firstError = "";
  const result = await enhanceBackground({
    rec: state.rec,
    settings: ai,
    indexes,
    signal: aiAbort.signal,
    endpoint: window.webcaptureAiEndpoint,
    onProgress: (done, total, index, dataUrl, err) => {
      $("aiBar").style.width = Math.round((done / total) * 100) + "%";
      $("aiStatus").textContent = "Improving " + done + " / " + total + (err ? " · " + err : "");
      if (err && !firstError) firstError = err;
      if (dataUrl) {
        const img = new Image();
        img.src = dataUrl;
        img.decode().catch(() => {});
        edViewer.enhanced.set(index, img);
      }
    }
  });
  $("aiRun").hidden = false;
  $("aiCancel").hidden = true;
  $("aiProgress").hidden = true;
  updateAiInfo();
  if (aiAbort.signal.aborted) toast("Stopped. The frames done so far are kept.");
  else if (result.failures.length) toast("Some frames failed: " + (firstError || result.failures[0]), true);
  else toast("Background improved");
  aiAbort = null;
  drawEditor();
}

async function loadAiFrames() {
  edViewer.enhanced = new Map();
  edViewer.useEnhanced = true;
  $("aiUse").checked = true;
  if (!state.rec || !state.rec.background) return updateAiInfo();
  const cached = await cacheLoad(state.rec);
  for (const [i, url] of cached) {
    const img = new Image();
    img.src = url;
    edViewer.enhanced.set(i, img);
  }
  updateAiInfo();
}

function applySync() {
  const shift = state.rec.edits.videoShift || 0;
  edViewer.videoShift = shift;
  edViewer.setVideoShift(shift);
  $("edSync").value = Math.round(shift * 1000);
  $("syncVal").textContent = Math.round(shift * 1000) + " ms";
  const hasVideo = !!(state.rec.background && state.rec.background.video);
  $("syncRow").hidden = !hasVideo;
  $("syncAuto").hidden = !hasVideo;
  $("syncResult").textContent = "";
  $("syncHint").hidden = !hasVideo;
  $("lockRow").hidden = !hasVideo;
  $("profileRow").hidden = !hasVideo;
  applyProfile();
  applyDevice();
  applyLock();
  if (!quietOpen) void prepareRecording();
}

function currentProfile() {
  return Object.assign({}, VIDEO_PROFILE, state.rec.edits.videoProfile || {});
}

/** Tracks the camera video and locks the virtual camera to it. Resolves with the result or null; updates the lock panel. */
async function runLock(onProgress) {
  const rec = state.rec;
  const track = edViewer.videoTrack;
  if (!rec || !track || !track.ready) {
    toast("This recording has no camera video to lock", true);
    return null;
  }
  $("edLock").disabled = true;
  $("lockResult").textContent = "Tracking the camera… 0%";
  let result = null;
  try {
    const r = await matchMove(
      rec,
      track,
      (f) => {
        $("lockResult").textContent = "Tracking the camera… " + Math.round(f * 100) + "%";
        if (onProgress) onProgress(f);
      },
      currentProfile()
    );
    if (state.rec !== rec) return null;
    if (!r.stab) {
      $("lockResult").textContent = r.reason || "Could not lock this capture.";
    } else {
      const shift = Math.round(r.shift * 1000) / 1000;
      rec.edits.videoShift = shift;
      edViewer.setVideoShift(shift);
      $("edSync").value = Math.round(shift * 1000);
      $("syncVal").textContent = Math.round(shift * 1000) + " ms";
      r.stab.on = true;
      r.stab.note =
        "Locked: video offset " + Math.round(shift * 1000) + " ms, picture and head pose match " + r.score.toFixed(2) +
        ". The camera is nudged by " + r.stats.rmsDeg.toFixed(1) + "° on average (up to " + r.stats.maxDeg.toFixed(0) + "°).";
      rec.edits.stab = r.stab;
      applyLock();
      markDirty();
      track.restart(0);
      drawEditor();
      result = r;
    }
  } catch (e) {
    $("lockResult").textContent = "Lock failed: " + (e.message || e);
  }
  $("edLock").disabled = false;
  return result;
}

/** Finds the hands in the video (once per recording) and hands them to the viewer. */
async function runHands(onProgress) {
  const rec = state.rec;
  const track = edViewer.videoTrack;
  if (!rec || !track || !track.ready) return null;
  $("handsResult").textContent = "Finding hands… 0%";
  try {
    const h = await detectHands(track, (f) => {
      $("handsResult").textContent = "Finding hands… " + Math.round(f * 100) + "%";
      if (onProgress) onProgress(f);
    });
    if (state.rec !== rec) return null;
    rec.edits.hands = h;
    edViewer.setHands(h);
    markDirty();
    $("handsResult").textContent =
      h.found > 0
        ? "Hands found in " + Math.round((h.found / Math.max(1, h.total / 2)) * 100) + "% of the frames."
        : "No hands in view in this capture.";
    drawEditor();
    return h;
  } catch (e) {
    $("handsResult").textContent = "Hand detection is not available here (" + (e.message || e) + ").";
    return null;
  }
}

const prep = {steps: [], weights: [], done: 0};

function showPrep(labels) {
  $("prepSteps").innerHTML = labels.map((l) => "<li>" + l + "</li>").join("");
  prep.steps = [...$("prepSteps").children];
  prep.weights = labels.map(() => 1 / labels.length);
  prep.done = 0;
  $("prepBar").style.width = "0%";
  $("prepOverlay").hidden = false;
}

function prepProgress(step, f) {
  prep.steps.forEach((li, i) => {
    li.className = i < step ? "done" : i === step ? "active" : "";
  });
  const frac = prep.weights.slice(0, step).reduce((a, b) => a + b, 0) + prep.weights[step] * Math.max(0, Math.min(1, f));
  $("prepBar").style.width = Math.round(frac * 100) + "%";
}

/**
 * On open: lock the camera to the scene and find the hands (what is not stored yet), behind a loader. Playing before
 * that is done looks scattered, so playback is blocked meanwhile.
 */
const posterCache = new Map();
const posterJobs = new Map(); // key -> promise (one render per frame, one at a time)
let posterChain = Promise.resolve();

/**
 * One frame of a recording in an output format, as a JPEG data URL (the Schedule tab's phone previews). The editor's
 * viewer renders it off-screen at a small fixed size, then everything it touched is put back.
 */
function posterFor(rec, preset, width) {
  const key = rec.source + "|" + rec.key + "|" + preset;
  if (posterCache.has(key)) return Promise.resolve(posterCache.get(key));
  if (!posterJobs.has(key)) {
    const job = posterChain.then(() => renderPoster(rec, preset, width, key));
    posterChain = job.catch(() => null);
    posterJobs.set(key, job);
    job.finally(() => posterJobs.delete(key));
  }
  return posterJobs.get(key);
}

async function renderPoster(rec, preset, width, key) {
  if (exporter.running) return null;
  const source = rec.source === "local" ? local() : cloud();
  try {
    const open = state.rec && state.origin && state.origin.key === rec.key && state.origin.source === source;
    if (!open) openRecording(await source.load(rec.key), {source, key: rec.key}, {quiet: true});
    for (let n = 0; n < 40 && edViewer.videoTrack && !edViewer.videoTrack.ready; n++) await new Promise((r) => setTimeout(r, 100));
    const out = OUTPUTS[preset] || OUTPUTS.device;
    const saved = {t: state.t, logo: edViewer.logo, output: edViewer.output, fixed: edViewer.fixedSize};
    const [a, b] = trimRange(state.rec);
    state.t = a + (b - a) * 0.4;
    edViewer.logo = Object.assign({}, saved.logo, {on: false});
    edViewer.setOutput({ratio: out.width / out.height, fit: "fill", zoom: 1, panX: 0.5, panY: 0.5});
    edViewer.fixedSize = {width, height: Math.round((width * out.height) / out.width)};
    edViewer.resize();
    for (let n = 0; n < 25; n++) {
      drawEditor();
      if (!edViewer.videoTrack || edViewer.backgroundAt(state.t)) break;
      await new Promise((r) => setTimeout(r, 120));
    }
    drawEditor();
    const url = edViewer.composite.toDataURL("image/jpeg", 0.85);
    edViewer.fixedSize = saved.fixed;
    edViewer.logo = saved.logo;
    edViewer.output = saved.output;
    state.t = saved.t;
    applyOutput();
    edViewer.resize();
    drawEditor();
    posterCache.set(key, url);
    return url;
  } catch (e) {
    console.warn("poster failed:", e);
    return null;
  }
}

/** The output format on the editor viewer: its shape, and which part of the picture it shows. */
function applyOutput() {
  if (!state.rec) return;
  const o = state.rec.edits.output;
  const size = outputSize(o.preset, state.rec.meta && state.rec.meta.aspect);
  const crop = size.auto ? null : {ratio: size.width / size.height, fit: o.fit || "fill", zoom: o.zoom || 1, panX: o.panX, panY: o.panY};
  edViewer.setOutput(crop);
  const filling = !crop || crop.fit === "fill";
  for (const id of ["edZoom", "edPanX", "edPanY"]) $(id).disabled = !filling;
  $("edCropInfo").textContent = size.width + "×" + size.height;
  drawEditor();
}

async function prepareRecording() {
  const rec = state.rec;
  if (!rec || rec._prepared) return;
  if (!(rec.background && rec.background.video)) return;
  const wantLock = !rec.edits.stab;
  const dev = rec.edits.device || {};
  const wantHands = dev.hands !== false && !rec.edits.hands;
  if (!wantLock && !wantHands) return;
  rec._prepared = true;
  state.playing = false;
  state.preparing = true;
  const labels = [];
  if (wantLock) labels.push("Locking the camera to the scene");
  if (wantHands) labels.push("Finding your hands");
  showPrep(labels);
  // the video decoder needs a moment to come up
  for (let n = 0; n < 40 && state.rec === rec; n++) {
    const tr = edViewer.videoTrack;
    if (tr && tr.ready) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  {
    // A camera stream that stopped early leaves a frozen picture: say so instead of letting it look like a bug here.
    const tr = edViewer.videoTrack;
    const dur = (rec.meta && rec.meta.duration) || 0;
    if (tr && tr.ready && tr.times.length && dur > 2) {
      const last = tr.times[tr.times.length - 1];
      if (last < dur * 0.6) {
        toast("The camera video in this recording stops at " + Math.max(0, last).toFixed(1) + " s of " + dur.toFixed(1) + " s (the glasses' camera stalled). Record again.", true);
      }
    }
  }
  if (edViewer.videoNote) toast(edViewer.videoNote + " The replay shows the virtual objects without the camera picture.", true);
  let step = 0;
  prepProgress(0, 0);
  if (state.rec === rec && wantLock) {
    await runLock((f) => prepProgress(step, f));
    step++;
  }
  if (state.rec === rec && wantHands) {
    prepProgress(step, 0);
    await runHands((f) => prepProgress(step, f));
  }
  if (state.rec === rec) {
    prepProgress(labels.length, 1);
    await new Promise((r) => setTimeout(r, 250));
  }
  if (state.rec === rec) {
    state.preparing = false;
    $("prepOverlay").hidden = true;
  }
}

function applyDevice() {
  markPreset();
  const d = Object.assign({mode: "device", opacity: 1, tint: 0.6, solid: 0.35, hands: true}, state.rec.edits.device || {});
  edViewer.setDevice(d);
  edViewer.setHands(state.rec.edits.hands || null);
  $("edComposite").value = d.mode;
  $("edOpacity").value = Math.round(d.opacity * 100);
  $("vopVal").textContent = Math.round(d.opacity * 100) + "%";
  $("edTint").value = Math.round(d.tint * 100);
  $("tintVal").textContent = Math.round(d.tint * 100) + "%";
  $("tintRow").hidden = d.mode !== "device";
  $("solidRow").hidden = d.mode !== "device";
  $("edSolid").value = Math.round((d.solid == null ? 0.35 : d.solid) * 100);
  $("solidVal").textContent = Math.round((d.solid == null ? 0.35 : d.solid) * 100) + "%";
  $("edHands").checked = d.hands !== false;
  $("edHandsShow").checked = !!d.handsDebug;
  const hasVideo = !!(state.rec.background && state.rec.background.video);
  // Scene style and background colour only show without a camera picture behind the objects
  $("styleRow").hidden = hasVideo;
  $("handsRow").hidden = !hasVideo;
  $("handsResult").hidden = !hasVideo;
}

function applyProfile() {
  const pr = currentProfile();
  edViewer.setVideoProfile(state.rec.edits.videoProfile);
  $("pfZoom").value = pr.zoom;
  $("pfPanX").value = pr.panX;
  $("pfPanY").value = pr.panY;
  $("pfZoomVal").textContent = pr.zoom.toFixed(2);
  $("pfPanXVal").textContent = pr.panX.toFixed(3);
  $("pfPanYVal").textContent = pr.panY.toFixed(3);
}

function applyLock() {
  const stab = state.rec.edits.stab;
  edViewer.setStab(stab);
  const has = !!(stab && stab.t && stab.t.length);
  $("edLockOn").disabled = !has;
  $("edLockOn").checked = has && stab.on !== false;
  $("lockStrengthRow").hidden = !has;
  const pct = has ? Math.round((stab.strength == null ? 1 : stab.strength) * 100) : 100;
  $("edLockStrength").value = pct;
  $("lockVal").textContent = pct + "%";
  $("lockResult").textContent = has && stab.note ? stab.note : "";
}

/** Highlights the preset the recording uses (none once a slider was moved by hand). */
function markPreset() {
  const active = state.rec ? state.rec.edits.preset || "" : "";
  for (const b of document.querySelectorAll("#edPresets button")) b.classList.toggle("on", b.dataset.preset === active);
}

function lightLabels(dl) {
  $("dlIntVal").textContent = (+dl.intensity).toFixed(1);
  $("dlSoftVal").textContent = Math.round(dl.softness * 100) + "%";
  $("dlRotVal").textContent = Math.round(dl.rotation) + "°";
  $("dlHeightVal").textContent = Math.round(dl.height) + "°";
  // one light: with it on, the shadow plane follows it, so its own direction sliders are off
  for (const id of ["fxShAz", "fxShEl", "fxShSoft"]) $(id).disabled = !!dl.on;
}

const warmLabel = (w) => (Math.abs(w) < 0.025 ? "neutral" : (w > 0 ? "warm " : "cold ") + Math.round(Math.abs(w) * 100) + "%");

function applyFx() {
  const f = state.rec.edits.fx;
  edViewer.setFx(f, autoFloor(state.rec));
  $("fxShadows").checked = f.shadows.on;
  $("fxShStrength").value = f.shadows.strength;
  $("fxShSoft").value = f.shadows.softness;
  $("fxShAz").value = f.shadows.azimuth;
  $("fxShEl").value = f.shadows.elevation;
  const os = f.objectShadow;
  $("osOn").checked = os.on;
  $("osAngle").value = os.angle;
  $("osDistance").value = os.distance;
  $("osSoft").value = os.softness;
  $("osStrength").value = os.strength;
  $("osContact").value = os.contact;
  $("popOpacity").value = f.pop.opacity;
  $("popSpread").value = f.pop.spread;
  $("popFeather").value = f.pop.feather;
  const dl = f.light || (f.light = defaultFx().light);
  $("dlOn").checked = !!dl.on;
  $("dlIntensity").value = dl.intensity;
  $("dlSoft").value = dl.softness;
  $("dlRot").value = dl.rotation;
  $("dlHeight").value = dl.height;
  $("dlColor").value = dl.color || "#ffffff";
  lightLabels(dl);
  $("fxWarmth").value = f.warmth || 0;
  $("warmVal").textContent = warmLabel(f.warmth || 0);
  $("fxExposure").value = f.exposure;
  $("fxContrast").value = f.contrast;
  $("fxSaturation").value = f.saturation;
  $("fxGlow").value = f.glow;
  $("fxVignette").value = f.vignette;
  setAligning(false);
}

function setAligning(on, mode) {
  state.aligning = !!on;
  edViewer.setAligning(on, mode);
  $("planeMode").hidden = !on;
  $("planeAlign").textContent = on ? "Done" : "Align plane";
  $("planeAlign").classList.toggle("primary", !!on);
  if (on) {
    // Align against the real video: use the camera's point of view and hold the frame.
    state.playing = false;
    if (edViewer.cameraMode === "orbit" && state.rec.camera.t.length) {
      edViewer.cameraMode = "recorded";
      $("edCamera").value = "recorded";
    }
    drawEditor();
  }
}

function markDirty() {
  state.dirty = true;
  $("edSaveState").textContent = "Unsaved changes";
}

function objEdit(id) {
  const e = state.rec.edits.objects;
  if (!e[id]) e[id] = {};
  return e[id];
}

function renderEdObjects() {
  const ul = $("edObjects");
  ul.innerHTML = "";
  if (!state.rec) return;
  for (const o of state.rec.objects) {
    const ov = state.rec.edits.objects[o.id] || {};
    const li = document.createElement("li");
    li.className = (ov.hidden ? "off " : "") + (state.selected === o.id ? "sel" : "");
    li.innerHTML =
      '<button class="eye" title="Show / hide"></button><span class="sw"></span><span class="name"></span>';
    li.querySelector(".eye").textContent = ov.hidden ? "◌" : "●";
    li.querySelector(".sw").style.background = hex(ov.color || o.color);
    li.querySelector(".name").textContent = ov.label || o.name;
    li.querySelector(".eye").onclick = (ev) => {
      ev.stopPropagation();
      objEdit(o.id).hidden = !ov.hidden;
      markDirty();
      renderEdObjects();
    };
    li.onclick = () => selectObject(o.id);
    ul.appendChild(li);
  }
}

function selectObject(id) {
  state.selected = id;
  edViewer.select(id);
  renderEdObjects();
  renderSelected();
}

function renderSelected() {
  const box = $("edSelected");
  const o = state.rec && state.selected ? state.rec.objects.find((x) => x.id === state.selected) : null;
  box.hidden = !o;
  if (!o) return;
  const ov = state.rec.edits.objects[o.id] || {};
  const off = ov.offset || [0, 0, 0, 0, 0, 0, 1];
  $("selName").textContent = o.name;
  $("offX").value = off[0];
  $("offY").value = off[1];
  $("offZ").value = off[2];
  $("offR").value = off[4];
  $("offS").value = off[6];
  $("selColor").value = hex(ov.color || o.color);
  $("selLabel").value = ov.label || "";
  $("selHide").textContent = ov.hidden ? "Show" : "Hide";
}

function readOffsetInputs() {
  if (!state.selected) return;
  const n = (id, d) => {
    const v = parseFloat($(id).value);
    return isFinite(v) ? v : d;
  };
  objEdit(state.selected).offset = [
    n("offX", 0),
    n("offY", 0),
    n("offZ", 0),
    0,
    n("offR", 0),
    0,
    Math.max(0.01, n("offS", 1))
  ];
  markDirty();
}

function renderTitles() {
  const ul = $("edTitles");
  ul.innerHTML = "";
  if (!state.rec) return;
  state.rec.edits.titles.forEach((t, i) => {
    const li = document.createElement("li");
    li.innerHTML =
      '<span class="name"></span><select title="Position"><option value="top">Top</option><option value="center">Centre</option><option value="bottom">Bottom</option></select><button class="eye" title="Remove">✕</button>';
    li.querySelector(".name").textContent = t.text + " · " + formatTime(t.start) + "–" + formatTime(t.end);
    const sel = li.querySelector("select");
    sel.value = t.position || "bottom";
    sel.onchange = () => {
      t.position = sel.value;
      markDirty();
    };
    li.querySelector("button").onclick = () => {
      state.rec.edits.titles.splice(i, 1);
      markDirty();
      renderTitles();
    };
    ul.appendChild(li);
  });
}

function currentClipTime() {
  return clipTimeForSource(state.rec, state.t);
}

function updateTransport() {
  if (!state.rec) return;
  const [a, b] = trimRange(state.rec);
  $("edTime").textContent = formatTime(state.t) + " / " + formatTime(state.rec.meta.duration);
  $("edClip").textContent =
    "Clip " + formatTime(clipLength(state.rec)) + " (" + formatTime(a) + "–" + formatTime(b) + ")";
  $("edPlay").textContent = state.playing ? "❚❚" : "▶";
  $("edCut").textContent = state.cutStart == null ? "Cut start" : "Cut end";
}

function drawTimeline() {
  const cv = $("edTimeline");
  const w = cv.clientWidth || 600;
  if (cv.width !== w) cv.width = w;
  const h = cv.height;
  const g = cv.getContext("2d");
  g.clearRect(0, 0, w, h);
  if (!state.rec) return;
  const d = Math.max(0.001, state.rec.meta.duration);
  const x = (s) => (s / d) * w;
  // key density
  const nBins = Math.max(1, Math.floor(w / 3));
  if (!state.binCache || state.binCache.rec !== state.rec || state.binCache.n !== nBins) {
    const counts = new Array(nBins).fill(0);
    for (const id in state.rec.tracks)
      for (const t of state.rec.tracks[id].t) counts[Math.min(nBins - 1, Math.floor((t / d) * nBins))]++;
    state.binCache = {rec: state.rec, n: nBins, bins: counts, max: Math.max(1, ...counts)};
  }
  const bins = state.binCache.bins;
  const max = state.binCache.max;
  g.fillStyle = "#3a404a";
  bins.forEach((n, i) => {
    const bh = (n / max) * 34;
    g.fillRect(i * 3, 46 - bh, 2, bh);
  });
  // trim
  const [a, b] = trimRange(state.rec);
  g.fillStyle = "rgba(0,0,0,0.55)";
  g.fillRect(0, 0, x(a), h);
  g.fillRect(x(b), 0, w - x(b), h);
  // cuts
  for (const c of normalizeCuts(state.rec.edits.cuts, d)) {
    g.fillStyle = "rgba(255,90,90,0.28)";
    g.fillRect(x(c.start), 0, x(c.end) - x(c.start), h);
  }
  if (state.cutStart != null) {
    g.fillStyle = "#ff5a5a";
    g.fillRect(x(state.cutStart) - 1, 0, 2, h);
  }
  // markers + titles + shots
  g.fillStyle = "#ffd600";
  for (const m of state.rec.markers) g.fillRect(x(m.t) - 1, 48, 2, 10);
  g.font = "10px system-ui";
  g.fillStyle = "#9aa0aa";
  g.fillText("keys", 4, 12);
  for (const s of state.rec.edits.camera.shots) {
    g.fillStyle = "#e8e9ec";
    g.beginPath();
    g.arc(x(s.t), 64, 3.5, 0, Math.PI * 2);
    g.fill();
  }
  // trim handles
  g.fillStyle = "#e8e9ec";
  g.fillRect(x(a), 0, 2, h);
  g.fillRect(x(b) - 2, 0, 2, h);
  // playhead
  g.fillStyle = "#ffd600";
  g.fillRect(x(state.t) - 1, 0, 2, h);
}

function seekFromEvent(ev) {
  if (!state.rec) return;
  const r = $("edTimeline").getBoundingClientRect();
  state.t = Math.max(0, Math.min(state.rec.meta.duration, ((ev.clientX - r.left) / r.width) * state.rec.meta.duration));
  drawEditor();
}

function drawEditor() {
  if (!state.rec) return;
  edViewer.update(frameAt(state.rec, edViewer.sceneTime(state.t)));
  edViewer.render(state.rec.edits.camera.shots, state.t, titlesAt(state.rec, currentClipTime()));
  updateTransport();
  drawTimeline();
}

// ---------- main loop

function loop(now) {
  const dt = state.lastTick ? Math.min(0.1, (now - state.lastTick) / 1000) : 0;
  state.lastTick = now;
  if (state.view === "editor" && state.rec && !exporter.running) {
    if (state.playing) state.t = advance(state.rec, state.t, dt).t;
    drawEditor();
  }
  requestAnimationFrame(loop);
}

// ---------- theme (Specs design system: light and dark)

function initTheme() {
  let theme = "dark";
  try {
    theme = localStorage.getItem("webcapture.theme") || "dark";
  } catch (e) {
    /* default */
  }
  const apply = () => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    $("themeBtn").textContent = theme === "dark" ? "Light" : "Dark";
    $("themeBtn").title = "Switch to the " + (theme === "dark" ? "light" : "dark") + " theme";
  };
  $("themeBtn").onclick = () => {
    theme = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("webcapture.theme", theme);
    } catch (e) {
      /* this page only */
    }
    apply();
    drawTimeline();
  };
  apply();
}

// ---------- wiring

function wire() {
  for (const key in PRESETS) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.preset = key;
    b.textContent = PRESETS[key].label;
    b.title = PRESETS[key].hint;
    b.onmouseenter = () => ($("presetHint").textContent = PRESETS[key].hint + ".");
    b.onclick = () => {
      if (!state.rec) return;
      applyPreset(state.rec.edits, key);
      applyFx();
      applyDevice();
      markPreset();
      markDirty();
      drawEditor();
    };
    $("edPresets").appendChild(b);
  }
  mountAccordion(document.querySelector("#view-editor .side.right"));
  initTheme();
  for (const b of document.querySelectorAll(".tab")) b.onclick = () => setView(b.dataset.view);
  $("settingsBtn").onclick = () => {
    $("setLocal").value = state.settings.local;
    $("setCloudUrl").value = state.settings.cloudUrl;
    $("setCloudKey").value = state.settings.cloudKey;
    $("settings").showModal();
  };
  $("setSave").onclick = () => {
    state.settings.local = $("setLocal").value.trim() || state.settings.local;
    state.settings.cloudUrl = $("setCloudUrl").value.trim();
    state.settings.cloudKey = $("setCloudKey").value.trim();
    saveSettings(state.settings);
    refreshLibrary();
  };
  $("libRefresh").onclick = refreshLibrary;
  $("libFile").onchange = async (e) => {
    const f = e.target.files[0];
    if (f) {
      try {
        openRecording(await readFileAsRecording(f), {file: f.name});
      } catch (err) {
        toast(err.message, true);
      }
    }
    e.target.value = "";
  };
  $("libSample").onclick = async () => {
    try {
      const r = await fetch("samples/demo.webcapture.json");
      openRecording(await r.json(), {file: "demo.webcapture.json"});
    } catch (e) {
      toast("Sample missing: " + e.message, true);
    }
  };

  for (const s of SPEEDS) {
    const o = document.createElement("option");
    o.value = String(s);
    o.textContent = s + "×";
    $("edSpeed").appendChild(o);
  }
  for (const k in LOOKS) {
    const o = document.createElement("option");
    o.value = k;
    o.textContent = LOOKS[k].label;
    $("edLook").appendChild(o);
  }
  const groups = {};
  for (const k in OUTPUTS) {
    const g = OUTPUTS[k].group || "Other";
    if (!groups[g]) {
      groups[g] = document.createElement("optgroup");
      groups[g].label = g;
      $("edOutput").appendChild(groups[g]);
    }
    const o = document.createElement("option");
    o.value = k;
    o.textContent = OUTPUTS[k].label;
    groups[g].appendChild(o);
  }
  $("edPlay").onclick = () => {
    if (state.rec && !state.preparing) state.playing = !state.playing;
  };
  $("edSpeed").onchange = () => {
    if (!state.rec) return;
    state.rec.edits.speed = parseFloat($("edSpeed").value);
    markDirty();
  };
  $("edIn").onclick = () => {
    if (!state.rec) return;
    const [, b] = trimRange(state.rec);
    state.rec.edits.trim = [state.t, b];
    markDirty();
  };
  $("edOut").onclick = () => {
    if (!state.rec) return;
    const [a] = trimRange(state.rec);
    state.rec.edits.trim = [a, state.t];
    markDirty();
  };
  $("edCut").onclick = () => {
    if (!state.rec) return;
    if (state.cutStart == null) state.cutStart = state.t;
    else {
      state.rec.edits.cuts.push({start: state.cutStart, end: state.t});
      state.rec.edits.cuts = normalizeCuts(state.rec.edits.cuts, state.rec.meta.duration);
      state.cutStart = null;
      markDirty();
    }
  };
  $("edUncut").onclick = () => {
    if (!state.rec) return;
    state.rec.edits.cuts = [];
    state.rec.edits.trim = null;
    state.cutStart = null;
    markDirty();
  };
  $("edCamera").onchange = () => {
    if (!state.rec) return;
    edViewer.cameraMode = $("edCamera").value;
    state.rec.edits.camera.mode = edViewer.cameraMode;
    edViewer.select(state.selected);
    markDirty();
  };
  $("edShotAdd").onclick = () => {
    if (!state.rec) return;
    state.rec.edits.camera.shots.push(edViewer.currentShot(state.t));
    state.rec.edits.camera.shots.sort((x, y) => x.t - y.t);
    markDirty();
    toast(
      "Shot added at " +
        formatTime(state.t) +
        " (" +
        state.rec.edits.camera.shots.length +
        " shots). Switch the camera to Camera shots to play them."
    );
  };
  $("edShotClear").onclick = () => {
    if (state.rec) {
      state.rec.edits.camera.shots = [];
      markDirty();
    }
  };
  $("edFrame").onclick = () => {
    if (state.rec) {
      if (edViewer.cameraMode !== "orbit") {
        edViewer.cameraMode = "orbit";
        $("edCamera").value = "orbit";
      }
      edViewer.frameBounds(sceneBounds(state.rec));
    }
  };
  $("edLabels").onchange = () => {
    if (!state.rec) return;
    edViewer.showLabels = state.rec.edits.showLabels = $("edLabels").checked;
    markDirty();
  };
  $("edLook").onchange = () => {
    if (!state.rec) return;
    state.rec.edits.look = $("edLook").value;
    state.rec.edits.background = null;
    $("edBg").value = LOOKS[state.rec.edits.look].background;
    edViewer.setLook(state.rec.edits.look);
    markDirty();
  };
  $("edBg").oninput = () => {
    if (!state.rec) return;
    state.rec.edits.background = $("edBg").value;
    edViewer.setLook(state.rec.edits.look, state.rec.edits.background);
    markDirty();
  };
  const fxBind = (id, set) => {
    $(id).oninput = () => {
      if (!state.rec) return;
      set(state.rec.edits.fx, $(id));
      state.rec.edits.preset = "";
      markPreset();
      edViewer.setFx(state.rec.edits.fx);
      markDirty();
    };
  };
  fxBind("fxShadows", (f, el) => (f.shadows.on = el.checked));
  fxBind("fxShStrength", (f, el) => {
    f.shadows.strength = +el.value;
    f.shadows.on = true;
    $("fxShadows").checked = true;
  });
  fxBind("fxShSoft", (f, el) => {
    f.shadows.softness = +el.value;
    f.shadows.on = true;
    $("fxShadows").checked = true;
  });
  fxBind("fxShAz", (f, el) => {
    f.shadows.azimuth = +el.value;
    f.shadows.on = true;
    $("fxShadows").checked = true;
  });
  fxBind("fxShEl", (f, el) => {
    f.shadows.elevation = +el.value;
    f.shadows.on = true;
    $("fxShadows").checked = true;
  });
  fxBind("osOn", (f, el) => (f.objectShadow.on = el.checked));
  fxBind("osAngle", (f, el) => {
    f.objectShadow.angle = +el.value;
    f.objectShadow.on = true;
    $("osOn").checked = true;
  });
  fxBind("osDistance", (f, el) => {
    f.objectShadow.distance = +el.value;
    f.objectShadow.on = true;
    $("osOn").checked = true;
  });
  fxBind("osSoft", (f, el) => {
    f.objectShadow.softness = +el.value;
    f.objectShadow.on = true;
    $("osOn").checked = true;
  });
  fxBind("osStrength", (f, el) => {
    f.objectShadow.strength = +el.value;
    f.objectShadow.on = true;
    $("osOn").checked = true;
  });
  fxBind("osContact", (f, el) => {
    f.objectShadow.contact = +el.value;
    f.objectShadow.on = true;
    $("osOn").checked = true;
  });
  fxBind("popOpacity", (f, el) => (f.pop.opacity = +el.value));
  fxBind("popSpread", (f, el) => (f.pop.spread = +el.value));
  fxBind("popFeather", (f, el) => (f.pop.feather = +el.value));
  edViewer.onPlaneChange = () => {
    if (state.rec) markDirty();
  };
  $("planeAlign").onclick = () => state.rec && setAligning(!state.aligning, "translate");
  for (const b of $("planeMode").querySelectorAll("button")) {
    b.onclick = () => {
      for (const x of $("planeMode").querySelectorAll("button")) x.classList.toggle("on", x === b);
      edViewer.planeTransform.setMode(b.dataset.mode);
    };
  }
  $("planeReset").onclick = () => {
    if (!state.rec) return;
    state.rec.edits.fx.shadows.plane = null;
    setAligning(false);
    edViewer.setFx(state.rec.edits.fx);
    markDirty();
  };
  const lightBind = (id, set, enable) => {
    $(id).oninput = () => {
      if (!state.rec) return;
      const f = state.rec.edits.fx;
      const dl = f.light || (f.light = defaultFx().light);
      set(dl, $(id));
      if (enable) {
        dl.on = true; // moving a slider switches the light on, so no slider is dead
        $("dlOn").checked = true;
      }
      lightLabels(dl);
      edViewer.setFx(f);
      markDirty();
      drawEditor();
    };
  };
  lightBind("dlOn", (dl, el) => (dl.on = el.checked), false);
  lightBind("dlIntensity", (dl, el) => (dl.intensity = +el.value), true);
  lightBind("dlSoft", (dl, el) => (dl.softness = +el.value), true);
  lightBind("dlRot", (dl, el) => (dl.rotation = +el.value), true);
  lightBind("dlHeight", (dl, el) => (dl.height = +el.value), true);
  lightBind("dlColor", (dl, el) => (dl.color = el.value), true);
  $("dlReset").onclick = () => {
    if (!state.rec) return;
    state.rec.edits.fx.light = defaultFx().light;
    applyFx();
    markDirty();
    drawEditor();
  };
  fxBind("fxWarmth", (f, el) => {
    f.warmth = +el.value;
    $("warmVal").textContent = warmLabel(f.warmth);
  });
  fxBind("fxExposure", (f, el) => (f.exposure = +el.value));
  fxBind("fxContrast", (f, el) => (f.contrast = +el.value));
  fxBind("fxSaturation", (f, el) => (f.saturation = +el.value));
  fxBind("fxGlow", (f, el) => (f.glow = +el.value));
  fxBind("fxVignette", (f, el) => (f.vignette = +el.value));
  wireAi();
  $("edAutoSync").onclick = async () => {
    const track = edViewer.videoTrack;
    if (!state.rec || !track || !track.ready) return toast("This recording has no camera video to sync", true);
    $("edAutoSync").disabled = true;
    $("syncResult").textContent = "Measuring… 0%";
    try {
      const r = await autoSync(state.rec, track, (f) => ($("syncResult").textContent = "Measuring… " + Math.round(f * 100) + "%"));
      if (r.score < 0.35) {
        $("syncResult").textContent = "Not enough head movement in this capture to measure (match " + r.score.toFixed(2) + "). Turn your head while recording.";
      } else {
        const shift = Math.round(r.shift * 1000) / 1000;
        state.rec.edits.videoShift = shift;
        edViewer.setVideoShift(shift);
        $("edSync").value = Math.round(shift * 1000);
        $("syncVal").textContent = Math.round(shift * 1000) + " ms";
        $("syncResult").textContent = "Synced: " + Math.round(shift * 1000) + " ms (match " + r.score.toFixed(2) + ")";
        markDirty();
        track.restart(0);
        drawEditor();
      }
    } catch (e) {
      $("syncResult").textContent = "Auto-sync failed: " + (e.message || e);
    }
    $("edAutoSync").disabled = false;
  };
  $("edLock").onclick = () => void runLock(null);
  const deviceInput = () => {
    if (!state.rec) return;
    const d = Object.assign({mode: "device", opacity: 1, tint: 0.6, solid: 0.35, hands: true}, state.rec.edits.device || {});
    d.mode = $("edComposite").value;
    d.opacity = +$("edOpacity").value / 100;
    d.tint = +$("edTint").value / 100;
    state.rec.edits.preset = "";
    markPreset();
    d.solid = +$("edSolid").value / 100;
    const handsWas = d.hands !== false;
    d.hands = $("edHands").checked;
    state.rec.edits.device = d;
    applyDevice();
    markDirty();
    drawEditor();
    if (d.hands && !handsWas && !state.rec.edits.hands && !state.preparing) {
      state.rec._prepared = false;
      void prepareRecording();
    }
  };
  for (const id of ["edComposite", "edOpacity", "edTint", "edSolid"]) $(id).oninput = deviceInput;
  $("edHandsShow").onchange = () => {
    if (!state.rec) return;
    const d = Object.assign({mode: "device", opacity: 1, tint: 0.6, solid: 0.35, hands: true}, state.rec.edits.device || {});
    d.handsDebug = $("edHandsShow").checked;
    state.rec.edits.device = d;
    applyDevice();
    drawEditor();
  };
  $("edHands").onchange = deviceInput;
  const profileInput = () => {
    if (!state.rec) return;
    state.rec.edits.videoProfile = {zoom: +$("pfZoom").value, panX: +$("pfPanX").value, panY: +$("pfPanY").value};
    applyProfile();
    markDirty();
    drawEditor();
  };
  for (const id of ["pfZoom", "pfPanX", "pfPanY"]) $(id).oninput = profileInput;
  $("pfReset").onclick = () => {
    if (!state.rec) return;
    state.rec.edits.videoProfile = null;
    applyProfile();
    markDirty();
    drawEditor();
  };
  $("edLockOn").onchange = () => {
    if (!state.rec || !state.rec.edits.stab) return;
    state.rec.edits.stab.on = $("edLockOn").checked;
    applyLock();
    markDirty();
    drawEditor();
  };
  $("edLockStrength").oninput = () => {
    if (!state.rec || !state.rec.edits.stab) return;
    state.rec.edits.stab.strength = +$("edLockStrength").value / 100;
    $("lockVal").textContent = $("edLockStrength").value + "%";
    applyLock();
    markDirty();
    drawEditor();
  };
  $("edSync").oninput = () => {
    if (!state.rec) return;
    state.rec.edits.videoShift = +$("edSync").value / 1000;
    $("syncVal").textContent = $("edSync").value + " ms";
    edViewer.setVideoShift(state.rec.edits.videoShift);
    markDirty();
    drawEditor();
  };
  $("fxReset").onclick = () => {
    if (!state.rec) return;
    state.rec.edits.fx = defaultFx();
    applyFx();
    markDirty();
  };
  const logoInput = () => {
    if (!state.rec) return;
    const l = state.rec.edits.logo;
    l.on = $("edLogo").checked;
    l.color = $("edLogoColor").value;
    l.place = $("edLogoPlace").value;
    l.size = +$("edLogoSize").value / 100;
    edViewer.logo = Object.assign({}, l);
    markDirty();
    drawEditor();
  };
  for (const id of ["edLogo", "edLogoColor", "edLogoPlace", "edLogoSize"]) $(id).oninput = logoInput;
  $("edOutput").onchange = () => {
    if (state.rec) {
      state.rec.edits.output.preset = $("edOutput").value;
      applyOutput();
      markDirty();
    }
  };
  const cropInput = () => {
    if (!state.rec) return;
    const o = state.rec.edits.output;
    o.fit = $("edFit").value;
    o.zoom = +$("edZoom").value / 100;
    o.panX = +$("edPanX").value / 100;
    o.panY = +$("edPanY").value / 100;
    applyOutput();
    markDirty();
  };
  for (const id of ["edFit", "edZoom", "edPanX", "edPanY"]) $(id).oninput = cropInput;
  $("edCropReset").onclick = () => {
    if (!state.rec) return;
    Object.assign(state.rec.edits.output, {fit: "fill", zoom: 1, panX: 0.5, panY: 0.5});
    $("edFit").value = "fill";
    $("edZoom").value = "100";
    $("edPanX").value = "50";
    $("edPanY").value = "50";
    applyOutput();
    markDirty();
  };
  $("edFps").onchange = () => {
    if (state.rec) {
      state.rec.edits.output.fps = parseInt($("edFps").value, 10);
      markDirty();
    }
  };
  $("titleAdd").onclick = () => {
    if (!state.rec) return;
    const text = $("titleText").value.trim();
    if (!text) return;
    const start = currentClipTime();
    state.rec.edits.titles.push({
      text,
      start,
      end: Math.min(clipLength(state.rec), start + 3),
      position: "bottom",
      size: 64
    });
    $("titleText").value = "";
    markDirty();
    renderTitles();
  };
  $("musicFile").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f || !state.rec) return;
    try {
      const ac = new AudioContext();
      const buffer = await ac.decodeAudioData(await f.arrayBuffer());
      ac.close();
      state.music = {buffer, name: f.name};
      state.rec.edits.music = {name: f.name, volume: parseFloat($("musicVol").value), offset: 0};
      $("musicName").textContent = f.name + " · " + formatTime(buffer.duration);
      markDirty();
    } catch (err) {
      toast("Could not read " + f.name + ": " + err.message, true);
    }
  };
  $("musicVol").oninput = () => {
    if (state.rec && state.rec.edits.music) {
      state.rec.edits.music.volume = parseFloat($("musicVol").value);
      markDirty();
    }
  };
  for (const id of ["offX", "offY", "offZ", "offR", "offS"]) $(id).oninput = readOffsetInputs;
  $("selColor").oninput = () => {
    if (state.selected) {
      objEdit(state.selected).color = fromHex($("selColor").value);
      markDirty();
      renderEdObjects();
    }
  };
  $("selLabel").oninput = () => {
    if (state.selected) {
      objEdit(state.selected).label = $("selLabel").value.trim() || undefined;
      markDirty();
      renderEdObjects();
    }
  };
  $("selReset").onclick = () => {
    if (state.selected) {
      delete state.rec.edits.objects[state.selected];
      markDirty();
      renderEdObjects();
      renderSelected();
    }
  };
  $("selHide").onclick = () => {
    if (state.selected) {
      const ov = objEdit(state.selected);
      ov.hidden = !ov.hidden;
      markDirty();
      renderEdObjects();
      renderSelected();
    }
  };
  edViewer.onSelect = (id) => selectObject(id);
  edViewer.onOffsetDrag = (id, delta) => {
    const ov = objEdit(id);
    const off = ov.offset || [0, 0, 0, 0, 0, 0, 1];
    ov.offset = [off[0] + delta[0], off[1] + delta[1], off[2] + delta[2], off[3], off[4], off[5], off[6]];
    markDirty();
    renderSelected();
  };
  $("edExport").onclick = exportVideo;
  $("edSave").onclick = saveEdits;
  $("edDownload").onclick = () => {
    if (state.rec) download(fileBase() + ".webcapture.json", toJson(state.rec));
  };

  const tl = $("edTimeline");
  let dragging = false;
  tl.onpointerdown = (e) => {
    dragging = true;
    tl.setPointerCapture(e.pointerId);
    seekFromEvent(e);
  };
  tl.onpointermove = (e) => {
    if (dragging) seekFromEvent(e);
  };
  tl.onpointerup = () => {
    dragging = false;
  };

  window.addEventListener("keydown", (e) => {
    if (state.view !== "editor" || !state.rec || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.code === "Space") {
      if (!state.preparing) state.playing = !state.playing;
      e.preventDefault();
    } else if (e.key === "i") $("edIn").click();
    else if (e.key === "o") $("edOut").click();
    else if (e.key === "c") $("edCut").click();
    else if (e.key === "ArrowRight") state.t = Math.min(state.rec.meta.duration, state.t + (e.shiftKey ? 1 : 1 / 30));
    else if (e.key === "ArrowLeft") state.t = Math.max(0, state.t - (e.shiftKey ? 1 : 1 / 30));
  });
  let dragDepth = 0;
  window.addEventListener("dragenter", (e) => {
    e.preventDefault();
    dragDepth++;
    $("drop").hidden = false;
  });
  window.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) $("drop").hidden = true;
  });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", async (e) => {
    e.preventDefault();
    dragDepth = 0;
    $("drop").hidden = true;
    const f = e.dataTransfer.files[0];
    if (f) {
      try {
        openRecording(await readFileAsRecording(f), {file: f.name});
      } catch (err) {
        toast(err.message, true);
      }
    }
  });
  window.addEventListener("beforeunload", (e) => {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
}

function fileBase() {
  return (state.rec.meta.name || "webcapture").replace(/[^A-Za-z0-9 _.-]/g, "-").trim() || "webcapture";
}

async function saveEdits() {
  if (!state.rec) return;
  const o = state.origin || {};
  try {
    if (o.source && o.key) {
      await o.source.save(o.key, state.rec);
      state.dirty = false;
      $("edSaveState").textContent = "Saved to " + o.source.label();
    } else {
      download(fileBase() + ".webcapture.json", toJson(state.rec));
      state.dirty = false;
      $("edSaveState").textContent = "Downloaded (opened from a file)";
    }
  } catch (e) {
    toast("Save failed: " + e.message, true);
  }
}

async function exportVideo(options) {
  if (!state.rec || exporter.running) return null;
  state.playing = false;
  const btn = $("edExport");
  const bar = $("edProgress");
  bar.hidden = false;
  try {
    const music = state.music
      ? {buffer: state.music.buffer, volume: state.rec.edits.music ? state.rec.edits.music.volume : 0.8}
      : null;
    const res = await exporter.run(
      state.rec,
      music,
      (p) => {
        bar.value = p;
      },
      options && options.size
    );
    if (!options || !options.noDownload) download(fileBase() + "." + res.extension, res.blob);
    toast(
      "Exported " +
        res.width +
        "×" +
        res.height +
        " " +
        res.extension.toUpperCase() +
        " (" +
        Math.round(res.blob.size / 1024) +
        " KB)"
    );
    return res;
  } catch (e) {
    toast("Export failed: " + e.message, true);
    return null;
  } finally {
    bar.hidden = true;
  }
}

// Test hooks (used by the package's headless tests; harmless otherwise).
window.webcapture = {
  state,
  openRecording,
  exportVideo,
  defaultEdits,
  viewers: {editor: edViewer},
  visibleObjects: () => [...edViewer.objects.values()].filter((e) => e.group.visible).length
};

wire();
scheduler = mountScheduler($("schedRoot"), {
  recordings: () => (state.libraryRows || []).filter((r) => !r.broken).map((r) => ({key: r.key, source: r.source, name: r.name, duration: r.duration})),
  openInEditor: async (rec, preset) => {
    const source = rec.source === "local" ? local() : cloud();
    try {
      const loaded = await source.load(rec.key);
      openRecording(loaded, {source, key: rec.key});
      state.rec.edits.output.preset = preset;
      $("edOutput").value = preset;
      applyOutput();
      markDirty();
      setView("editor");
    } catch (e) {
      toast("Could not open: " + e.message, true);
    }
  },
  poster: posterFor,
  toast
});
setView("library");
requestAnimationFrame(loop);
pollStatus();

// Fill Settings from config.json (project URL, key, capture code) and show every recording without typing anything.
loadPortalConfig(state.settings).then(() => {
  refreshLibrary();
});
