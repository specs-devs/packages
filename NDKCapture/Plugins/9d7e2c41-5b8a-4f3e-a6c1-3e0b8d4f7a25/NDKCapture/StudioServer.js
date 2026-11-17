// SPECS Inc. 2027
// NDK Capture Studio local server, run inside Lens Studio by the NDK Capture plugin. Cross-platform:
// it only uses Lens Studio's own Network/WebSocket/FileSystem modules, so there is nothing to install.
//
//   http://127.0.0.1:47792  the NDK Capture Studio (files from <project>/NDKCaptureStudio/) + /api/*
//   ws://127.0.0.1:47793    the Lens (NDKCapture component) streams layers and recordings
//
// Recordings are folders: <project>/NDKCaptureRecordings/<id>/ with manifest.json, the layer chunks
// (<layer>.proxy.<n>.ndjson = JPEG proxy frames, <layer>.nkc.<n>.b64 = native NKC1 packets) and
// edits.json (Studio edits; the recorded tracks are never changed). See Docs/format.md.
import * as fs from "LensStudio:FileSystem";
import * as Network from "LensStudio:Network";
import * as ws from "LensStudio:WebSocket";

export const HTTP_PORT = 47792;
export const WS_PORT = 47793;
export const VERSION = "4.0.0";
const RECORDINGS_DIR = "NDKCaptureRecordings";
const STUDIO_DIR = "NDKCaptureStudio";
const MAX_BODY = 4 * 1024 * 1024;
const FLUSH_SECONDS = 2;
const LAYERS = ["camera", "ar", "ui", "mic"];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ndjson": "application/x-ndjson; charset=utf-8",
  ".b64": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8"
};
const BINARY = [".png", ".jpg", ".ico", ".mp4"];

function ext(p) {
  const i = p.lastIndexOf(".");
  return i >= 0 ? p.substring(i).toLowerCase() : "";
}

/** Recording ids and file names: letters, digits, - _ . only (no paths). */
export function safeName(name) {
  const n = String(name || "")
    .replace(/[^A-Za-z0-9_.\-]/g, "-")
    .replace(/^\.+/, "")
    .substring(0, 120);
  return n || "recording";
}

export class StudioServer {
  constructor(getProjectDir, log) {
    this.getProjectDir = getProjectDir;
    this.lan = false; // when true the Lens socket also accepts Specs on the local network
    this.log = log || (() => {});
    this.http = null;
    this.wss = null;
    this.lenses = []; // {socket, hello, connectedAt}
    this.live = {revision: 0, frames: {}, settings: null, stats: null, at: 0};
    this.active = null; // recording being written {manifest, dir, buffers{}, chunks{}, flushAt}
    this.saved = [];
    this.errors = [];
    this.listeners = [];
    this.guards = [];
  }

  // ---------- lifecycle

  start() {
    this.stop();
    try {
      this.http = Network.TcpServer.create();
      this.guards.push(this.http.onConnect.connect((socket) => this.onHttpSocket(socket)));
      const a = new Network.Address();
      a.address = "127.0.0.1";
      a.port = HTTP_PORT;
      this.http.listen(a);
    } catch (e) {
      this.fail("Could not start the Studio server on port " + HTTP_PORT + ": " + e);
    }
    try {
      this.wss = ws.WebSocketServer.create();
      this.guards.push(this.wss.onConnect.connect((socket) => this.onLensSocket(socket)));
      this.guards.push(this.wss.onError.connect((error) => this.fail("Lens socket server error: " + error)));
      const a = new Network.Address();
      // Local only by default; "Accept Specs on my network" in the panel listens on every interface
      // so a Spectacles on the same Wi-Fi can connect to this computer's LAN address.
      a.address = this.lan ? "0.0.0.0" : "127.0.0.1";
      a.port = WS_PORT;
      this.wss.listen(a);
    } catch (e) {
      this.fail("Could not start the Lens socket on port " + WS_PORT + ": " + e);
    }
    this.log(
      "NDK Capture Studio on http://127.0.0.1:" +
        HTTP_PORT +
        " (Lens socket ws://" +
        (this.lan ? "<this computer's LAN address>" : "127.0.0.1") +
        ":" +
        WS_PORT +
        ")"
    );
    this.changed();
  }

  stop() {
    if (this.active) this.finishRecording(null);
    for (const g of this.guards) {
      try {
        g.disconnect();
      } catch (e) {
        /* already gone */
      }
    }
    this.guards = [];
    for (const l of this.lenses) {
      try {
        l.socket.close();
      } catch (e) {
        /* already closed */
      }
    }
    this.lenses = [];
    for (const s of [this.http, this.wss]) {
      if (s) {
        try {
          s.close();
        } catch (e) {
          /* already closed */
        }
      }
    }
    this.http = null;
    this.wss = null;
  }

  get running() {
    return !!this.http;
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  changed() {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch (e) {
        /* listener errors never break the server */
      }
    }
  }

  fail(message) {
    this.errors.unshift({at: new Date().toISOString(), message: message});
    this.errors = this.errors.slice(0, 20);
    console.error("[NDKCapture] " + message);
    this.changed();
  }

  // ---------- paths

  projectDir() {
    const d = this.getProjectDir();
    return d ? d.toString() : "";
  }

  recordingsDir() {
    const p = new Editor.Path(this.projectDir() + "/" + RECORDINGS_DIR);
    if (!fs.exists(p)) fs.createDir(p, {recursive: true});
    return p.toString();
  }

  studioDir() {
    return this.projectDir() + "/" + STUDIO_DIR;
  }

  studioInstalled() {
    return this.projectDir() !== "" && fs.exists(new Editor.Path(this.studioDir() + "/index.html"));
  }

  status() {
    return {
      ok: true,
      version: VERSION,
      project: this.projectDir(),
      studioInstalled: this.studioInstalled(),
      recordingsDir: this.projectDir() ? this.projectDir() + "/" + RECORDINGS_DIR : "",
      httpPort: HTTP_PORT,
      wsPort: WS_PORT,
      lan: this.lan,
      lenses: this.lenses.map((l) => ({
        lens: l.hello.lens || "Lens",
        device: l.hello.device || "",
        ndk: l.hello.ndk || "",
        layers: l.hello.layers || [],
        since: l.connectedAt
      })),
      recording: this.active ? {id: this.active.manifest.id, name: this.active.manifest.name} : null,
      saved: this.saved.slice(0, 10),
      errors: this.errors.slice(0, 5)
    };
  }

  // ---------- recordings on disk

  listRecordings() {
    const dir = this.recordingsDir();
    let names = [];
    try {
      names = Array.from(fs.readDir(new Editor.Path(dir), {recursive: false})).map((n) => n.toString());
    } catch (e) {
      names = [];
    }
    const out = [];
    for (const name of names) {
      const mp = new Editor.Path(dir + "/" + name + "/manifest.json");
      if (!fs.exists(mp)) continue;
      try {
        const m = JSON.parse(fs.readFile(mp));
        out.push({
          id: name,
          name: m.name || name,
          createdAt: m.createdAt || "",
          durationMs: m.durationMs || 0,
          device: m.device || "",
          layers: (m.layers || []).map((l) => l.id + ":" + l.codec),
          markers: (m.markers || []).length,
          edited: fs.exists(new Editor.Path(dir + "/" + name + "/edits.json"))
        });
      } catch (e) {
        out.push({id: name, name: name, broken: true});
      }
    }
    out.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return out;
  }

  recordingFile(id, file) {
    const sid = safeName(id);
    const sf = safeName(file);
    if (sid !== id || sf !== file) throw new Error("Invalid recording path");
    return new Editor.Path(this.recordingsDir() + "/" + sid + "/" + sf);
  }

  beginRecording(manifest) {
    if (this.active) this.finishRecording(null);
    const id = safeName(manifest.id || "rec");
    const dir = this.recordingsDir() + "/" + id;
    fs.createDir(new Editor.Path(dir), {recursive: true});
    manifest.chunks = {};
    this.active = {manifest: manifest, dir: dir, buffers: {}, flushAt: Date.now() + FLUSH_SECONDS * 1000};
    this.writeManifest();
    this.log("Recording " + id + " started");
    this.changed();
  }

  appendLine(kind, layer, line) {
    if (!this.active) return;
    const key = layer + "." + kind;
    (this.active.buffers[key] = this.active.buffers[key] || []).push(line);
    if (Date.now() >= this.active.flushAt) this.flush();
  }

  flush() {
    const a = this.active;
    if (!a) return;
    a.flushAt = Date.now() + FLUSH_SECONDS * 1000;
    for (const key of Object.keys(a.buffers)) {
      const lines = a.buffers[key];
      if (!lines.length) continue;
      const n = a.manifest.chunks[key] || 0;
      const [layer, kind] = key.split(".");
      const file = kind === "proxy" ? layer + ".proxy." + n + ".ndjson" : layer + ".nkc." + n + ".b64";
      fs.writeFile(new Editor.Path(a.dir + "/" + file), lines.join("\n") + "\n");
      a.manifest.chunks[key] = n + 1;
      a.buffers[key] = [];
    }
    this.writeManifest();
  }

  writeManifest() {
    if (!this.active) return;
    fs.writeFile(new Editor.Path(this.active.dir + "/manifest.json"), JSON.stringify(this.active.manifest, null, 1));
  }

  finishRecording(finalManifest) {
    const a = this.active;
    if (!a) return;
    if (finalManifest) {
      const chunks = a.manifest.chunks;
      a.manifest = Object.assign({}, a.manifest, finalManifest, {
        chunks: chunks,
        timeline: finalManifest.timeline || a.manifest.timeline,
        markers: finalManifest.markers || a.manifest.markers
      });
    } else {
      a.manifest.interrupted = true;
    }
    this.flush();
    this.active = null;
    const entry = {id: a.manifest.id, name: a.manifest.name, at: new Date().toISOString()};
    this.saved.unshift(entry);
    this.saved = this.saved.slice(0, 20);
    this.log("Saved recording " + a.manifest.id + (finalManifest ? "" : " (interrupted)"));
    this.changed();
  }

  // ---------- Lens socket

  onLensSocket(socket) {
    const lens = {socket: socket, hello: {}, connectedAt: new Date().toISOString()};
    this.lenses.push(lens);
    this.changed();
    socket.onData.connect((buffer) => {
      let msg;
      try {
        msg = JSON.parse(buffer.toString());
      } catch (e) {
        return;
      }
      try {
        this.onLensMessage(lens, msg);
      } catch (e) {
        this.fail("Lens message failed: " + e);
      }
    });
    const gone = () => {
      this.lenses = this.lenses.filter((l) => l !== lens);
      if (this.active && this.lenses.length === 0) this.finishRecording(null);
      this.changed();
    };
    socket.onEnd.connect(gone);
    socket.onError.connect(gone);
  }

  onLensMessage(lens, msg) {
    const live = this.live;
    switch (msg.type) {
      case "hello":
        lens.hello = msg;
        this.changed();
        break;
      case "settings":
        live.settings = msg.layers;
        live.revision++;
        break;
      case "frame":
        if (LAYERS.indexOf(msg.layer) < 0) return;
        live.frames[msg.layer] = {t: msg.t, data: msg.data, seq: (live.frames[msg.layer] || {seq: 0}).seq + 1};
        live.revision++;
        live.at = Date.now();
        if (this.active) this.appendLine("proxy", msg.layer, JSON.stringify({t: msg.t, d: msg.data}));
        break;
      case "packets":
        if (LAYERS.indexOf(msg.layer) < 0) return;
        if (this.active) this.appendLine("nkc", msg.layer, String(msg.data || ""));
        break;
      case "stats":
        live.stats = msg.stats;
        break;
      case "record-begin":
        this.beginRecording(msg.manifest || {});
        break;
      case "record-change":
        if (this.active) this.active.manifest.timeline.push(msg.change);
        break;
      case "record-marker":
        if (this.active) this.active.manifest.markers.push(msg.marker);
        break;
      case "record-end":
        this.finishRecording(msg.manifest || {});
        break;
    }
  }

  sendCommand(action, args) {
    const text = JSON.stringify({type: "command", action: action, args: args || {}});
    let n = 0;
    for (const l of this.lenses) {
      try {
        l.socket.send(text);
        n++;
      } catch (e) {
        /* socket closing */
      }
    }
    return n;
  }

  // ---------- HTTP

  onHttpSocket(socket) {
    const state = {chunks: [], length: 0, done: false};
    socket.onData.connect((data) => {
      if (state.done) return;
      const text = data.toString();
      state.chunks.push(text);
      state.length += text.length;
      const all = state.chunks.join("");
      const headerEnd = all.indexOf("\r\n\r\n");
      if (headerEnd < 0) {
        if (state.length > 64 * 1024) this.finish(socket, state, 431, "text/plain", "Headers too large");
        return;
      }
      const head = all.substring(0, headerEnd);
      const m = /\r\ncontent-length:\s*(\d+)/i.exec(head);
      const length = m ? parseInt(m[1], 10) : 0;
      if (length > MAX_BODY) return this.finish(socket, state, 413, "text/plain", "Body too large");
      const body = all.substring(headerEnd + 4);
      if (body.length < length) return;
      state.done = true;
      const firstLine = head.split("\r\n")[0].split(" ");
      this.route(socket, state, firstLine[0], firstLine[1] || "/", body);
    });
    socket.onError.connect(() => {
      state.done = true;
    });
  }

  route(socket, state, method, rawPath, body) {
    const q = rawPath.indexOf("?");
    const path = decodeURIComponent(q >= 0 ? rawPath.substring(0, q) : rawPath);
    const query = {};
    if (q >= 0) {
      for (const kv of rawPath.substring(q + 1).split("&")) {
        const [k, v] = kv.split("=");
        if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || "");
      }
    }
    const json = (code, obj) =>
      this.finish(socket, state, code, "application/json; charset=utf-8", JSON.stringify(obj));
    try {
      if (method === "OPTIONS") return this.finish(socket, state, 204, "text/plain", "");
      if (path === "/api/status") return json(200, this.status());
      if (path === "/api/live") {
        // Frames newer than the per-layer sequence numbers the Studio already has.
        const have = {};
        for (const layer of LAYERS) have[layer] = parseInt(query[layer] || "0", 10) || 0;
        const frames = {};
        for (const layer of LAYERS) {
          const f = this.live.frames[layer];
          if (f && f.seq > have[layer]) frames[layer] = f;
        }
        return json(200, {
          revision: this.live.revision,
          at: this.live.at,
          settings: this.live.settings,
          stats: this.live.stats,
          recording: this.active ? this.active.manifest.id : null,
          frames: frames
        });
      }
      if (path === "/api/command" && method === "POST") {
        const cmd = JSON.parse(body || "{}");
        const allowed = ["setLayer", "startStream", "stopStream", "startRecording", "stopRecording", "marker", "keyFrame"];
        if (allowed.indexOf(cmd.action) < 0) return json(400, {error: "Unknown action"});
        return json(200, {delivered: this.sendCommand(cmd.action, cmd.args)});
      }
      if (path === "/api/recordings" && method === "GET") return json(200, {recordings: this.listRecordings()});
      if (path.indexOf("/api/recordings/") === 0) {
        const parts = path.substring("/api/recordings/".length).split("/");
        if (parts.length !== 2) return json(400, {error: "Use /api/recordings/<id>/<file>"});
        const p = this.recordingFile(parts[0], parts[1]);
        if (method === "GET") {
          if (!fs.exists(p)) return json(404, {error: "Not found"});
          const e = ext(parts[1]);
          const content = BINARY.indexOf(e) >= 0 ? fs.readBytes(p) : fs.readFile(p);
          return this.finish(socket, state, 200, MIME[e] || "text/plain; charset=utf-8", content);
        }
        if (method === "PUT" && parts[1] === "edits.json") {
          JSON.parse(body); // reject broken JSON
          fs.writeFile(p, body);
          this.changed();
          return json(200, {saved: parts[1]});
        }
        return json(405, {error: "Only edits.json can be written"});
      }
      if (path.indexOf("/api/") === 0) return json(404, {error: "Unknown API"});
      return this.serveStatic(socket, state, path);
    } catch (e) {
      return json(500, {error: String(e)});
    }
  }

  serveStatic(socket, state, path) {
    if (!this.studioInstalled()) {
      const html =
        '<!doctype html><meta charset="utf-8"><title>NDK Capture Studio</title><body style="font:15px system-ui;background:#111;color:#eee;padding:40px;max-width:640px">' +
        "<h1>NDK Capture Studio not unpacked yet</h1><p>Unzip <code>NDKCapture.lspkg/ExtractAtProjectRoot/NDKCaptureStudio.zip</code> <b>at the project root</b>, next to <code>Assets/</code>, so that <code>" +
        this.studioDir().replace(/</g, "&lt;") +
        "/index.html</code> exists. Then reload this page.</p>" +
        '<p>The API is already running: <a style="color:#7cf" href="/api/status">/api/status</a>.</p></body>';
      return this.finish(socket, state, 200, "text/html; charset=utf-8", html);
    }
    const rel = path === "/" ? "/index.html" : path;
    if (rel.indexOf("..") >= 0 || rel.indexOf("\\") >= 0)
      return this.finish(socket, state, 400, "text/plain", "Bad path");
    const file = new Editor.Path(this.studioDir() + rel);
    if (!fs.exists(file) || fs.isDirectory(file))
      return this.finish(socket, state, 404, "text/plain", "Not found: " + rel);
    const e = ext(rel);
    const content = BINARY.indexOf(e) >= 0 ? fs.readBytes(file) : fs.readFile(file);
    return this.finish(socket, state, 200, MIME[e] || "application/octet-stream", content);
  }

  finish(socket, state, code, type, content) {
    state.done = true;
    const reason =
      {
        200: "OK",
        204: "No Content",
        400: "Bad Request",
        404: "Not Found",
        405: "Method Not Allowed",
        413: "Payload Too Large",
        431: "Request Header Fields Too Large",
        500: "Internal Server Error"
      }[code] || "OK";
    const isString = typeof content === "string";
    const length = isString ? utf8Length(content) : content.length;
    const head =
      [
        "HTTP/1.1 " + code + " " + reason,
        "Content-Type: " + type,
        "Content-Length: " + length,
        "Cache-Control: no-store",
        "Access-Control-Allow-Origin: *",
        "Access-Control-Allow-Methods: GET, PUT, POST, OPTIONS",
        "Access-Control-Allow-Headers: Content-Type",
        "Connection: close"
      ].join("\r\n") + "\r\n\r\n";
    try {
      socket.write(head);
      if (length > 0) socket.write(content);
    } catch (e) {
      /* client went away */
    }
    try {
      socket.close();
    } catch (e) {
      /* already closed */
    }
  }
}

function utf8Length(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}
