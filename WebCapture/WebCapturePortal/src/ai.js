// SPECS Inc. 2027
// "Improve the background with AI": every camera frame goes through an image model (Nano Banana, Google's
// Gemini image model, by default) to remove noise and add resolution. It runs in this browser with the key you
// paste in the inspector; frames are sent to Google with that key and nowhere else. Improved frames are cached
// in this browser (IndexedDB) per recording, so reopening a recording keeps them.

export const DEFAULT_MODEL = "gemini-2.5-flash-image"; // "Nano Banana"
export const MODELS = [
  {id: "gemini-2.5-flash-image", label: "Nano Banana (fast)", sizes: false},
  {id: "gemini-3-pro-image-preview", label: "Nano Banana Pro (2K / 4K)", sizes: true}
];
export const DEFAULT_PROMPT =
  "Restore and upscale this camera frame. Increase the resolution and sharpness, remove noise and compression " +
  "artifacts, and keep the exact same composition, framing, colours, lighting, text and every object unchanged. " +
  "Do not add, remove, move or restyle anything.";

const STORE = "webcapture.ai.v1";

export function loadAiSettings() {
  try {
    return Object.assign(
      {key: "", model: DEFAULT_MODEL, prompt: DEFAULT_PROMPT, size: "1K", every: 1, consent: false},
      JSON.parse(localStorage.getItem(STORE) || "{}")
    );
  } catch (e) {
    return {key: "", model: DEFAULT_MODEL, prompt: DEFAULT_PROMPT, size: "1K", every: 1, consent: false};
  }
}

export function saveAiSettings(s) {
  try {
    localStorage.setItem(STORE, JSON.stringify(s));
  } catch (e) {
    // private mode: the key just isn't remembered
  }
}

const RATIOS = [
  ["1:1", 1],
  ["4:3", 4 / 3],
  ["3:4", 3 / 4],
  ["3:2", 3 / 2],
  ["2:3", 2 / 3],
  ["16:9", 16 / 9],
  ["9:16", 9 / 16]
];

export function nearestRatio(aspect) {
  let best = RATIOS[0];
  for (const r of RATIOS) if (Math.abs(Math.log(r[1] / aspect)) < Math.abs(Math.log(best[1] / aspect))) best = r;
  return best[0];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** One frame through the model. Resolves with a data URL. `dataUrl` is the original JPEG. */
export async function enhanceFrame({key, model, prompt, size, aspect, dataUrl, signal, endpoint}) {
  const base = endpoint || "https://generativelanguage.googleapis.com/v1beta/models/";
  const meta = MODELS.find((m) => m.id === model);
  const gen = {responseModalities: ["IMAGE"], imageConfig: {aspectRatio: nearestRatio(aspect || 4 / 3)}};
  if (meta && meta.sizes) gen.imageConfig.imageSize = size || "2K";
  const body = JSON.stringify({
    contents: [
      {
        parts: [
          {text: prompt},
          {inline_data: {mime_type: "image/jpeg", data: dataUrl.substring(dataUrl.indexOf(",") + 1)}}
        ]
      }
    ],
    generationConfig: gen
  });
  let lastError = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(base + encodeURIComponent(model) + ":generateContent", {
      method: "POST",
      headers: {"Content-Type": "application/json", "x-goog-api-key": key},
      body,
      signal
    });
    if (res.status === 429 || res.status === 503) {
      lastError = "busy (" + res.status + ")";
      await sleep(1500 * Math.pow(2, attempt));
      continue;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (json.error && json.error.message) || "HTTP " + res.status;
      if (res.status === 400 || res.status === 401 || res.status === 403) throw new Error(msg + (res.status !== 400 ? " (check the API key)" : ""));
      lastError = msg;
      await sleep(1000);
      continue;
    }
    const parts = (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts) || [];
    for (const part of parts) {
      const inline = part.inlineData || part.inline_data;
      if (inline && inline.data) return "data:" + (inline.mimeType || inline.mime_type || "image/png") + ";base64," + inline.data;
    }
    lastError = "the model returned no image" + (json.promptFeedback ? " (" + JSON.stringify(json.promptFeedback).slice(0, 120) + ")" : "");
    await sleep(800);
  }
  throw new Error(lastError || "failed");
}

/** Improves a recording's background. `onProgress(done, total, frameIndex, dataUrl)`. Resolves with the count. */
export async function enhanceBackground({rec, settings, indexes, onProgress, signal, endpoint, parallel = 2}) {
  const frames = rec.background.frames;
  const aspect = rec.meta.aspect || (rec.background.width && rec.background.height ? rec.background.width / rec.background.height : 4 / 3);
  let next = 0;
  let done = 0;
  const failures = [];
  async function worker() {
    while (next < indexes.length) {
      if (signal && signal.aborted) return;
      const i = indexes[next++];
      try {
        const out = await enhanceFrame({
          key: settings.key,
          model: settings.model,
          prompt: settings.prompt,
          size: settings.size,
          aspect,
          dataUrl: frames[i],
          signal,
          endpoint
        });
        done++;
        await cachePut(rec, i, out);
        onProgress(done, indexes.length, i, out);
      } catch (e) {
        if (signal && signal.aborted) return;
        failures.push(e.message || String(e));
        if (/API key|401|403|API_KEY/i.test(e.message || "")) {
          next = indexes.length; // a bad key fails every frame: stop now
        }
        done++;
        onProgress(done, indexes.length, -1, null, e.message || String(e));
      }
    }
  }
  await Promise.all(Array.from({length: parallel}, worker));
  return {failures};
}

// ---- cache: improved frames per recording, in this browser

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("webcapture-ai", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("frames");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const keyOf = (rec, i) => rec.meta.id + ":" + i;

export async function cachePut(rec, i, dataUrl) {
  try {
    const db = await openDb();
    await new Promise((res, rej) => {
      const tx = db.transaction("frames", "readwrite");
      tx.objectStore("frames").put(dataUrl, keyOf(rec, i));
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  } catch (e) {
    // no IndexedDB: the improved frames just aren't kept after a reload
  }
}

export async function cacheLoad(rec) {
  const out = new Map();
  try {
    const db = await openDb();
    const n = rec.background && rec.background.frames ? rec.background.frames.length : 0;
    await Promise.all(
      Array.from({length: n}, (_, i) =>
        new Promise((res) => {
          const r = db.transaction("frames").objectStore("frames").get(keyOf(rec, i));
          r.onsuccess = () => {
            if (r.result) out.set(i, r.result);
            res();
          };
          r.onerror = () => res();
        })
      )
    );
  } catch (e) {
    // nothing cached
  }
  return out;
}

export async function cacheClear(rec) {
  try {
    const db = await openDb();
    const n = rec.background && rec.background.frames ? rec.background.frames.length : 0;
    await new Promise((res) => {
      const tx = db.transaction("frames", "readwrite");
      for (let i = 0; i < n; i++) tx.objectStore("frames").delete(keyOf(rec, i));
      tx.oncomplete = res;
      tx.onerror = res;
    });
  } catch (e) {
    // nothing to clear
  }
}
