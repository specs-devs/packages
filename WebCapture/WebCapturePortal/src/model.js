// SPECS Inc. 2027
// Web Capture portal data model: no DOM, no three.js, so it runs (and is tested) in Node too.
//
// A recording (webcapture/1) holds per-object keyframe tracks relative to the capture origin.
// Edits live in recording.edits and never change the recorded tracks:
//   trim [in, out], cuts (removed sections), speed, per-object overrides (hidden, color, label,
//   offset pose), the look, titles, music, camera mode / shots, output settings.
// Like the Specs Capture Studio editor, the preview stays in source time and jumps over cuts;
// only the export removes them.

export const RECORDING_FORMAT = "webcapture/1";
export const SCENE_FORMAT = "webcapture-scene/1";
export const POSE = 10;
export const CAMERA = 8;
export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

export const LOOKS = {
  studio: {label: "Studio", background: "#1d2026", background2: "#0b0c0f", grid: true, light: "soft", style: "solid"},
  daylight: {
    label: "Daylight",
    background: "#cfe3f4",
    background2: "#f3f6f9",
    grid: true,
    light: "sun",
    style: "solid"
  },
  blueprint: {
    label: "Blueprint",
    background: "#0f2a4a",
    background2: "#0a1d33",
    grid: true,
    light: "flat",
    style: "wire"
  },
  midnight: {
    label: "Midnight",
    background: "#050507",
    background2: "#000000",
    grid: false,
    light: "rim",
    style: "solid"
  },
  paper: {label: "Paper", background: "#f4f1ea", background2: "#e8e3d7", grid: false, light: "flat", style: "solid"}
};

// Output formats. `social` ones list what they are for; `ratio` is width / height (null = follow the Lens camera).
export const OUTPUTS = {
  device: {label: "Original · 1464×1098 (Specs capture)", width: 1464, height: 1098, group: "Original"},
  lens: {label: "Match the Lens camera", width: 0, height: 1080, auto: true, group: "Original"},
  portrait1080: {label: "1080×1920 vertical", width: 1080, height: 1920, group: "Full HD"},
  landscape1080: {label: "1920×1080 horizontal", width: 1920, height: 1080, group: "Full HD"},
  landscape720: {label: "1280×720 horizontal", width: 1280, height: 720, group: "Full HD"},
  social34: {label: "3:4 · 1080×1440", width: 1080, height: 1440, group: "Social"},
  social45: {label: "4:5 · 1080×1350 (Instagram, LinkedIn, Reddit)", width: 1080, height: 1350, group: "Social"},
  social916: {label: "9:16 · 1080×1920 (TikTok, Reels, Shorts, Spotlight)", width: 1080, height: 1920, group: "Social"},
  square1080: {label: "1:1 · 1080×1080 (X)", width: 1080, height: 1080, group: "Social"}
};

/**
 * Which part of the source picture an output format shows, as a window in 0..1 of the source frame (u right, v down).
 *   fill: the window is the largest area of the output's shape inside the frame (divided by `zoom`), moved by pan 0..1 —
 *         the picture is cropped to fill the format.
 *   fit:  the whole frame is shown inside the format (the window is larger than the frame, centred); the bars are
 *         filled by the caller (a blurred copy of the picture).
 * The window works for both the camera video and the virtual layer: the 3D projection uses the same window, so the
 * virtual objects keep sitting on the real world whatever the crop.
 */
export function cropWindow(sourceAspect, outAspect, opts) {
  const o = Object.assign({mode: "fill", zoom: 1, panX: 0.5, panY: 0.5}, opts || {});
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const zoom = clamp(+o.zoom || 1, 1, 4);
  const pan = (v) => clamp(v == null ? 0.5 : +v, 0, 1);
  let w;
  let h;
  if (o.mode === "fit") {
    // contain: the frame fills one axis of the output
    if (outAspect >= sourceAspect) {
      h = 1;
      w = outAspect / sourceAspect;
    } else {
      w = 1;
      h = sourceAspect / outAspect;
    }
    return {u0: 0.5 - w / 2, v0: 0.5 - h / 2, u1: 0.5 + w / 2, v1: 0.5 + h / 2, fit: true};
  }
  if (outAspect <= sourceAspect) {
    h = 1 / zoom;
    w = (outAspect / sourceAspect) / zoom;
  } else {
    w = 1 / zoom;
    h = (sourceAspect / outAspect) / zoom;
  }
  const u0 = (1 - w) * pan(o.panX);
  const v0 = (1 - h) * pan(o.panY);
  return {u0, v0, u1: u0 + w, v1: v0 + h, fit: false};
}

/** Output size of a preset for a recording (the "match the Lens camera" preset needs the recording's aspect). */
export function outputSize(preset, recAspect) {
  const out = OUTPUTS[preset] || OUTPUTS.device;
  if (out.auto) {
    const aspect = recAspect || 16 / 9;
    return {width: Math.round((out.height * aspect) / 2) * 2, height: out.height, auto: true};
  }
  return {width: out.width, height: out.height, auto: false};
}

/**
 * Looks: one click sets how the virtual layer meets the camera (composite, opacity, solidity, camera tint) and the
 * grade (cold-warm, exposure, contrast, saturation, glow, vignette, object shadow, pop plate). Every preset starts from
 * PRESET_BASE, so applying one never leaves a setting of the previous preset behind. Hands, the shadow plane, crop,
 * logo and the camera alignment are not touched.
 */
export const PRESET_BASE = {
  device: {mode: "device", opacity: 1, tint: 0.6, solid: 0.35},
  fx: {
    warmth: -0.1, exposure: 1, contrast: 1, saturation: 1, glow: 0, vignette: 0,
    objectShadow: {on: false, angle: 90, distance: 40, softness: 12, strength: 0.3, contact: 0.15},
    pop: {opacity: 0, spread: 6, feather: 4}
  }
};

// Two families, both clean and slightly cool: "Glasses" (additive, see-through like the display) and "Solid UI"
// (additive light on plates that hide the room behind them). The variations are small steps, not effects.
const SOFT_SHADOW = {on: true, distance: 26, softness: 18, strength: 0.35, contact: 0.2};
export const PRESETS = {
  glasses: {label: "Glasses", hint: "Additive like the display, lightly solid, clean cool colour"},
  glassesLight: {label: "Glasses · Light", hint: "More see-through, brighter room", device: {solid: 0.2, tint: 0.7}},
  glassesCrisp: {
    label: "Glasses · Crisp", hint: "A touch more solid and contrast",
    device: {solid: 0.45, tint: 0.55}, fx: {warmth: -0.15, contrast: 1.08}
  },
  glassesDim: {label: "Glasses · Dim", hint: "Darker room so the objects stand out", device: {tint: 0.45}, fx: {warmth: -0.12}},
  glassesGlow: {
    label: "Glasses · Glow", hint: "A light bloom on the virtual light",
    device: {solid: 0.3, tint: 0.55}, fx: {warmth: -0.15, glow: 0.2}
  },
  solidui: {
    label: "Solid UI", hint: "Panels read as solid plates with a soft shadow",
    device: {solid: 0.85, tint: 0.55}, fx: {objectShadow: SOFT_SHADOW}
  },
  soliduiSoft: {
    label: "Solid UI · Soft", hint: "A little of the room still shows through",
    device: {solid: 0.7, tint: 0.6}, fx: {objectShadow: {...SOFT_SHADOW, strength: 0.25}}
  },
  soliduiCrisp: {
    label: "Solid UI · Crisp", hint: "Fully solid plates, tighter shadow, a touch of contrast",
    device: {solid: 0.95, tint: 0.5}, fx: {warmth: -0.15, contrast: 1.08, objectShadow: {...SOFT_SHADOW, softness: 12, strength: 0.4}}
  },
  soliduiBright: {
    label: "Solid UI · Bright", hint: "Solid plates in a bright room",
    device: {solid: 0.85, tint: 0.75}, fx: {exposure: 1.05, objectShadow: SOFT_SHADOW}
  },
  soliduiFlat: {label: "Solid UI · Flat", hint: "Solid plates, no shadow", device: {solid: 0.9, tint: 0.55}}
};

/** Applies a preset to a recording's edits (in place) and returns them. Unknown names leave the edits unchanged. */
export function applyPreset(edits, name) {
  const preset = PRESETS[name];
  if (!preset) return edits;
  const b = PRESET_BASE;
  const pd = preset.device || {};
  const pf = preset.fx || {};
  edits.device = Object.assign({}, edits.device || {}, b.device, pd);
  const fx = (edits.fx = edits.fx || defaultFx());
  for (const k of ["warmth", "exposure", "contrast", "saturation", "glow", "vignette"]) fx[k] = pf[k] != null ? pf[k] : b.fx[k];
  fx.objectShadow = Object.assign({}, b.fx.objectShadow, pf.objectShadow || {});
  fx.pop = Object.assign({}, b.fx.pop, pf.pop || {});
  edits.preset = name;
  return edits;
}

export function defaultEdits() {
  return {
    version: 1,
    trim: null, // [in, out] in source seconds, null = whole recording
    cuts: [], // [{start, end}] in source seconds
    speed: 1,
    objects: {}, // id -> {hidden, color, label, offset: [px,py,pz, rx,ry,rz (deg), s]}
    look: "studio",
    background: null, // overrides the look's background colour
    showLabels: false,
    camera: {mode: "recorded", shots: []}, // mode: recorded | orbit | shots; shots: [{t, pose:[px,py,pz,tx,ty,tz], fov}]
    titles: [], // [{text, start, end, position: 'top'|'center'|'bottom', size}]
    music: null, // {name, volume, offset} (the audio file itself stays in the browser)
    logo: {on: true, color: "white", place: "bottom-right", size: 0.18}, // the SPECS wordmark (see logo.js)
    videoProfile: null, // fine-tune of the camera video's projection: {zoom, panX, panY}; null = the NDK default
    device: {mode: "device", opacity: 1, tint: 0.6, solid: 0.35, hands: true}, // how the virtual layer meets the camera
    hands: null, // detected hand landmarks per video frame (see handseg.js)
    stab: null, // Lock to environment: {t, v, strength, on}
    videoShift: 0, // seconds: fine-tunes the camera video against the poses (positive = later)
    fx: defaultFx(),
    output: {preset: "device", fps: 30, fit: "fill", zoom: 1, panX: 0.5, panY: 0.5}
  };
}

/** Post-production: shadows (cast on a floor and between objects) and a grade on the final frame. */
export function defaultFx() {
  return {
    // Cast shadows on a plane you align by hand. plane null = horizontal at the lowest point, until you move it:
    // {p: [x, y, z] cm, q: [x, y, z, w], s: size in cm}
    shadows: {on: false, strength: 0.55, softness: 0.4, azimuth: 35, elevation: 55, plane: null},
    // A shadow around the virtual objects themselves (Capture Studio's look): angle 90 = straight down.
    objectShadow: {on: false, angle: 90, distance: 40, softness: 12, strength: 0.3, contact: 0.15},
    // A dark plate hugging the objects so they stand out on bright backgrounds.
    pop: {opacity: 0, spread: 6, feather: 4},
    // A directional light of your own on the 3D objects (off = the scene style's lighting). rotation: degrees around
    // the scene (0 = from the front), height: degrees above the horizon, softness: 0 hard .. 1 soft (more fill light).
    light: {on: false, intensity: 1.8, softness: 0.5, rotation: 30, height: 50, color: "#ffffff"},
    warmth: 0, // -1 (cold) .. 1 (warm): tints the camera picture only
    exposure: 1, // 0.5..1.8, multiplies brightness
    contrast: 1, // 0.6..1.6
    saturation: 1, // 0..2
    glow: 0, // 0..1, bright areas bleed
    vignette: 0 // 0..1
  };
}

/** The lowest point the recording reaches (scene cm), used as the shadow floor unless one is set. */
export function autoFloor(rec) {
  let low = Infinity;
  for (const o of rec.objects) {
    const tr = rec.tracks[o.id];
    if (!tr || !tr.t.length) continue;
    const minY = o.bounds ? o.bounds[1] : o.primitive === "plane" || o.primitive === "empty" ? 0 : -5;
    for (let i = 0; i < tr.t.length; i++) {
      const v = i * POSE;
      low = Math.min(low, tr.v[v + 1] + minY * (tr.v[v + 8] || 1));
    }
  }
  return Number.isFinite(low) ? low : 0;
}

/** Validates a recording loosely and fills defaults; throws with a readable message when unusable. */
export function normalizeRecording(rec) {
  if (!rec || typeof rec !== "object") throw new Error("Not a JSON object");
  if (rec.format !== RECORDING_FORMAT)
    throw new Error("Not a " + RECORDING_FORMAT + " recording (format: " + rec.format + ")");
  if (!rec.meta || !Array.isArray(rec.objects)) throw new Error("Recording has no meta or objects");
  rec.tracks = rec.tracks || {};
  rec.camera = rec.camera || {t: [], v: []};
  rec.params = rec.params || [];
  rec.markers = rec.markers || [];
  for (const id of Object.keys(rec.tracks)) {
    const tr = rec.tracks[id];
    if (!tr || tr.v.length !== tr.t.length * POSE) throw new Error("Track " + id + " has a bad length");
  }
  if (rec.camera.v.length !== rec.camera.t.length * CAMERA) throw new Error("Camera track has a bad length");
  const e = Object.assign(defaultEdits(), rec.edits || {});
  e.camera = Object.assign(defaultEdits().camera, e.camera || {});
  e.output = Object.assign(defaultEdits().output, e.output || {});
  e.logo = Object.assign(defaultEdits().logo, e.logo || {});
  if (rec.edits && rec.edits.logo == null && rec.edits.watermark === false) e.logo.on = false; // older recordings
  const fx = defaultFx();
  e.fx = Object.assign(fx, e.fx || {});
  const saved = (rec.edits && rec.edits.fx) || {};
  e.fx.shadows = Object.assign(fx.shadows, saved.shadows || {});
  e.fx.objectShadow = Object.assign(fx.objectShadow, saved.objectShadow || {});
  e.fx.pop = Object.assign(fx.pop, saved.pop || {});
  e.fx.light = Object.assign(defaultFx().light, saved.light || {});
  rec.edits = e;
  rec.meta.duration = Number(rec.meta.duration) || lastKeyTime(rec);
  return rec;
}

export function lastKeyTime(rec) {
  let t = 0;
  for (const id of Object.keys(rec.tracks || {})) {
    const tr = rec.tracks[id];
    if (tr.t.length) t = Math.max(t, tr.t[tr.t.length - 1]);
  }
  if (rec.camera && rec.camera.t.length) t = Math.max(t, rec.camera.t[rec.camera.t.length - 1]);
  return t;
}

/** Index of the last key at or before t (binary search); -1 when t is before the first key. */
export function keyIndex(times, t) {
  let lo = 0,
    hi = times.length - 1,
    ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

function slerp(a, b, u) {
  let [ax, ay, az, aw] = a;
  let [bx, by, bz, bw] = b;
  let dot = ax * bx + ay * by + az * bz + aw * bw;
  if (dot < 0) {
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
    dot = -dot;
  }
  if (dot > 0.9995) {
    const r = [ax + (bx - ax) * u, ay + (by - ay) * u, az + (bz - az) * u, aw + (bw - aw) * u];
    const n = Math.hypot(r[0], r[1], r[2], r[3]) || 1;
    return r.map((x) => x / n);
  }
  const th = Math.acos(dot),
    s = Math.sin(th);
  const wa = Math.sin((1 - u) * th) / s,
    wb = Math.sin(u * th) / s;
  return [ax * wa + bx * wb, ay * wa + by * wb, az * wa + bz * wb, aw * wa + bw * wb];
}

/**
 * Pose at time t from a flat track. Between keys: linear position/scale and slerped rotation.
 * A keyframe is only stored on change, so the value holds until the next key; we interpolate
 * between consecutive keys only when they are close (≤ maxGap s), otherwise hold.
 */
export function sampleTrack(times, values, stride, t, maxGap = 0.25) {
  if (!times.length) return null;
  const i = keyIndex(times, t);
  if (i < 0) return values.slice(0, stride);
  if (i >= times.length - 1) return values.slice((times.length - 1) * stride, times.length * stride);
  const a = values.slice(i * stride, (i + 1) * stride);
  const b = values.slice((i + 1) * stride, (i + 2) * stride);
  const gap = times[i + 1] - times[i];
  if (gap <= 0 || gap > maxGap) return a;
  const u = (t - times[i]) / gap;
  const out = new Array(stride);
  for (let k = 0; k < 3; k++) out[k] = a[k] + (b[k] - a[k]) * u;
  const q = slerp(a.slice(3, 7), b.slice(3, 7), u);
  for (let k = 0; k < 4; k++) out[3 + k] = q[k];
  for (let k = 7; k < stride; k++) out[k] = a[k] + (b[k] - a[k]) * u;
  return out;
}

/** Params (visible / color / text) in effect at time t for each object. */
export function paramsAt(rec, t) {
  const out = {};
  for (const key of rec.params) {
    if (key.t > t) break;
    out[key.id] = Object.assign(out[key.id] || {}, key.params);
  }
  return out;
}

/** Frame of the whole scene at source time t, with the per-object overrides applied. */
export function frameAt(rec, t) {
  const params = paramsAt(rec, t);
  const objects = [];
  for (const obj of rec.objects) {
    const tr = rec.tracks[obj.id];
    const pose = tr ? sampleTrack(tr.t, tr.v, POSE, t) : null;
    if (!pose) continue;
    const ov = (rec.edits && rec.edits.objects[obj.id]) || {};
    const p = params[obj.id] || {};
    objects.push({
      id: obj.id,
      desc: obj,
      pose: applyOffset(pose, ov.offset),
      visible: !ov.hidden && p.visible !== false,
      color: ov.color || p.color || obj.color,
      text: p.text != null ? p.text : obj.text,
      label: ov.label || obj.name
    });
  }
  const camera = rec.camera.t.length ? sampleTrack(rec.camera.t, rec.camera.v, CAMERA, t) : null;
  return {t, objects, camera};
}

/** Same as frameAt, for a live scene snapshot. */
export function frameFromSnapshot(snap, overrides) {
  const objects = [];
  for (const obj of snap.objects || []) {
    const pose = (snap.poses || {})[obj.id];
    if (!pose) continue;
    const p = (snap.params || {})[obj.id] || {};
    const ov = (overrides && overrides[obj.id]) || {};
    objects.push({
      id: obj.id,
      desc: obj,
      pose: applyOffset(pose, ov.offset),
      visible: !ov.hidden && p.visible !== false,
      color: ov.color || p.color || obj.color,
      text: p.text != null ? p.text : obj.text,
      label: ov.label || obj.name
    });
  }
  return {t: snap.time || 0, objects, camera: snap.camera || null};
}

// ---------- quaternion helpers for offsets (degrees XYZ)

export function eulerToQuat(x, y, z) {
  const r = Math.PI / 180;
  const cx = Math.cos((x * r) / 2),
    sx = Math.sin((x * r) / 2);
  const cy = Math.cos((y * r) / 2),
    sy = Math.sin((y * r) / 2);
  const cz = Math.cos((z * r) / 2),
    sz = Math.sin((z * r) / 2);
  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz
  ];
}

export function quatMul(a, b) {
  const [ax, ay, az, aw] = a,
    [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz
  ];
}

/** Offset = [px, py, pz, rxDeg, ryDeg, rzDeg, scale]; applied in the capture-origin frame. */
export function applyOffset(pose, offset) {
  if (!offset) return pose;
  const [px, py, pz, rx, ry, rz, s] = offset;
  const q = quatMul(eulerToQuat(rx || 0, ry || 0, rz || 0), pose.slice(3, 7));
  const k = s == null ? 1 : s;
  return [
    pose[0] + (px || 0),
    pose[1] + (py || 0),
    pose[2] + (pz || 0),
    q[0],
    q[1],
    q[2],
    q[3],
    pose[7] * k,
    pose[8] * k,
    pose[9] * k
  ];
}

// ---------- timeline: trim, cuts, speed (same semantics as Specs Capture Studio)

export function trimRange(rec) {
  const d = rec.meta.duration || 0;
  const tr = rec.edits.trim;
  if (!tr) return [0, d];
  const a = Math.max(0, Math.min(d, Math.min(tr[0], tr[1])));
  const b = Math.max(0, Math.min(d, Math.max(tr[0], tr[1])));
  return b - a < 0.05 ? [0, d] : [a, b];
}

/** Sorted, merged, clamped cuts (sections shorter than 10 ms are dropped). */
export function normalizeCuts(cuts, duration) {
  const list = (cuts || [])
    .map((c) => ({
      start: Math.max(0, Math.min(duration, Math.min(c.start, c.end))),
      end: Math.max(0, Math.min(duration, Math.max(c.start, c.end)))
    }))
    .filter((c) => c.end - c.start > 0.01)
    .sort((a, b) => a.start - b.start);
  const merged = [];
  for (const c of list) {
    const last = merged[merged.length - 1];
    if (last && c.start <= last.end) last.end = Math.max(last.end, c.end);
    else merged.push({start: c.start, end: c.end});
  }
  return merged;
}

export function removedIn(cuts, a, b) {
  return cuts.reduce((sum, c) => sum + Math.max(0, Math.min(c.end, b) - Math.max(c.start, a)), 0);
}

export function cutContaining(cuts, t) {
  return cuts.find((c) => t >= c.start && t < c.end) || null;
}

/** Length of the exported clip in seconds: trim minus cuts, divided by speed. */
export function clipLength(rec) {
  const [a, b] = trimRange(rec);
  const cuts = normalizeCuts(rec.edits.cuts, rec.meta.duration);
  return (b - a - removedIn(cuts, a, b)) / (rec.edits.speed || 1);
}

/** Source time for an export (clip) time: skips the trimmed head and every cut, applies speed. */
export function sourceTimeForClip(rec, clipT) {
  const [a, b] = trimRange(rec);
  const cuts = normalizeCuts(rec.edits.cuts, rec.meta.duration).filter((c) => c.end > a && c.start < b);
  let s = a + clipT * (rec.edits.speed || 1);
  for (const c of cuts) {
    const start = Math.max(c.start, a);
    if (s >= start) s += Math.min(c.end, b) - start;
    else break;
  }
  return Math.min(s, b);
}

/** Clip time for a source time (inverse of sourceTimeForClip; a time inside a cut maps to the cut). */
export function clipTimeForSource(rec, s) {
  const [a, b] = trimRange(rec);
  const cuts = normalizeCuts(rec.edits.cuts, rec.meta.duration);
  const t = Math.max(a, Math.min(b, s));
  return (t - a - removedIn(cuts, a, t)) / (rec.edits.speed || 1);
}

/** Preview playback step: advances source time by dt × speed and jumps over cuts; loops in the trim. */
export function advance(rec, s, dt) {
  const [a, b] = trimRange(rec);
  const cuts = normalizeCuts(rec.edits.cuts, rec.meta.duration);
  let n = s + dt * (rec.edits.speed || 1);
  for (let guard = 0; guard < cuts.length + 1; guard++) {
    const c = cutContaining(cuts, n);
    if (!c) break;
    n = c.end;
  }
  if (n >= b) return {t: a, looped: true};
  if (n < a) n = a;
  return {t: n, looped: false};
}

// ---------- camera shots (keyframed virtual camera)

/** Shot camera at time t: linear interpolation between shot keys (pose: eye xyz + target xyz). */
export function shotAt(shots, t) {
  if (!shots || !shots.length) return null;
  const sorted = shots.slice().sort((x, y) => x.t - y.t);
  if (t <= sorted[0].t) return sorted[0];
  const last = sorted[sorted.length - 1];
  if (t >= last.t) return last;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i],
      b = sorted[i + 1];
    if (t >= a.t && t <= b.t) {
      const u = (t - a.t) / Math.max(1e-6, b.t - a.t);
      const e = u * u * (3 - 2 * u); // ease in/out
      return {t, pose: a.pose.map((v, k) => v + (b.pose[k] - v) * e), fov: a.fov + (b.fov - a.fov) * e};
    }
  }
  return last;
}

/** Titles visible at clip time t. */
export function titlesAt(rec, clipT) {
  return (rec.edits.titles || []).filter((x) => clipT >= x.start && clipT <= x.end);
}

/** Scene bounds (cm) over the whole recording: [minx,miny,minz,maxx,maxy,maxz]. */
export function sceneBounds(rec) {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const id of Object.keys(rec.tracks)) {
    const tr = rec.tracks[id];
    for (let i = 0; i < tr.t.length; i++) {
      for (let k = 0; k < 3; k++) {
        const v = tr.v[i * POSE + k];
        b[k] = Math.min(b[k], v);
        b[k + 3] = Math.max(b[k + 3], v);
      }
    }
  }
  if (!isFinite(b[0])) return [-50, -50, -50, 50, 50, 50];
  return b;
}

/** Recording summary for the library. */
export function summarize(rec) {
  let keys = 0;
  for (const id of Object.keys(rec.tracks)) keys += rec.tracks[id].t.length;
  return {
    name: rec.meta.name,
    id: rec.meta.id,
    duration: rec.meta.duration,
    objects: rec.objects.length,
    keyframes: keys,
    cameraKeys: rec.camera.t.length,
    markers: rec.markers.length
  };
}

/** JSON for saving: escapes non-ASCII so byte length == string length (the plugin's HTTP server relies on it). */
export function toJson(rec) {
  return JSON.stringify(rec).replace(/[\u007f-￿]/g, (c) => "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4));
}

export function formatTime(s) {
  if (!isFinite(s)) return "0:00.0";
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return m + ":" + (r < 10 ? "0" : "") + r.toFixed(1);
}
