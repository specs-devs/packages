// SPECS Inc. 2027
// Web Capture local server, run inside Lens Studio by the WebCapture plugin. Cross-platform: it only
// uses Lens Studio's own Network/WebSocket/FileSystem modules, so there is nothing to install.
//
//   http://127.0.0.1:47790  the Web Capture portal (files from <project>/WebCapturePortal/) + /api/*
//   ws://127.0.0.1:47791    the Lens (WebCapture component, Local mode) sends scenes and recordings
//
// Recordings are written to <project>/WebCaptureRecordings/<name>.webcapture.json.
import * as fs from "LensStudio:FileSystem";
import * as Network from "LensStudio:Network";
import * as ws from "LensStudio:WebSocket";

export const HTTP_PORT = 47790;
export const WS_PORT = 47791;
export const VERSION = "4.0.0";
const RECORDINGS_DIR = "WebCaptureRecordings";
const PORTAL_DIR = "WebCapturePortal";
const MAX_BODY = 64 * 1024 * 1024;
const MAX_RECORDING = 64 * 1024 * 1024;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".md": "text/markdown; charset=utf-8",
  ".wasm": "application/wasm",
  ".task": "application/octet-stream"
};
const BINARY = [".png", ".jpg", ".webp", ".ico", ".woff2", ".mp3", ".wav", ".wasm", ".task"];

function ext(p) {
  const i = p.lastIndexOf(".");
  return i >= 0 ? p.substring(i).toLowerCase() : "";
}

/** A recording file name the portal and the Lens may use: letters, digits, - _ . and spaces. */
export function safeFileName(name) {
  let n = String(name || "")
    .replace(/[^A-Za-z0-9 _.\-]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  n = n.replace(/^\.+/, "");
  if (!n.endsWith(".webcapture.json")) n = n.replace(/\.json$/i, "") + ".webcapture.json";
  if (n.length > 140) n = n.substring(0, 124) + ".webcapture.json";
  return n === ".webcapture.json" ? "recording.webcapture.json" : n;
}

export class PortalServer {
  constructor(getProjectDir, log) {
    this.getProjectDir = getProjectDir;
    this.log = log || (() => {});
    this.http = null;
    this.wss = null;
    this.lenses = []; // {socket, hello, connectedAt}
    this.scene = null; // latest snapshot from a Lens
    this.sceneRevision = 0; // portal-side revision (monotonic across Lens restarts)
    this.sceneAt = 0;
    this.uploads = {}; // recording id -> {name, chunks[], expected}
    this.saved = []; // recent saves, newest first
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
      this.fail("Could not start the portal server on port " + HTTP_PORT + ": " + e);
    }
    try {
      this.wss = ws.WebSocketServer.create();
      this.guards.push(this.wss.onConnect.connect((socket) => this.onLensSocket(socket)));
      this.guards.push(this.wss.onError.connect((error) => this.fail("Lens socket server error: " + error)));
      const a = new Network.Address();
      a.address = "127.0.0.1";
      a.port = WS_PORT;
      this.wss.listen(a);
    } catch (e) {
      this.fail("Could not start the Lens socket on port " + WS_PORT + ": " + e);
    }
    this.log("Web Capture portal on http://127.0.0.1:" + HTTP_PORT + " (Lens socket ws://127.0.0.1:" + WS_PORT + ")");
    this.changed();
  }

  stop() {
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
    console.error("[WebCapture] " + message);
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

  portalDir() {
    return this.projectDir() + "/" + PORTAL_DIR;
  }

  portalInstalled() {
    return this.projectDir() !== "" && fs.exists(new Editor.Path(this.portalDir() + "/index.html"));
  }

  status() {
    return {
      ok: true,
      version: VERSION,
      project: this.projectDir(),
      portalInstalled: this.portalInstalled(),
      portalDir: this.portalDir(),
      recordingsDir: this.projectDir() ? this.projectDir() + "/" + RECORDINGS_DIR : "",
      httpPort: HTTP_PORT,
      wsPort: WS_PORT,
      lenses: this.lenses.map((l) => ({
        lens: l.hello.lens || "Lens",
        session: l.hello.session || "",
        since: l.connectedAt
      })),
      scene: this.scene
        ? {
            revision: this.sceneRevision,
            at: this.sceneAt,
            objects: (this.scene.objects || []).length,
            recording: this.scene.recording || null
          }
        : null,
      saved: this.saved.slice(0, 10),
      errors: this.errors.slice(0, 5)
    };
  }

  // ---------- recordings

  listRecordings() {
    const dir = this.recordingsDir();
    const out = [];
    let names = [];
    try {
      names = Array.from(fs.readDir(new Editor.Path(dir), {recursive: false})).map((n) => n.toString());
    } catch (e) {
      names = [];
    }
    for (const name of names) {
      if (!name.endsWith(".webcapture.json")) continue;
      const path = new Editor.Path(dir + "/" + name);
      let meta = {};
      try {
        const rec = JSON.parse(fs.readFile(path));
        meta = rec.meta || {};
        meta.objects = (rec.objects || []).length;
        meta.edited = !!rec.edits;
      } catch (e) {
        meta = {broken: true};
      }
      out.push({
        file: name,
        bytes: fs.size(path),
        name: meta.name || name,
        id: meta.id || "",
        duration: meta.duration || 0,
        createdAt: meta.createdAt || "",
        objects: meta.objects || 0,
        edited: !!meta.edited,
        broken: !!meta.broken
      });
    }
    out.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return out;
  }

  recordingPath(file) {
    const safe = safeFileName(file);
    if (safe !== file) throw new Error("Invalid recording file name");
    return new Editor.Path(this.recordingsDir() + "/" + safe);
  }

  saveRecordingText(name, id, text) {
    const rec = JSON.parse(text); // throws on broken JSON
    if (!rec || rec.format !== "webcapture/1") throw new Error("Not a webcapture/1 recording");
    let file = safeFileName((name || "recording") + " " + (id || "").replace(/^rec-/, ""));
    const path = new Editor.Path(this.recordingsDir() + "/" + file);
    fs.writeFile(path, text);
    const entry = {file: file, name: rec.meta && rec.meta.name, at: new Date().toISOString(), bytes: text.length};
    this.saved.unshift(entry);
    this.saved = this.saved.slice(0, 20);
    this.log("Saved recording " + file + " (" + Math.round(text.length / 1024) + " KB)");
    this.changed();
    return file;
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
      this.changed();
    };
    socket.onEnd.connect(gone);
    socket.onError.connect(gone);
  }

  onLensMessage(lens, msg) {
    if (msg.type === "hello") {
      lens.hello = msg;
      this.changed();
    } else if (msg.type === "scene" && msg.snapshot) {
      this.scene = msg.snapshot;
      this.sceneRevision++;
      this.sceneAt = Date.now();
    } else if (msg.type === "recording-begin") {
      if (!msg.id || msg.bytes > MAX_RECORDING) {
        lens.socket.send(JSON.stringify({type: "save-failed", id: msg.id, error: "Recording too large"}));
        return;
      }
      this.uploads[msg.id] = {
        name: msg.name || "recording",
        chunks: new Array(msg.chunks || 1),
        expected: msg.chunks || 1
      };
    } else if (msg.type === "recording-chunk") {
      const up = this.uploads[msg.id];
      if (up && msg.index >= 0 && msg.index < up.expected) up.chunks[msg.index] = String(msg.data || "");
    } else if (msg.type === "recording-end") {
      const up = this.uploads[msg.id];
      delete this.uploads[msg.id];
      if (!up) return;
      try {
        for (let i = 0; i < up.expected; i++)
          if (typeof up.chunks[i] !== "string") throw new Error("Missing chunk " + i);
        const file = this.saveRecordingText(up.name, msg.id, up.chunks.join(""));
        lens.socket.send(JSON.stringify({type: "saved", id: msg.id, file: RECORDINGS_DIR + "/" + file}));
      } catch (e) {
        this.fail("Recording " + msg.id + " not saved: " + e);
        lens.socket.send(JSON.stringify({type: "save-failed", id: msg.id, error: String(e)}));
      }
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
      // Content-Length counts bytes; JSON from the portal is ASCII-safe (non-ASCII is \u-escaped).
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
        const since = parseInt(query.since || "0", 10) || 0;
        if (!this.scene) return json(200, {revision: 0, scene: null});
        if (since >= this.sceneRevision) return json(200, {revision: this.sceneRevision, scene: null, unchanged: true});
        return json(200, {revision: this.sceneRevision, at: this.sceneAt, scene: this.scene});
      }
      if (path === "/api/command" && method === "POST") {
        // Capturing is started and stopped only inside the Lens (its Start Capture button), never from the portal.
        return json(403, {error: "Start and stop the capture inside the Lens (Start Capture button)."});
      }
      if (path === "/api/recordings" && method === "GET") return json(200, {recordings: this.listRecordings()});
      if (path.indexOf("/api/recordings/") === 0) {
        const file = path.substring("/api/recordings/".length);
        const p = this.recordingPath(file);
        if (method === "GET") {
          if (!fs.exists(p)) return json(404, {error: "Not found"});
          return this.finish(socket, state, 200, "application/json; charset=utf-8", fs.readFile(p));
        }
        if (method === "PUT") {
          const rec = JSON.parse(body);
          if (!rec || rec.format !== "webcapture/1") return json(400, {error: "Not a webcapture/1 recording"});
          fs.writeFile(p, body);
          this.changed();
          return json(200, {saved: file});
        }
        if (method === "DELETE") {
          if (fs.exists(p)) fs.remove(p);
          this.changed();
          return json(200, {deleted: file});
        }
      }
      if (path.indexOf("/api/") === 0) return json(404, {error: "Unknown API"});
      return this.serveStatic(socket, state, path);
    } catch (e) {
      return json(500, {error: String(e)});
    }
  }

  serveStatic(socket, state, path) {
    if (!this.portalInstalled()) {
      const html =
        '<!doctype html><meta charset="utf-8"><title>Web Capture</title><body style="font:15px system-ui;background:#111;color:#eee;padding:40px;max-width:640px">' +
        "<h1>Web Capture portal not unpacked yet</h1><p>Unzip <code>WebCapture.lspkg/ExtractAtProjectRoot/WebCapturePortal.zip</code> <b>at the project root</b>, next to <code>Assets/</code>, so that <code>" +
        this.portalDir().replace(/</g, "&lt;") +
        "/index.html</code> exists. Then reload this page.</p>" +
        '<p>The API is already running: <a style="color:#7cf" href="/api/status">/api/status</a>.</p></body>';
      return this.finish(socket, state, 200, "text/html; charset=utf-8", html);
    }
    let rel = path === "/" ? "/index.html" : path;
    if (rel.indexOf("..") >= 0 || rel.indexOf("\\") >= 0)
      return this.finish(socket, state, 400, "text/plain", "Bad path");
    const file = new Editor.Path(this.portalDir() + rel);
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
        "Access-Control-Allow-Methods: GET, PUT, POST, DELETE, OPTIONS",
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
