// SPECS Inc. 2027
// Lock to environment: a post pass that makes the virtual objects stick to the real world in the camera video.
//
// The virtual camera comes from the glasses' head pose; the picture comes from a separate camera stream. Any jitter
// or latency between the two shows up as objects floating or dragging. This pass measures how the camera really
// rotated between every pair of video frames (direct image alignment with a pure-rotation motion model and the
// device's calibrated focal length, robust to moving hands and objects), then
//   1. finds the exact time offset between video and poses (rotation-rate correlation, ~1 ms),
//   2. integrates the video rotation, compares it with the head pose, and keeps the fast part of the difference
//      (the slow part is the video integration's own drift) as a small per-frame correction of the camera.
// The correction rotates the virtual camera by up to a degree or two so objects follow the picture. It models
// rotation only: sideways head motion against nearby objects (parallax) is still taken from the pose.

import {videoIntrinsics, VIDEO_PROFILE} from "./video.js";

const W = 160;
const H = 120;
const LEVELS = 3;

// ---------- small quaternion / rotation-vector helpers ([x, y, z, w])
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
];
const qinv = (q) => [-q[0], -q[1], -q[2], q[3]];
export function quatFromRotVec(r) {
  const a = Math.hypot(r[0], r[1], r[2]);
  if (a < 1e-9) return [r[0] / 2, r[1] / 2, r[2] / 2, 1];
  const s = Math.sin(a / 2) / a;
  return [r[0] * s, r[1] * s, r[2] * s, Math.cos(a / 2)];
}
function rotVecFromQuat(q) {
  let [x, y, z, w] = q;
  if (w < 0) {
    x = -x;
    y = -y;
    z = -z;
    w = -w;
  }
  const s = Math.hypot(x, y, z);
  if (s < 1e-9) return [2 * x, 2 * y, 2 * z];
  const a = 2 * Math.atan2(s, w);
  return [(x / s) * a, (y / s) * a, (z / s) * a];
}
function qnorm(q) {
  const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

/** Camera position (cm, recording space) at time t: the device position plus the camera's offset turned by the pose. */
function positionSampler(rec) {
  const ct = rec.camera.t;
  const cv = rec.camera.v;
  const off = rec.meta.camera && rec.meta.camera.p ? rec.meta.camera.p : [0, 0, 0];
  return (t) => {
    let lo = 0;
    let hi = ct.length - 1;
    if (t <= ct[0]) hi = lo = 0;
    else if (t >= ct[hi]) lo = hi;
    else {
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (ct[mid] <= t) lo = mid;
        else hi = mid;
      }
    }
    const f = hi === lo ? 0 : (t - ct[lo]) / Math.max(1e-6, ct[hi] - ct[lo]);
    const a = lo * 8;
    const b = hi * 8;
    const pos = [0, 1, 2].map((k) => cv[a + k] + (cv[b + k] - cv[a + k]) * f);
    const q = [cv[a + 3], cv[a + 4], cv[a + 5], cv[a + 6]];
    const o = rotate(q, off);
    return [pos[0] + o[0], pos[1] + o[1], pos[2] + o[2]];
  };
}

/** Camera orientation (device pose x calibration) at recording time t. */
function poseSampler(rec, calibOverride) {
  const ct = rec.camera.t;
  const cv = rec.camera.v;
  const k = calibOverride || (rec.meta.camera && rec.meta.camera.q ? rec.meta.camera.q : [0, 0, 0, 1]);
  const calib = [k[0], k[1], k[2], k[3]];
  return (t) => {
    let lo = 0;
    let hi = ct.length - 1;
    if (t <= ct[0]) hi = lo = 0;
    else if (t >= ct[hi]) lo = hi;
    else {
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (ct[mid] <= t) lo = mid;
        else hi = mid;
      }
    }
    const a = lo * 8 + 3;
    const qa = [cv[a], cv[a + 1], cv[a + 2], cv[a + 3]];
    let q = qa;
    if (hi !== lo) {
      const b = hi * 8 + 3;
      let qb = [cv[b], cv[b + 1], cv[b + 2], cv[b + 3]];
      const f = (t - ct[lo]) / Math.max(1e-6, ct[hi] - ct[lo]);
      if (qa[0] * qb[0] + qa[1] * qb[1] + qa[2] * qb[2] + qa[3] * qb[3] < 0) qb = qb.map((v) => -v);
      q = qnorm([qa[0] + (qb[0] - qa[0]) * f, qa[1] + (qb[1] - qa[1]) * f, qa[2] + (qb[2] - qa[2]) * f, qa[3] + (qb[3] - qa[3]) * f]);
    }
    return qmul(q, calib);
  };
}

// ---------- image pyramid and the rotation estimator
function makePyramid(g0) {
  const levels = [{w: W, h: H, g: g0}];
  for (let l = 1; l < LEVELS; l++) {
    const p = levels[l - 1];
    const w = p.w >> 1;
    const h = p.h >> 1;
    const g = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * 2 * p.w + x * 2;
        g[y * w + x] = (p.g[i] + p.g[i + 1] + p.g[i + p.w] + p.g[i + p.w + 1]) / 4;
      }
    }
    levels.push({w, h, g});
  }
  return levels;
}

function sample(img, x, y) {
  const {w, h, g} = img;
  if (x < 1 || y < 1 || x > w - 2 || y > h - 2) return NaN;
  const x0 = x | 0;
  const y0 = y | 0;
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * w + x0;
  return (g[i] * (1 - fx) + g[i + 1] * fx) * (1 - fy) + (g[i + w] * (1 - fx) + g[i + w + 1] * fx) * fy;
}

const GRID = 3; // depth cells per side

/**
 * Camera motion between two frames by direct image alignment. Unknowns: the rotation (camera-frame angular vector,
 * radians) and, when the head's translation `t` (camera frame, cm) is known from the pose, a coarse inverse-depth map
 * (GRIDxGRID cells, 1/cm): translation moves near things more than far ones, and without this the tracker mistakes
 * that parallax for extra rotation. `t` null = rotation only.
 */
function estimateRotation(a, b, K, t) {
  const omega = [0, 0, 0];
  const nCells = GRID * GRID;
  const rhos = new Float64Array(nCells); // inverse depth per cell
  const nParam = t ? 3 + nCells : 3;
  let weightSum = 0;
  let inlier = 0;
  const idx = new Int32Array(7);
  const jr = new Float64Array(7);
  for (let l = LEVELS - 1; l >= 0; l--) {
    const s = 1 / (1 << l);
    const f = K.f * s;
    const cx = K.cx * s;
    const cy = K.cy * s;
    const A = a[l];
    const B = b[l];
    const iters = l === LEVELS - 1 ? 6 : 4;
    for (let it = 0; it < iters; it++) {
      const N = new Float64Array(nParam * nParam);
      const v = new Float64Array(nParam);
      let used = 0;
      let wsum = 0;
      let good = 0;
      for (let y = 3; y < A.h - 3; y++) {
        for (let x = 3; x < A.w - 3; x++) {
          const nx = (x - cx) / f;
          const ny = (cy - y) / f;
          let du = f * (omega[1] * (1 + nx * nx) + omega[2] * ny - omega[0] * nx * ny);
          let dv = f * (omega[0] * (1 + ny * ny) + omega[2] * nx - omega[1] * nx * ny);
          let ru = 0;
          let rv = 0;
          let c00 = 0;
          let c10 = 0;
          let c01 = 0;
          let c11 = 0;
          let w00 = 0;
          let w10 = 0;
          let w01 = 0;
          let w11 = 0;
          if (t) {
            // bilinear weights over the depth cells (centres at (c + 0.5) / GRID of the image)
            const gx = Math.min(GRID - 1, Math.max(0, (x / A.w) * GRID - 0.5));
            const gy = Math.min(GRID - 1, Math.max(0, (y / A.h) * GRID - 0.5));
            const gx0 = Math.min(GRID - 2, gx | 0);
            const gy0 = Math.min(GRID - 2, gy | 0);
            const fx = gx - gx0;
            const fy = gy - gy0;
            c00 = gy0 * GRID + gx0;
            c10 = c00 + 1;
            c01 = c00 + GRID;
            c11 = c01 + 1;
            w00 = (1 - fx) * (1 - fy);
            w10 = fx * (1 - fy);
            w01 = (1 - fx) * fy;
            w11 = fx * fy;
            const rho = w00 * rhos[c00] + w10 * rhos[c10] + w01 * rhos[c01] + w11 * rhos[c11];
            ru = f * (t[0] + nx * t[2]);
            rv = -f * (t[1] + ny * t[2]);
            du += rho * ru;
            dv += rho * rv;
          }
          const px = x + du;
          const py = y + dv;
          const i1 = sample(B, px, py);
          if (i1 !== i1) continue;
          const r = i1 - A.g[y * A.w + x];
          const ix = (sample(B, px + 1, py) - sample(B, px - 1, py)) * 0.5;
          const iy = (sample(B, px, py + 1) - sample(B, px, py - 1)) * 0.5;
          if (ix !== ix || iy !== iy) continue;
          const wgt = 1 / (1 + (r / 14) * (r / 14));
          idx[0] = 0;
          idx[1] = 1;
          idx[2] = 2;
          jr[0] = ix * (-f * nx * ny) + iy * (f * (1 + ny * ny));
          jr[1] = ix * (f * (1 + nx * nx)) + iy * (-f * nx * ny);
          jr[2] = ix * (f * ny) + iy * (f * nx);
          let nj = 3;
          if (t) {
            const g = ix * ru + iy * rv;
            idx[3] = 3 + c00;
            jr[3] = w00 * g;
            idx[4] = 3 + c10;
            jr[4] = w10 * g;
            idx[5] = 3 + c01;
            jr[5] = w01 * g;
            idx[6] = 3 + c11;
            jr[6] = w11 * g;
            nj = 7;
          }
          for (let p = 0; p < nj; p++) {
            const ip = idx[p];
            v[ip] += wgt * jr[p] * r;
            for (let q = 0; q < nj; q++) N[ip * nParam + idx[q]] += wgt * jr[p] * jr[q];
          }
          used++;
          wsum += wgt;
          if (wgt > 0.5) good++;
        }
      }
      if (used < 200) break;
      const d = solveN(N, v, nParam, 2e-3);
      if (!d) break;
      omega[0] -= d[0];
      omega[1] -= d[1];
      omega[2] -= d[2];
      if (t) for (let c = 0; c < nCells; c++) rhos[c] = Math.min(1 / 12, Math.max(0, rhos[c] - d[3 + c]));
      weightSum = wsum / used;
      inlier = good / used;
      if (Math.hypot(d[0], d[1], d[2]) < 2e-6) break;
    }
  }
  const rhoMed = t ? Array.from(rhos).sort((x, y) => x - y)[nCells >> 1] : 0;
  return {omega, rho: rhoMed, confidence: Math.min(1, weightSum) * inlier};
}

/** Solves (N + lam*mean-diag) d = v for an n x n matrix (row-major, stride n); null if singular. */
function solveN(N, v, n, lamScale) {
  let tr = 0;
  for (let p = 0; p < n; p++) tr += N[p * n + p];
  const a = [];
  for (let p = 0; p < n; p++) {
    const row = new Float64Array(n + 1);
    for (let q = 0; q < n; q++) row[q] = N[p * n + q];
    row[p] += (lamScale * tr) / n + 1e-9 + (p >= 3 ? (lamScale * tr) / n : 0);
    row[n] = v[p];
    a.push(row);
  }
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (Math.abs(a[p][c]) < 1e-12) return null;
    const tmp = a[c];
    a[c] = a[p];
    a[p] = tmp;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const m = a[r][c] / a[c][c];
      if (m === 0) continue;
      for (let k = c; k <= n; k++) a[r][k] -= m * a[c][k];
    }
  }
  return a.map((row, c) => row[n] / row[c]);
}

function solve3(N, v, lam) {
  const a = [
    [N[0] + lam, N[1], N[2], v[0]],
    [N[3], N[4] + lam, N[5], v[1]],
    [N[6], N[7], N[8] + lam, v[2]]
  ];
  for (let c = 0; c < 3; c++) {
    let p = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (Math.abs(a[p][c]) < 1e-12) return null;
    [a[c], a[p]] = [a[p], a[c]];
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const m = a[r][c] / a[c][c];
      for (let k = c; k < 4; k++) a[r][k] -= m * a[c][k];
    }
  }
  return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
}

/** Decodes the whole camera track once into 160x120 image pyramids (kept for every tracking pass). */
async function decodeFrames(track, onProgress) {
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext("2d", {willReadFrequently: true});
  ctx.imageSmoothingQuality = "high";
  const frames = new Map();
  let produced = 0;
  const total = track.packets.length;
  const dec = new VideoDecoder({
    output: (frame) => {
      ctx.drawImage(frame, 0, 0, W, H);
      const px = ctx.getImageData(0, 0, W, H).data;
      const g = new Float32Array(W * H);
      for (let i = 0; i < g.length; i++) g[i] = px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11;
      frames.set(frame.timestamp, makePyramid(g));
      frame.close();
      produced++;
      if (onProgress && produced % 10 === 0) onProgress(0.4 * (produced / total));
    },
    error: () => {}
  });
  dec.configure(track.config);
  let start = 0;
  while (start < track.packets.length && !track.packets[start].key) start++;
  for (let i = start; i < track.packets.length; i++) {
    const p = track.packets[i];
    dec.decode(new EncodedVideoChunk({type: p.key ? "key" : "delta", timestamp: i, data: p.data}));
    if (dec.decodeQueueSize > 6) await new Promise((r) => setTimeout(r, 4));
  }
  await dec.flush();
  dec.close();
  return frames;
}

/** Camera motion for every consecutive frame pair. `tFn(i0, i1)` gives the head translation (camera frame, cm) or null. */
async function trackPairs(frames, K, tFn, onProgress, base) {
  const indices = [...frames.keys()].sort((x, y) => x - y);
  const pairs = [];
  for (let k = 1; k < indices.length; k++) {
    const i0 = indices[k - 1];
    const i1 = indices[k];
    if (i1 !== i0 + 1) continue;
    const r = estimateRotation(frames.get(i0), frames.get(i1), K, tFn ? tFn(i0, i1) : null);
    pairs.push({i0, i1, omega: r.omega, rho: r.rho, confidence: r.confidence});
    if (k % 12 === 0) {
      if (onProgress) onProgress(base + 0.3 * (k / indices.length));
      await new Promise((res) => setTimeout(res, 0));
    }
  }
  return pairs;
}

/** Eigenvector of the largest eigenvalue of a symmetric 4x4 matrix (Jacobi rotations). */
function topEigenvector4(N) {
  const a = N.map((r) => r.slice());
  const v = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) off += a[i][j] * a[i][j];
    if (off < 1e-24) break;
    for (let p = 0; p < 3; p++) {
      for (let q = p + 1; q < 4; q++) {
        if (Math.abs(a[p][q]) < 1e-30) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const sn = t * c;
        for (let k = 0; k < 4; k++) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - sn * akq;
          a[k][q] = sn * akp + c * akq;
        }
        for (let k = 0; k < 4; k++) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - sn * aqk;
          a[q][k] = sn * apk + c * aqk;
        }
        for (let k = 0; k < 4; k++) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - sn * vkq;
          v[k][q] = sn * vkp + c * vkq;
        }
      }
    }
  }
  let best = 0;
  for (let i = 1; i < 4; i++) if (a[i][i] > a[best][best]) best = i;
  return [v[0][best], v[1][best], v[2][best], v[3][best]];
}

const rotate = (q, v) => {
  const p = qmul(qmul(q, [v[0], v[1], v[2], 0]), qinv(q));
  return [p[0], p[1], p[2]];
};

/**
 * Hand-eye fit: the constant rotation between the device frame and the camera, and the zoom, that best explain how
 * the picture turned (video rates) against how the head turned (pose rates). Returns {q: camera-to-device
 * quaternion [x,y,z,w], zoom: video angle / pose angle (= the video's focal length over the calibrated one)}.
 */
function fitExtrinsics(pairs, times, devPose, shift) {
  const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const dev = [];
  for (const p of pairs) {
    const a = rotVecFromQuat(qmul(qinv(devPose(times[p.i0] + shift)), devPose(times[p.i1] + shift)));
    dev.push(a);
    const w = p.confidence;
    for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) S[j][k] += w * a[j] * p.omega[k];
  }
  const [Sxx, Sxy, Sxz] = S[0];
  const [Syx, Syy, Syz] = S[1];
  const [Szx, Szy, Szz] = S[2];
  const N = [
    [Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx],
    [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
    [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy],
    [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz]
  ];
  const e = topEigenvector4(N); // (w, x, y, z): rotates device rates onto video rates
  const q = qnorm([e[1], e[2], e[3], e[0]]);
  let num = 0;
  let den = 1e-12;
  pairs.forEach((p, i) => {
    const r = rotate(q, dev[i]);
    num += p.confidence * (r[0] * p.omega[0] + r[1] * p.omega[1] + r[2] * p.omega[2]);
    den += p.confidence * (dev[i][0] ** 2 + dev[i][1] ** 2 + dev[i][2] ** 2);
  });
  return {q: qinv(q), zoom: num / den, devRates: dev};
}

function calibrationFor(rec, profile) {
  const c = rec.meta && rec.meta.camera;
  if (c && c.focal && c.principal && c.resolution) {
    const vi = videoIntrinsics(c, profile === undefined ? VIDEO_PROFILE : profile);
    const sx = W / c.resolution[0];
    const sy = H / c.resolution[1];
    return {f: vi.focal[1] * sy, fx: vi.focal[0] * sx, cx: vi.cx * W, cy: vi.cy * H};
  }
  // No calibration recorded: assume the camera's recorded vertical field of view
  const fov = ((rec.camera.v[7] || 60) * Math.PI) / 180;
  return {f: H / 2 / Math.tan(fov / 2), cx: W / 2, cy: H / 2};
}

/** Correlation of the video's rotation rate with the head pose's, for a video-to-pose time shift (seconds). */
function lagScore(pairs, times, pose, shift) {
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let k = 0; k < pairs.length; k++) {
    const p = pairs[k];
    const q0 = pose(times[p.i0] + shift);
    const q1 = pose(times[p.i1] + shift);
    const wp = rotVecFromQuat(qmul(qinv(q0), q1));
    const wv = p.omega;
    sab += wv[0] * wp[0] + wv[1] * wp[1] + wv[2] * wp[2];
    saa += wv[0] * wv[0] + wv[1] * wv[1] + wv[2] * wv[2];
    sbb += wp[0] * wp[0] + wp[1] * wp[1] + wp[2] * wp[2];
  }
  return sab / Math.sqrt(saa * sbb + 1e-18);
}

function movingAverage(series, radius) {
  // series: array of [x, y, z]; centred window that shrinks at the edges
  const n = series.length;
  const out = new Array(n);
  const px = new Float64Array(n + 1);
  const py = new Float64Array(n + 1);
  const pz = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    px[i + 1] = px[i] + series[i][0];
    py[i + 1] = py[i] + series[i][1];
    pz[i + 1] = pz[i] + series[i][2];
  }
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - radius);
    const b = Math.min(n, i + radius + 1);
    const c = b - a;
    out[i] = [(px[b] - px[a]) / c, (py[b] - py[a]) / c, (pz[b] - pz[a]) / c];
  }
  return out;
}

/**
 * Returns {shift, score, stab: {t (video clock, s), v (rotation vectors, rad), window}, stats} or {reason}.
 * `track` is the editor's VideoTrack; its current shift is ignored (the exact shift is measured here).
 */
export async function matchMove(rec, track, onProgress, profile) {
  if (!rec.camera || rec.camera.t.length < 30) return {reason: "This recording has no camera track."};
  const K = calibrationFor(rec, profile);
  const frames = await decodeFrames(track, onProgress);
  let pairs = (await trackPairs(frames, K, null, onProgress, 0.4)).filter((p) => p.confidence > 0.15);
  if (pairs.length < 30) return {reason: "Could not follow the picture (too dark, blurred or too short)."};
  const pose = poseSampler(rec);
  const camPos = positionSampler(rec);
  const times = track.packets.map((p, i) => track.timeOfIndex(i));
  // 1. time offset between video and poses
  let best = {score: -2, shift: 0};
  for (let s = -0.6; s <= 0.6; s += 0.008) {
    const score = lagScore(pairs, times, pose, s);
    if (score > best.score) best = {score, shift: s};
  }
  const centre = best.shift;
  for (let s = centre - 0.008; s <= centre + 0.008; s += 0.001) {
    const score = lagScore(pairs, times, pose, s);
    if (score > best.score) best = {score, shift: s};
  }
  if (best.score < 0.3) {
    return {
      reason:
        "Not enough head movement to lock (match " + best.score.toFixed(2) + "). Turn your head slowly while recording.",
      score: best.score
    };
  }
  let shift = best.shift;
  // Parallax pass: the head turns about the neck, so the camera also moves. Use the pose's translation to model how
  // much of the picture's motion is that, and re-measure the rotation without it.
  const tFn = (i0, i1) => {
    const c0 = pose(times[i0] + shift);
    const d = camPos(times[i1] + shift).map((x, k) => x - camPos(times[i0] + shift)[k]);
    return rotate(qinv(c0), d);
  };
  const withT = (await trackPairs(frames, K, tFn, onProgress, 0.7)).filter((p) => p.confidence > 0.15);
  if (withT.length >= 30) {
    pairs = withT;
    let b3 = {score: -2, shift};
    for (let s2 = shift - 0.04; s2 <= shift + 0.04; s2 += 0.002) {
      const sc = lagScore(pairs, times, pose, s2);
      if (sc > b3.score) b3 = {score: sc, shift: s2};
    }
    shift = b3.shift;
    best = {score: b3.score, shift};
  }
  const depths = pairs.filter((p) => p.rho > 1e-4).map((p) => 1 / p.rho).sort((x, y) => x - y);
  const sceneDepthCm = depths.length ? Math.round(depths[depths.length >> 1]) : 0;
  // Hand-eye: refine the camera-to-device rotation and the zoom from the data, then re-find the time offset with them
  const devPose = poseSampler(rec, [0, 0, 0, 1]);
  const recordedQ = rec.meta.camera && rec.meta.camera.q ? rec.meta.camera.q : [0, 0, 0, 1];
  let fit = fitExtrinsics(pairs, times, devPose, shift);
  let poseFit = poseSampler(rec, fit.q);
  for (let it = 0; it < 2; it++) {
    let b2 = {score: -2, shift};
    for (let s2 = shift - 0.03; s2 <= shift + 0.03; s2 += 0.002) {
      const sc = lagScore(pairs, times, poseFit, s2);
      if (sc > b2.score) b2 = {score: sc, shift: s2};
    }
    shift = b2.shift;
    best = {score: b2.score, shift};
    fit = fitExtrinsics(pairs, times, devPose, shift);
    poseFit = poseSampler(rec, fit.q);
  }
  const dq = qmul(qinv(qnorm(recordedQ)), fit.q);
  const calibNote = {angleDeg: +(Math.hypot(...rotVecFromQuat(dq)) * 57.296).toFixed(1), zoom: +fit.zoom.toFixed(3), q: fit.q.map((x) => +x.toFixed(5))};
  // Calibration check: how far the head turned (pose) against how far the picture turned (video), per axis.
  // About 1.0 when the video's intrinsics are right; a different value means the projection is off by that factor.
  const sp = [1e-12, 1e-12, 1e-12];
  const sv = [1e-12, 1e-12, 1e-12];
  for (const p of pairs) {
    const wp = rotVecFromQuat(qmul(qinv(pose(times[p.i0] + shift)), pose(times[p.i1] + shift)));
    for (let a = 0; a < 3; a++) {
      sp[a] += wp[a] * wp[a];
      sv[a] += p.omega[a] * p.omega[a];
    }
  }
  const ratio = sp.map((x, a) => +Math.sqrt(x / sv[a]).toFixed(3));
  // 2. Where the tracker is unsure (blur, a hand filling the view, a blank wall) use the head pose's own rotation for
  // that frame pair, so a bad stretch can't drag the camera away.
  const confident = pairs.filter((p) => p.confidence > 0.35).length / pairs.length;
  for (const p of pairs) {
    if (p.confidence > 0.35) continue;
    p.omega = rotVecFromQuat(qmul(qinv(pose(times[p.i0] + shift)), pose(times[p.i1] + shift)));
  }
  // 3. Integrate the video rotation from the pose at the start. The tracker and the viewer share one calibration, so
  // what the picture does is what the virtual camera does (the video may turn further than the pose says: that is
  // exactly the drag this removes). The pose only limits slow drift: differences slower than ~6 s are dropped.
  const t0 = times[pairs[0].i0] + shift;
  let cv = pose(t0);
  const stamps = [times[pairs[0].i0]];
  const errors = [[0, 0, 0]];
  for (const p of pairs) {
    cv = qnorm(qmul(cv, quatFromRotVec(p.omega)));
    const tNext = times[p.i1];
    const cp = pose(tNext + shift);
    stamps.push(tNext);
    errors.push(rotVecFromQuat(qmul(qinv(cp), cv)));
  }
  const fps = pairs.length / Math.max(1, stamps[stamps.length - 1] - stamps[0]);
  const slow = movingAverage(errors, Math.max(5, Math.round(fps * 3)));
  const fastRaw = errors.map((e, i) => [e[0] - slow[i][0], e[1] - slow[i][1], e[2] - slow[i][2]]);
  // 3-tap smoothing: the per-frame tracker has a little noise that would show as jitter
  const fast = fastRaw.map((e, i) => {
    const a = fastRaw[Math.max(0, i - 1)];
    const c = fastRaw[Math.min(fastRaw.length - 1, i + 1)];
    return [0.25 * a[0] + 0.5 * e[0] + 0.25 * c[0], 0.25 * a[1] + 0.5 * e[1] + 0.25 * c[1], 0.25 * a[2] + 0.5 * e[2] + 0.25 * c[2]];
  });
  let sumSq = 0;
  let maxMag = 0;
  const v = [];
  for (const e of fast) {
    v.push(+e[0].toFixed(6), +e[1].toFixed(6), +e[2].toFixed(6));
    const m = Math.hypot(e[0], e[1], e[2]);
    sumSq += m * m;
    maxMag = Math.max(maxMag, m);
  }
  const deg = 180 / Math.PI;
  return {
    shift,
    score: best.score,
    stab: {t: stamps.map((x) => +x.toFixed(4)), v, strength: 1},
    stats: {sceneDepthCm, calib: calibNote, ratio, rmsDeg: Math.sqrt(sumSq / fast.length) * deg, maxDeg: maxMag * deg, frames: pairs.length, confident}
  };
}

/** Correction (rotation vector, radians) at video-clock time t from a stab block; zero outside. */
export function stabAt(stab, t) {
  const ts = stab.t;
  if (!ts.length || t < ts[0] || t > ts[ts.length - 1]) return [0, 0, 0];
  let lo = 0;
  let hi = ts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] <= t) lo = mid;
    else hi = mid;
  }
  const f = (t - ts[lo]) / Math.max(1e-6, ts[hi] - ts[lo]);
  const a = lo * 3;
  const b = hi * 3;
  return [
    stab.v[a] + (stab.v[b] - stab.v[a]) * f,
    stab.v[a + 1] + (stab.v[b + 1] - stab.v[a + 1]) * f,
    stab.v[a + 2] + (stab.v[b + 2] - stab.v[a + 2]) * f
  ];
}
