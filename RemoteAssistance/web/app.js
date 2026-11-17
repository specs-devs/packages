// Remote Assistance helper portal — the browser end of the Glasses call.
//
// Speaks the exact wire protocol of the Lens (see ../DRAWING.md and
// Scripts/App/Types.ts): signaling + drawing ride the Snap Cloud `rtc_signals`
// table over PostgREST; media is peer-to-peer WebRTC.
//
//   pov   — the GLASSES OFFERS (camera H.264 + mic Opus, duplex video). We
//           answer: we receive the POV video + wearer audio, and optionally
//           send our webcam back on the same session.
//   voice — WE OFFER our microphone (Opus); the Glasses answers and plays it.
//   draw  — cumulative stroke rows (JSON in `sdp`) — what the wearer sees as
//           3D lines. Clears flow both ways.
//   bye   — hangup, either direction.
//
// Sender ids: we are "phoneB" (kept from the phone era for wire
// compatibility); the Glasses is "glasses".

"use strict";

const SENDER_ME = "phoneB";
const SENDER_GLASSES = "glasses";
const POLL_MS = 400;              // mirrors the Lens's RtcMailbox cadence
const STROKE_SEND_MS = 300;       // cumulative stroke updates while drawing
const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
const PALETTE = ["#ff5940", "#ffd23e", "#59ff8a", "#40c8ff", "#e879ff", "#ffffff"];

// ── State ────────────────────────────────────────────────────────────────
const S = {
  url: "", key: "", session: "",
  cursor: 0, staleBoundary: 0, polling: false, pollTimer: 0,
  povPc: null, voicePc: null,
  povCandBuffer: [],              // glasses pov cands that arrive before the offer
  micStream: null, camStream: null, micMuted: false,
  strokes: [],                    // local overlay: {id, color, w, pts:[u,v,...], done}
  liveStroke: null, strokeSeq: 0, lastStrokeSend: 0,
  videoUp: false, ended: false,
};

const $ = (id) => document.getElementById(id);
const statusEl = $("status");

// ── Mailbox: PostgREST over fetch ────────────────────────────────────────

function sbHeaders() {
  return {
    "apikey": S.key,
    "Authorization": "Bearer " + S.key,
    "Content-Type": "application/json",
  };
}

async function sbInsert(row) {
  const res = await fetch(S.url + "/rest/v1/rtc_signals", {
    method: "POST",
    headers: { ...sbHeaders(), "Prefer": "return=minimal" },
    body: JSON.stringify(row),
  });
  if (!res.ok) console.warn("[mailbox] insert failed:", res.status, await res.text());
}

function sendSignal(kind, payload) {
  return sbInsert({
    session: S.session, kind, sender: SENDER_ME,
    t: payload.t, sdp: payload.sdp ?? null,
    cand: payload.cand ?? null, mid: payload.mid ?? null,
  });
}

async function sbSelect(query) {
  const res = await fetch(S.url + "/rest/v1/rtc_signals?" + query, { headers: sbHeaders() });
  if (!res.ok) throw new Error("select failed: " + res.status + " " + (await res.text()));
  return res.json();
}

// Like the Lens's RtcMailbox: replay all signaling for the session (the Glasses
// may have offered before we joined), but record the newest pre-existing row
// id as a boundary so a "bye" from a PREVIOUS call in the same session does
// not end this one.
async function mailboxConnect() {
  const newest = await sbSelect(
    `session=eq.${encodeURIComponent(S.session)}&select=id&order=id.desc&limit=1`);
  S.staleBoundary = newest.length ? newest[0].id : 0;
  S.cursor = 0;
  S.pollTimer = setInterval(mailboxPoll, POLL_MS);
}

async function mailboxPoll() {
  if (S.polling || S.ended) return;
  S.polling = true;
  try {
    const rows = await sbSelect(
      `session=eq.${encodeURIComponent(S.session)}&sender=neq.${SENDER_ME}` +
      `&id=gt.${S.cursor}&order=id.asc&limit=50&select=*`);
    for (const r of rows) {
      if (typeof r.id === "number" && r.id > S.cursor) S.cursor = r.id;
      if (r.kind === "bye" && r.id <= S.staleBoundary) continue; // previous call
      handleRow(r);
    }
  } catch (e) {
    console.warn("[mailbox] poll:", e.message);
  } finally {
    S.polling = false;
  }
}

function handleRow(r) {
  if (r.sender !== SENDER_GLASSES) return;
  const p = { t: r.t, sdp: r.sdp ?? undefined, cand: r.cand ?? undefined, mid: r.mid ?? undefined };
  if (r.kind === "pov") onPovSignal(p);
  else if (r.kind === "voice") onVoiceSignal(p);
  else if (r.kind === "draw") onDrawSignal(p);
  else if (r.kind === "bye") endCall(false);
  // "diag" and anything else: ignore.
}

// ── pov: answer the Glasses' offer (recv POV video + wearer audio) ─────────

async function onPovSignal(p) {
  if (p.t === "offer" && p.sdp) {
    // Every offer gets a FRESH answering PC — the Glasses re-offers with fresh
    // ICE whenever the session isn't connected (15 s retry loop).
    if (S.povPc) { try { S.povPc.close(); } catch (_) {} }
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    S.povPc = pc;
    pc.ontrack = (ev) => {
      const video = $("pov");
      if (video.srcObject !== ev.streams[0]) video.srcObject = ev.streams[0];
      if (ev.track.kind === "video") {
        S.videoUp = true;
        $("waiting").style.display = "none";
      }
    };
    pc.onicecandidate = (ev) => {
      if (ev.candidate && ev.candidate.candidate) {
        sendSignal("pov", { t: "cand", cand: ev.candidate.candidate, mid: ev.candidate.sdpMid ?? "" });
      }
    };
    pc.onconnectionstatechange = updateStatus;
    await pc.setRemoteDescription({ type: "offer", sdp: p.sdp });
    // Optional return video: ride the duplex pov session's video m-line.
    if (S.camStream) {
      for (const track of S.camStream.getVideoTracks()) pc.addTrack(track, S.camStream);
    }
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sendSignal("pov", { t: "answer", sdp: answer.sdp });
    // Candidates that raced ahead of the offer row.
    for (const c of S.povCandBuffer) addCand(pc, c);
    S.povCandBuffer = [];
    console.log("[pov] answered offer");
  } else if (p.t === "cand" && p.cand) {
    if (S.povPc && S.povPc.remoteDescription) addCand(S.povPc, p);
    else S.povCandBuffer.push(p);
  }
}

function addCand(pc, p) {
  pc.addIceCandidate(new RTCIceCandidate({ candidate: p.cand, sdpMid: p.mid || "0" }))
    .catch((e) => console.warn("[ice]", e.message));
}

// ── voice: offer our microphone; the Glasses answers ───────────────────────

async function startVoice() {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  S.voicePc = pc;
  for (const track of S.micStream.getAudioTracks()) pc.addTrack(track, S.micStream);
  pc.onicecandidate = (ev) => {
    if (ev.candidate && ev.candidate.candidate) {
      sendSignal("voice", { t: "cand", cand: ev.candidate.candidate, mid: ev.candidate.sdpMid ?? "" });
    }
  };
  pc.onconnectionstatechange = () => {
    updateStatus();
    // The Glasses creates a fresh answering session per offer — if our leg
    // dies, re-offer (mirrors the phone app's behaviour).
    if (!S.ended && (pc.connectionState === "failed" || pc.connectionState === "closed")) {
      setTimeout(() => { if (S.voicePc === pc && !S.ended) startVoice(); }, 2000);
    }
  };
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  sendSignal("voice", { t: "offer", sdp: offer.sdp });
  console.log("[voice] offered mic");
}

function onVoiceSignal(p) {
  if (p.t === "answer" && p.sdp && S.voicePc) {
    S.voicePc.setRemoteDescription({ type: "answer", sdp: p.sdp })
      .catch((e) => console.warn("[voice]", e.message));
  } else if (p.t === "cand" && p.cand && S.voicePc) {
    addCand(S.voicePc, p);
  }
}

// ── Drawing: canvas overlay → cumulative stroke rows (DRAWING.md) ────────

let activeColor = PALETTE[0];
const overlay = $("overlay");
const ctx = overlay.getContext("2d");

// Map a pointer event to VIDEO-FRAME coords (u right, v down, 0..1),
// correcting for the object-fit:contain letterbox.
function toFrameCoords(ev) {
  const video = $("pov");
  const box = overlay.getBoundingClientRect();
  const vw = video.videoWidth || 4, vh = video.videoHeight || 3;
  const scale = Math.min(box.width / vw, box.height / vh);
  const dw = vw * scale, dh = vh * scale;
  const ox = (box.width - dw) / 2, oy = (box.height - dh) / 2;
  const u = (ev.clientX - box.left - ox) / dw;
  const v = (ev.clientY - box.top - oy) / dh;
  return { u: Math.min(1, Math.max(0, u)), v: Math.min(1, Math.max(0, v)) };
}

function hexToRgb01(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}

overlay.addEventListener("pointerdown", (ev) => {
  if (!S.videoUp) return;
  overlay.setPointerCapture(ev.pointerId);
  const { u, v } = toFrameCoords(ev);
  S.strokeSeq += 1;
  S.liveStroke = { id: "w" + S.strokeSeq, color: activeColor, pts: [u, v], done: false };
  S.strokes.push(S.liveStroke);
  redraw();
});
overlay.addEventListener("pointermove", (ev) => {
  if (!S.liveStroke) return;
  const { u, v } = toFrameCoords(ev);
  const pts = S.liveStroke.pts;
  const du = u - pts[pts.length - 2], dv = v - pts[pts.length - 1];
  if (du * du + dv * dv < 0.00002) return; // decimate
  pts.push(u, v);
  redraw();
  const now = performance.now();
  if (now - S.lastStrokeSend > STROKE_SEND_MS) {
    S.lastStrokeSend = now;
    sendStroke(S.liveStroke, false);
  }
});
function finishStroke() {
  if (!S.liveStroke) return;
  S.liveStroke.done = true;
  sendStroke(S.liveStroke, true);
  S.liveStroke = null;
}
overlay.addEventListener("pointerup", finishStroke);
overlay.addEventListener("pointercancel", finishStroke);

function sendStroke(stroke, done) {
  const video = $("pov");
  const ar = (video.videoWidth && video.videoHeight)
    ? video.videoWidth / video.videoHeight : 4 / 3;
  sendSignal("draw", {
    t: "stroke",
    sdp: JSON.stringify({
      id: stroke.id,
      color: hexToRgb01(stroke.color),
      ar: Math.round(ar * 1000) / 1000,
      done,
      pts: stroke.pts.map((x) => Math.round(x * 10000) / 10000),
    }),
  });
}

function onDrawSignal(p) {
  if (p.t !== "clear") return; // the Glasses only ever sends clears
  let scope = {};
  try { scope = p.sdp ? JSON.parse(p.sdp) : {}; } catch (_) {}
  if (scope.id) S.strokes = S.strokes.filter((s) => s.id !== scope.id);
  else S.strokes = [];
  S.liveStroke = null;
  redraw();
}

function redraw() {
  const box = overlay.getBoundingClientRect();
  if (overlay.width !== box.width || overlay.height !== box.height) {
    overlay.width = box.width; overlay.height = box.height;
  }
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  const video = $("pov");
  const vw = video.videoWidth || 4, vh = video.videoHeight || 3;
  const scale = Math.min(overlay.width / vw, overlay.height / vh);
  const dw = vw * scale, dh = vh * scale;
  const ox = (overlay.width - dw) / 2, oy = (overlay.height - dh) / 2;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const s of S.strokes) {
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = Math.max(2, dh * 0.008);
    const pts = s.pts;
    if (pts.length === 2) {
      ctx.beginPath();
      ctx.arc(ox + pts[0] * dw, oy + pts[1] * dh, ctx.lineWidth, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(ox + pts[0] * dw, oy + pts[1] * dh);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(ox + pts[i] * dw, oy + pts[i + 1] * dh);
    ctx.stroke();
  }
}

// ── UI wiring ─────────────────────────────────────────────────────────────

function buildPalette() {
  const holder = $("palette");
  for (const c of PALETTE) {
    const b = document.createElement("button");
    b.className = "swatch" + (c === activeColor ? " active" : "");
    b.style.background = c;
    b.onclick = () => {
      activeColor = c;
      holder.querySelectorAll(".swatch").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
    };
    holder.appendChild(b);
  }
}

function updateStatus() {
  if (S.ended) { statusEl.textContent = "call ended"; return; }
  const st = (pc) => (pc ? pc.connectionState : "—");
  statusEl.textContent =
    `pov ${st(S.povPc)} · voice ${st(S.voicePc)} · ` +
    `${S.strokes.length} stroke(s) · session ${S.session}`;
}
setInterval(updateStatus, 1000);

$("clearBtn").onclick = () => {
  S.strokes = []; S.liveStroke = null; redraw();
  sendSignal("draw", { t: "clear", sdp: JSON.stringify({ scope: "all" }) });
};
$("undoBtn").onclick = () => {
  const last = S.strokes.pop();
  redraw();
  if (last) sendSignal("draw", { t: "clear", sdp: JSON.stringify({ id: last.id }) });
};
$("muteBtn").onclick = () => {
  S.micMuted = !S.micMuted;
  if (S.micStream) S.micStream.getAudioTracks().forEach((t) => (t.enabled = !S.micMuted));
  $("muteBtn").textContent = S.micMuted ? "Unmute" : "Mute";
};
$("endBtn").onclick = () => endCall(true);

function endCall(sendBye) {
  if (S.ended) return;
  S.ended = true;
  if (sendBye) sendSignal("bye", { t: "bye" });
  clearInterval(S.pollTimer);
  for (const pc of [S.povPc, S.voicePc]) { try { pc && pc.close(); } catch (_) {} }
  for (const st of [S.micStream, S.camStream]) st && st.getTracks().forEach((t) => t.stop());
  statusEl.textContent = "call ended" + (sendBye ? "" : " (by the wearer)");
  $("waiting").textContent = "call ended — reload to join again";
  $("waiting").style.display = "flex";
}

$("joinBtn").onclick = async () => {
  const err = $("joinErr");
  err.textContent = "";
  S.url = $("sbUrl").value.trim().replace(/\/+$/, "");
  S.key = $("sbKey").value.trim();
  S.session = $("sessCode").value.trim();
  if (!S.url || !S.key || !S.session) { err.textContent = "All three fields are required."; return; }
  try {
    // Mic is required (it IS the assistance voice); webcam is optional.
    S.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if ($("sendCam").checked) {
      try { S.camStream = await navigator.mediaDevices.getUserMedia({ video: true }); }
      catch (_) { console.warn("webcam unavailable — continuing without return video"); }
    }
    await mailboxConnect();
  } catch (e) {
    err.textContent = e.message;
    return;
  }
  localStorage.setItem("ra_sb_url", S.url);
  localStorage.setItem("ra_sb_key", S.key);
  $("join").style.display = "none";
  $("call").style.display = "flex";
  buildPalette();
  startVoice();
  updateStatus();
  window.addEventListener("resize", redraw);
};

// Prefill the Snap Cloud fields from the last session (this machine only).
$("sbUrl").value = localStorage.getItem("ra_sb_url") || "";
$("sbKey").value = localStorage.getItem("ra_sb_key") || "";
