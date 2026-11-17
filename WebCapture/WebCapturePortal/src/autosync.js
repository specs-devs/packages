// SPECS Inc. 2027
// Auto-sync: finds how far the camera video is off the recorded head poses. How much the image moves from frame to
// frame (while you turn your head) must follow how fast the recorded pose turns; the shift that makes the two curves
// line up best is the video's offset. Measured on a Specs it recovers the offset to ~0.05 s with a correlation of ~0.8.

const W = 64;
const H = 48;

/** Mean absolute frame-to-frame difference of a decoded track, one value per frame, with each frame's time. */
async function motionSeries(track, onProgress) {
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext("2d", {willReadFrequently: true});
  const times = [];
  const energy = [];
  let prev = null;
  let produced = 0;
  const total = track.packets.length;
  const dec = new VideoDecoder({
    output: (frame) => {
      ctx.drawImage(frame, 0, 0, W, H);
      const px = ctx.getImageData(0, 0, W, H).data;
      const g = new Float32Array(W * H);
      for (let i = 0; i < g.length; i++) g[i] = px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11;
      if (prev) {
        let s = 0;
        for (let i = 0; i < g.length; i++) s += Math.abs(g[i] - prev[i]);
        times.push(track.timeOfIndex(frame.timestamp));
        energy.push(s / g.length);
      }
      prev = g;
      frame.close();
      produced++;
      if (onProgress && produced % 15 === 0) onProgress(produced / total);
    },
    error: () => {}
  });
  dec.configure(track.config);
  // Start at the first keyframe; feed in order with a little back-pressure so memory stays small.
  let start = 0;
  while (start < track.packets.length && !track.packets[start].key) start++;
  for (let i = start; i < track.packets.length; i++) {
    const p = track.packets[i];
    dec.decode(new EncodedVideoChunk({type: p.key ? "key" : "delta", timestamp: i, data: p.data}));
    if (dec.decodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5));
  }
  await dec.flush();
  dec.close();
  return {times, energy};
}

/** Head-pose angular speed (rad/s) over time from the recorded camera track. */
function poseSpeed(rec) {
  const t = rec.camera.t;
  const v = rec.camera.v;
  const times = [];
  const speed = [];
  for (let i = 1; i < t.length; i++) {
    const a = i * 8 + 3;
    const b = (i - 1) * 8 + 3;
    const dot = Math.abs(v[a] * v[b] + v[a + 1] * v[b + 1] + v[a + 2] * v[b + 2] + v[a + 3] * v[b + 3]);
    const angle = 2 * Math.acos(Math.min(1, dot));
    times.push((t[i] + t[i - 1]) / 2);
    speed.push(angle / Math.max(1e-3, t[i] - t[i - 1]));
  }
  return {times, speed};
}

function lerp(xs, ys, x) {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  return ys[lo] + ((ys[hi] - ys[lo]) * (x - xs[lo])) / (xs[hi] - xs[lo]);
}

/**
 * Returns {shift (seconds, positive = later), score (-1..1)} for the video track against the recording's poses.
 * The track must be measured with its shift at 0 (`track.timesNoShift`).
 */
export async function autoSync(rec, track, onProgress) {
  const m = await motionSeries(track, onProgress);
  const p = poseSpeed(rec);
  if (m.times.length < 30 || p.times.length < 30) return {shift: 0, score: 0, reason: "too short"};
  const duration = rec.meta.duration;
  const step = 1 / 60;
  const best = {score: -2, shift: 0};
  for (let shift = -0.8; shift <= 0.8; shift += 0.005) {
    const a = [];
    const b = [];
    for (let t = 0.3; t < duration - 0.3; t += step) {
      const tv = t - shift; // video time that lands on pose time t after applying `shift`
      if (tv < m.times[0] || tv > m.times[m.times.length - 1]) continue;
      a.push(lerp(m.times, m.energy, tv));
      b.push(lerp(p.times, p.speed, t));
    }
    if (a.length < 60) continue;
    const ma = a.reduce((x, y) => x + y, 0) / a.length;
    const mb = b.reduce((x, y) => x + y, 0) / b.length;
    let sa = 0;
    let sb = 0;
    let sab = 0;
    for (let i = 0; i < a.length; i++) {
      sa += (a[i] - ma) ** 2;
      sb += (b[i] - mb) ** 2;
      sab += (a[i] - ma) * (b[i] - mb);
    }
    const score = sab / Math.sqrt(sa * sb + 1e-12);
    if (score > best.score) {
      best.score = score;
      best.shift = shift;
    }
  }
  return {shift: best.shift, score: best.score};
}
