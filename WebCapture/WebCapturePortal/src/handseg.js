// SPECS Inc. 2027
// Hand segmentation for the camera video: finds the wearer's hands in every frame (MediaPipe hand landmarker, run in the
// browser; no frame leaves the machine) so the viewer can draw the real hand over the virtual layer, as a hand in
// front of the display would hide the AR behind it. Only 21 landmarks per hand per frame are kept (a few KB per
// second of video); the soft mask is drawn from them when the frame is shown.

const CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODEL_CDN = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const LOCAL = "vendor/mediapipe";

// Bones used to turn landmarks into a filled hand: the palm polygon plus a thick stroke along every finger.
const PALM = [0, 1, 2, 5, 9, 13, 17];
const FINGERS = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20]
];

let landmarkerPromise = null;

/** True when the portal's own server hands out the vendored files (it must know the wasm content type). */
async function localAvailable() {
  try {
    const r = await fetch(LOCAL + "/vision_wasm_internal.wasm", {method: "HEAD"});
    return r.ok && (r.headers.get("content-type") || "").indexOf("wasm") >= 0;
  } catch (e) {
    return false;
  }
}

async function createLandmarker() {
  const local = await localAvailable();
  const bundle = local ? LOCAL + "/vision_bundle.mjs" : CDN + "/vision_bundle.mjs";
  const wasmRoot = local ? LOCAL : CDN + "/wasm";
  const model = local ? LOCAL + "/hand_landmarker.task" : MODEL_CDN;
  const mod = await import(/* @vite-ignore */ new URL(bundle, location.href).href);
  const fileset = await mod.FilesetResolver.forVisionTasks(wasmRoot);
  return mod.HandLandmarker.createFromOptions(fileset, {
    baseOptions: {modelAssetPath: model, delegate: "CPU"},
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.35,
    minHandPresenceConfidence: 0.35,
    minTrackingConfidence: 0.35
  });
}

export function getLandmarker() {
  if (!landmarkerPromise) landmarkerPromise = createLandmarker().catch((e) => {
    landmarkerPromise = null;
    throw e;
  });
  return landmarkerPromise;
}

/**
 * Finds the hands in every frame of the VideoTrack. Resolves with {w, h, frames: {packetIndex: [[x, y, x, y ...] per hand]}}
 * (coordinates 0..1 of the frame).
 */
export async function detectHands(track, onProgress) {
  const landmarker = await getLandmarker();
  const W = 480;
  const H = 360;
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext("2d", {willReadFrequently: true});
  ctx.imageSmoothingQuality = "high";
  const frames = {};
  let done = 0;
  let found = 0;
  const total = track.packets.length;
  const pending = [];
  const dec = new VideoDecoder({
    output: (frame) => {
      const index = frame.timestamp;
      if (index % 2 === 1) {
        // every other frame: the neighbour's hand is used (hands move little in 33 ms; halves the work)
        frame.close();
        done++;
        return;
      }
      ctx.drawImage(frame, 0, 0, W, H);
      frame.close();
      let result = null;
      try {
        // MediaPipe wants strictly increasing timestamps in VIDEO mode
        result = landmarker.detectForVideo(canvas, index * 33 + 1);
      } catch (e) {
        result = null;
      }
      if (result && result.landmarks && result.landmarks.length) {
        frames[index] = result.landmarks.map((hand) => {
          const flat = [];
          for (const p of hand) flat.push(+p.x.toFixed(4), +p.y.toFixed(4));
          return flat;
        });
        found++;
      }
      done++;
      if (onProgress && done % 6 === 0) onProgress(done / total);
    },
    error: () => {}
  });
  dec.configure(track.config);
  let start = 0;
  while (start < track.packets.length && !track.packets[start].key) start++;
  for (let i = start; i < track.packets.length; i++) {
    const p = track.packets[i];
    dec.decode(new EncodedVideoChunk({type: p.key ? "key" : "delta", timestamp: i, data: p.data}));
    // pace the decoder with the (slower) detector so frames don't pile up in memory
    while (dec.decodeQueueSize > 4 || done < i - start - 12) await new Promise((r) => setTimeout(r, 6));
  }
  await dec.flush();
  while (done < total - start) await new Promise((r) => setTimeout(r, 10));
  dec.close();
  return {w: W, h: H, frames, found, total};
}

/**
 * Draws a soft hand mask (white on transparent) for one frame's hands onto `ctx` covering (x, y, w, h), the area the video
 * frame occupies on the canvas. `hands`: arrays of 42 numbers (x0, y0, x1, y1 ...) as detectHands returns them.
 */
export function drawHandMask(ctx, hands, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const hand of hands) {
    const pt = (i) => [x + hand[i * 2] * w, y + hand[i * 2 + 1] * h];
    // finger width follows the hand's size: the wrist-to-middle-knuckle distance
    const [wx, wy] = pt(0);
    const [mx, my] = pt(9);
    const span = Math.hypot(mx - wx, my - wy);
    ctx.lineWidth = Math.max(4, span * 0.34);
    ctx.beginPath();
    PALM.forEach((i, k) => {
      const [px, py] = pt(i);
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (const finger of FINGERS) {
      ctx.beginPath();
      finger.forEach((i, k) => {
        const [px, py] = pt(i);
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }
  }
  ctx.restore();
}
