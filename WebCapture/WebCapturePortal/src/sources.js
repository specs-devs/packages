// SPECS Inc. 2027
// Where the portal gets scenes and recordings from.
//   LocalSource : the WebCapture Lens Studio plugin (http://127.0.0.1:47790/api/...)
//   CloudSource : Snap Cloud (Supabase) RPCs from supabase/setup.sql, with the project's PUBLIC key
//   files       : recordings opened from disk; edits are saved by downloading the JSON
import {normalizeRecording, toJson} from "./model.js";

export const DEFAULT_LOCAL = "http://127.0.0.1:47790";

async function http(method, url, body, headers) {
  const res = await fetch(url, {
    method,
    headers: Object.assign(body != null ? {"Content-Type": "application/json"} : {}, headers || {}),
    body: body != null ? body : undefined,
    cache: "no-store"
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = text;
  }
  if (!res.ok) {
    const msg =
      data && (data.message || data.error || data.hint)
        ? (data.message || data.error) + (data.hint ? " (" + data.hint + ")" : "")
        : res.status + " " + res.statusText;
    throw new Error(msg);
  }
  return data;
}

export class LocalSource {
  constructor(base) {
    this.base = (base || DEFAULT_LOCAL).replace(/\/+$/, "");
    this.kind = "local";
  }
  label() {
    return "Lens Studio (local)";
  }
  status() {
    return http("GET", this.base + "/api/status");
  }
  live(since) {
    return http("GET", this.base + "/api/live?since=" + (since || 0));
  }
  async list() {
    const r = await http("GET", this.base + "/api/recordings");
    return (r.recordings || []).map((x) => Object.assign({source: "local", key: x.file}, x));
  }
  async load(key) {
    return normalizeRecording(await http("GET", this.base + "/api/recordings/" + encodeURIComponent(key)));
  }
  save(key, rec) {
    return http("PUT", this.base + "/api/recordings/" + encodeURIComponent(key), toJson(rec));
  }
  remove(key) {
    return http("DELETE", this.base + "/api/recordings/" + encodeURIComponent(key));
  }
  command(action, args) {
    return http("POST", this.base + "/api/command", JSON.stringify({action, args: args || {}}));
  }
}

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function fnv32(text, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** The project's capture id, derived from the Snap Cloud URL and public key: identical to projectCode() in
 *  WebCaptureProtocol.ts, so the portal finds every recording the Lens saves with nothing to type. */
export function projectCode(url, key) {
  const text = String(url || "").replace(/\/+$/, "").toLowerCase() + "|" + String(key || "");
  let out = "WC-";
  for (const seed of [0x811c9dc5, 0x01000193, 0xdeadbeef]) {
    let h = fnv32(text, seed);
    for (let i = 0; i < 5; i++) {
      out += CODE_ALPHABET.charAt(h % CODE_ALPHABET.length);
      h = Math.floor(h / CODE_ALPHABET.length);
    }
  }
  return out;
}

export class CloudSource {
  constructor(url, key, code) {
    this.url = (url || "").replace(/\/+$/, "");
    this.key = key || "";
    this.code = projectCode(this.url, this.key);
    this.kind = "cloud";
  }
  label() {
    return "Snap Cloud " + this.code;
  }
  configured() {
    return !!(this.url && this.key);
  }
  rpc(name, args) {
    return http("POST", this.url + "/rest/v1/rpc/" + name, JSON.stringify(args || {}), {
      apikey: this.key,
      Authorization: "Bearer " + this.key
    });
  }
  async live(since) {
    const r = await this.rpc("webcapture_get_session", {p_code: this.code});
    if (!r) return {revision: 0, scene: null, ended: true};
    if (since && r.revision <= since) return {revision: r.revision, scene: null, unchanged: true, status: r.status};
    return {revision: r.revision, scene: r.scene, status: r.status};
  }
  async list() {
    const rows = (await this.rpc("webcapture_list_recordings", {p_code: this.code})) || [];
    return rows.map((r) => ({
      source: "cloud",
      key: r.id,
      name: r.name,
      duration: r.duration,
      createdAt: r.created_at,
      objects: r.objects,
      edited: r.edited,
      bytes: r.bytes
    }));
  }
  async load(id) {
    const r = await this.rpc("webcapture_get_recording", {p_code: this.code, p_id: id});
    if (!r) throw new Error("Recording not found for this code");
    let rec = r.data;
    const st = rec && rec.meta && rec.meta.storage;
    if (st && st.path) {
      // The heavy parts (meshes, textures, camera frames) live in Snap Cloud Storage: fetch and merge them.
      const res = await fetch(this.url + "/storage/v1/object/public/" + st.bucket + "/" + st.path);
      if (!res.ok) throw new Error("The recording's files are missing from Snap Cloud Storage (" + res.status + ")");
      const full = await res.json();
      rec = Object.assign({}, rec, {assets: full.assets, background: full.background});
    }
    if (r.edits) rec.edits = r.edits;
    return normalizeRecording(rec);
  }
  save(id, rec) {
    return this.rpc("webcapture_save_edits", {p_code: this.code, p_id: id, p_edits: rec.edits});
  }
}

export function readFileAsRecording(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("Could not read " + file.name));
    r.onload = () => {
      try {
        resolve(normalizeRecording(JSON.parse(String(r.result))));
      } catch (e) {
        reject(new Error(file.name + ": " + e.message));
      }
    };
    r.readAsText(file);
  });
}

export function download(name, text, type) {
  const blob = text instanceof Blob ? text : new Blob([text], {type: type || "application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

// Settings are kept in this browser only. The Snap Cloud key is the project's PUBLIC (anon) key.
const STORE = "webcapture.settings.v1";
export function loadSettings() {
  try {
    return Object.assign(
      {local: DEFAULT_LOCAL, cloudUrl: "", cloudKey: "", code: ""},
      JSON.parse(localStorage.getItem(STORE) || "{}")
    );
  } catch (e) {
    return {local: DEFAULT_LOCAL, cloudUrl: "", cloudKey: "", code: ""};
  }
}
export function saveSettings(s) {
  try {
    localStorage.setItem(STORE, JSON.stringify(s));
  } catch (e) {
    /* private mode */
  }
}

/** Optional config.json next to index.html: {"cloudUrl", "cloudKey", "code"} is the project default and wins over saved values, so nothing is typed. */
export async function loadPortalConfig(settings) {
  try {
    const res = await fetch("config.json", {cache: "no-store"});
    if (!res.ok) return false;
    const c = await res.json();
    let changed = false;
    for (const k of ["cloudUrl", "cloudKey"]) {
      if (c[k] && settings[k] !== String(c[k])) {
        settings[k] = String(c[k]);
        changed = true;
      }
    }
    if (changed) saveSettings(settings);
    return changed;
  } catch (e) {
    return false;
  }
}
