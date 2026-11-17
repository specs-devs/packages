# Decart on SPECS — the native WebRTC pipeline

How a **true on-device WebRTC** path to Decart would work, versus the Mac bridge
this project ships with today. This is the "cut the leash and the JPEG hop"
design — grounded in the `libSpecsWebRTC` engine supplied with the package.
For current setup, see [Native development (SpecsNDK)](README.md#native-development-specsndk).

---

## Two pipelines, side by side

### A. What ships today — the Mac bridge (WebSocket + JPEG)

```
SPECS ──JPEG @~10fps over WebSocket──▶ bridge.py (Mac) ──WebRTC/LiveKit──▶ Decart Lucy 2.5
SPECS ◀──JPEG over WebSocket──────────  bridge.py     ◀──WebRTC track──────  (transformed 720p30)
```

- WebRTC exists, but **on the Mac**, not the glasses. The Lens speaks plain WebSocket.
- Every frame is **JPEG-encoded twice** (device→bridge, bridge→device) and re-muxed.
- **Leashed:** needs the Mac on, same LAN, bridge running.
- Latency: sub-second, but the double JPEG + Wi-Fi + Mac relay all add up.

### B. Native on-device — WebRTC straight from the glasses

```
SPECS  ──H.265 (RTP/SRTP) over WebRTC──────────────▶  Decart realtime edge
SPECS  ◀──H.264/H.265 track (RTP/SRTP) over WebRTC──  (transformed video)
       ⟵ prompt / control over the signaling channel ⟶
```

- No Mac, no bridge, no JPEG. The glasses are a **WebRTC peer** talking to Decart directly.
- Camera frames are **hardware-encoded** (H.265 via SpecsMediaCodec) and sent as RTP.
- Return track is decoded on-device and drawn into the Lens display texture.
- **Untethered:** works anywhere the glasses have internet (LAN, Wi-Fi, tethered).
- Lowest latency: one encode, one network hop, one decode.

The whole reason today's build uses a bridge is that **the Lens scripting runtime
has no WebRTC** — no `RTCPeerConnection`, only WebSocket + `fetch`. Pipeline B
moves WebRTC into a **native module** (C/C++ over the CoreJs ABI), which is
exactly what `libSpecsWebRTC` already is.

---

## The native pipeline in detail

```
┌────────────────────────── SPECS device ──────────────────────────┐
│  CameraModule (Right_Color)  ──raw NV12/RGBA frame──┐             │
│                                                     ▼             │
│  Lens TS ──CoreJs ABI──▶  libSpecsWebRTC (native, aarch64)        │
│     • startSession(endpoint, apiKey, model, prompt)               │
│     • pushFrame(frame)   ─▶ HW H.265 encode ─▶ RTP/SRTP ─▶─────────┼──▶ Decart
│     • setPrompt(text)    ─▶ signaling control message ────────────┼──▶
│                                                                   │
│  display texture ◀─ RGBA ◀─ HW decode ◀─ RTP/SRTP track ◀─────────┼──◀ Decart
│     (drawn on the head-locked quad)                               │
└───────────────────────────────────────────────────────────────────┘
```

### 1. Signaling — connect to Decart

Decart's realtime service is WebRTC for media + a **signaling channel** for SDP,
ICE, and prompts. Using the **WS Signaling** path (raw, no LiveKit SDK required —
what libdatachannel can speak):

```
Client → Decart   {"type":"offer","sdp":"v=0..."}
                  {"type":"ice-candidate","candidate":{...}}
                  {"type":"prompt","prompt":"watercolor world","enhance_prompt":true}
Decart → Client   {"type":"answer","sdp":"v=0..."}
                  {"type":"session_id","session_id":"...","server_ip":"...","server_port":N}
                  {"type":"prompt_ack","success":true}
                  {"type":"generation_started"} / {"type":"generation_tick","seconds":N}
```

Endpoint: `wss://api3.decart.ai/v1/stream?api_key=<key>&model=lucy-2.5`
(mint a short-lived client token server-side; don't ship the permanent `dct_` key on-device).

### 2. Media — send camera, receive transformed

- **Uplink:** `CameraModule` frame → native `pushFrame` → `swrtc_send_video_raw(SWRTC_PIXFMT_NV12, …)` → HW H.265 encode → RTP.
- **Downlink:** Decart's transformed RTP track → H.264/H.265 Annex-B in the native lib → **on-device HW decode** → RGBA → written into a Lens `Texture` the display quad samples.

### 3. Control — prompt updates

`setPrompt(text)` sends `{"type":"prompt",…}` on the same signaling channel mid-session —
identical UX to today's UI, but the message rides WebRTC signaling instead of the bridge WebSocket.

---

## Mapping onto `libSpecsWebRTC` — what exists vs. what's new

The engine (`SpecsWebRTC/include/specs_webrtc.h`) is a C ABI over libdatachannel
(ICE / DTLS-SRTP / RTP) with HW H.264/H.265 encode on device and Opus both ways.

| Piece | Status | Notes |
|---|---|---|
| ICE / DTLS-SRTP / RTP transport | ✅ exists | libdatachannel, both platforms |
| HW **H.265 encode** of camera frames | ✅ exists (device) | `swrtc_send_video_raw`, `SpecsMediaCodec` |
| `swrtc_send_video_raw(NV12/RGBA)` entry point | ✅ exists | feed `CameraModule` frames straight in |
| CoreJs native-module bridge to the Lens | ✅ exists | `WebRTCStreamModule` pattern (`webrtcStart/Stop/State`) |
| **Signaling: Decart `/v1/stream` WS dialect** | ⚠️ new | today's lib has *built-in TCP* signaling (device→Mac). Swap in a WS client speaking Decart's `offer/answer/ice-candidate/prompt` JSON |
| **Bidirectional session** (send *and* receive a track) | ⚠️ extend | current demo is one-way send device→Mac; Decart needs duplex |
| **On-device video decode → Lens texture** | ⚠️ new / hardest | current lib delivers H.264 Annex-B for the *Mac* to decode (VideoToolbox). On-device you need a HW decoder path and a frame→`Texture` upload the Lens can sample |
| Client-token minting | ⚠️ new | small server endpoint; keep `dct_` key off-device |

**Reuse:** transport, encode, and the JS↔native bridge are done.
**Build:** the Decart-specific signaling client, duplex session wiring, and — the
real work — the on-device decode-into-a-texture path.

---

## Is it worth it?

| | Mac bridge (today) | Native WebRTC (B) |
|---|---|---|
| Works now | ✅ | ✗ (needs native work) |
| Untethered / mobile | ✗ (needs Mac + LAN) | ✅ (internet only) |
| Latency | good | best |
| Image quality | JPEG-degraded twice | single HW codec |
| Effort | zero (built) | native C++ + decode-to-texture |

**Use the bridge** for reels and demos at a desk — it's built and it works.
**Invest in native WebRTC** when you need untethered capture, lowest latency, or
a shippable Lens that doesn't depend on a laptop. The 70% that's transport +
encode + JS bridge already exists in `libSpecsWebRTC`; the gating item is
**decoding Decart's return track into a Lens texture on-device**.

> Cross-network caveat (both paths): Decart is reached over the public internet,
> so no LAN issue there. The bridge's *LAN* constraint is only between the glasses
> and your Mac — the native path removes it entirely.
