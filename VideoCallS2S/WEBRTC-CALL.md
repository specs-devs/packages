# Video Call S2S — the WebRTC call path

How two SPECS talk to each other, what runs natively, and how to test it.

## Topology

```
   SPECS A (caller)                                          SPECS B (callee)
   ┌──────────────────────┐                                  ┌──────────────────────┐
   │ VideoCallS2SManager  │   ring / accept / decline /      │ VideoCallS2SManager  │
   │ RtcMailbox ──────────┼──── busy / bye · SDP / ICE ──────┼────────── RtcMailbox │
   │ WebRTCSession        │   (rows in Snap Cloud            │        WebRTCSession │
   │  role = caller       │    `rtc_signals`, PostgREST)     │       role = callee  │
   │ libVideoCallS2S      │                                  │      libVideoCallS2S │
   │ WebRTCModule.so ─────┼══ ONE PeerConnection (P2P) ══════┼═ WebRTCModule.so     │
   │  camera H.264 + mic  │   video sendrecv + audio sendrecv│  camera H.264 + mic  │
   └──────────────────────┘   RTP/SRTP, STUN (no TURN)       └──────────────────────┘
```

* **Pairing.** Each Lens run picks a 4-digit code and shows it on the home
  screen. The caller types the callee's code. Both peers use the mailbox session
  `s2s-<callee code>` and tag their rows with their own code as `sender`.
* **Handshake.** Caller inserts `ring`. Callee's inbox (polled every 1.5 s while
  idle) shows the ACCEPT / DENY dialog and replies `accept`, `decline`, or `busy`.
  Either side ends the call with `bye`.
* **Media.** On `accept` both sides start `CallStreamer` → `WebRTCSession`. The
  caller creates the native session as **offerer**, the callee as **answerer**.
  The offer / answer / ICE candidates ride the same mailbox (`kind = pov`),
  polled every 0.4 s during a call. Media is peer-to-peer and never touches the
  cloud.
* **Audio lifecycle.** Native first: echo-cancelled `VOICE_CALL` mic capture and
  pull-mode speaker playback start once the session connects, under one shared
  `AUDIO_IN_OUT` focus. The JS microphone / Audio Output paths are fallbacks that
  engage only if the native ones fail — never a retry loop.
  **Speaker-first ordering matters.** The mic and speaker device opens run on
  detached native threads and race; opening the `VOICE_CALL` mic before the
  speaker binds flips the device into communication audio mode and routes the
  speaker to the silent voice-call output — the answerer "can't hear the other
  side" bug (2026-09-09). `CallStreamer.manageNativeMic` holds the mic until
  `nativeSpeakerState() === 2`, bounded by `NATIVE_MIC_WAIT_SPEAKER_S` (1.5 s) so
  a slow/failed speaker never mutes this side.

## The native module (`VideoCallS2SWebRTCModule/`)

`libVideoCallS2SWebRTCModule.so` embeds the SpecsWebRTC engine (libdatachannel +
Opus, C ABI in `SpecsWebRTC/`) and exposes it to the Lens through the SpecsNDK
CoreJs ABI. Session kind 0 (`pov`) is the whole call:

| JS export | What it does |
|---|---|
| `rtcCreate(0, kbps, fps, maxWidth, ice, maxQp, role)` | Create the duplex session. `role` 0 = offerer (caller, offer generated immediately), 1 = answerer (callee, waits for the offer). |
| `rtcSetRemoteDescription(0, type, sdp)` | Apply the peer's SDP. `type` 0 = offer (the answer is generated and queued), 1 = answer. |
| `rtcAddRemoteCandidate` / `rtcPollSignal(0)` | ICE in / signaling out (JSON `{"t":"offer"|"answer"|"cand", …}`). |
| `rtcEnsureCamera`, `rtcSetBitrate` | Camera grab once connected; live H.264 bitrate. |
| `rtcMicStart/Stop/State/Frames` | Native echo-cancelled mic → Opus. |
| `rtcSpeakerStart/Stop/State/Diag` | Native speaker for the friend's voice. |
| `rtcPollAudio`, `rtcSendAudio` | JS fallbacks for voice in / mic out. |
| `pullInboundFrame(buffer)` | Newest decoded friend-camera frame as RGBA (HW decode). |
| `ping()` | Module generation. **3** = this build (answerer role + duplex audio); 2 = the older phone-call build, which the Lens refuses with a caption. |

### Why the engine changed for SPECS ↔ SPECS

The previous build only ever *offered* the camera session and received voice
on a separate audio-only session offered by a phone. Two identical devices
need one of them to answer, and both need to hear each other on the same
connection. Two engine changes make that work (`SpecsWebRTC/src/specs_webrtc.cpp`):

1. **Manual answerer with pre-declared tracks.** The answerer creates the same
   `video` / `audio` sendrecv m-lines up front and never calls
   `swrtc_create_offer`. libdatachannel matches the caller's m-lines to the
   local tracks by mid and keeps the local descriptions, so the generated
   answer is symmetric (`processRemoteDescription` → existing track kept).
2. **Duplex audio (`swrtc_config.audio_duplex`).** The audio track is
   `sendrecv`; because the C API has no chainable Opus depacketizer, inbound
   RTP is taken from the track message callback, the RTP header is stripped
   (`on_audio_rtp_tramp`), and the payload is fed to the existing reordering
   jitter buffer + Opus PLC path.

The module side (`VideoCallS2SWebRTCModule.cpp`) adds the `role` argument,
sets `audio_duplex` + `on_audio_frame` on the pov session, drains voice from
whichever slot has PCM, stops the native speaker when the pov slot is torn
down, and reports generation 3.

## Build

See the [native development section of the README](README.md#native-development-specsndk).
Short version:

```bash
export SPECSNDK_ROOT=/path/to/SpecsNDK
export SPECS_WEBRTC_THIRD_PARTY=/path/to/third_party   # opus + patched libdatachannel archives
bash VideoCallS2SWebRTCModule/build.sh "$SPECSNDK_ROOT"
```

The script drops the `.so` into `Assets/VideoCallS2S.lspkg/Modules/`. Re-send
the Lens to both devices afterwards.

### Permissions — why `INTERNET` must be in the module

SnapOS grants network access per Lens through an eBPF socket filter: without
`INTERNET` in the manifest every `socket(AF_INET, …)` fails with `EACCES`, so
libdatachannel gathers no ICE candidates and the call can never connect. The
Lens logs the verdict at start — `UDP egress probe -> N (OK)` or
`-> -1013 (BLOCKED …)` (−1000 − errno 13). Lens Studio fills the native asset's
`Permissions:` from the `.so`'s `.snap.permissions` section on every import, so
`build.sh` embeds `INTERNET` there (`embed_permissions.py`) — the NDK's own
embed step only covers annotated Specs APIs, not raw sockets. Verify with
`llvm-readelf -p .snap.permissions` on the `.so` and `Permissions:` in its `.meta`.

## On-device test plan

The engine changes above compile and are wired end to end, but they have
**not yet been exercised on hardware** — run this first.

0. `libVideoCallS2SWebRTCModule.so.meta` lists `Permissions: - INTERNET` (see
   Permissions above) and the assigned Snap Cloud project has the `rtc_signals`
   table — the Snap Cloud Setup plugin creates it when the project is opened in
   Lens Studio; the home screen says *Snap Cloud schema missing* otherwise.
   **Both dev units need Transparent Permissions enabled**, or SnapOS rolls the
   install back (`TAINT VIOLATION … Transparent Permissions disabled` in
   `journalctl`, `PkgManagerError: Failed to set up permissions` in Specs Tools):
   microphone + INTERNET is a sensor-plus-connectivity combination that the OS
   only grants through the wearer's consent prompt. Run
   `bash scripts/specs_enable_transparent_permissions.sh` with each pair on the
   cable, then tap **Allow** on the glasses when the Lens asks for microphone +
   internet (a denial is remembered).
1. Two SPECS on the **same Wi-Fi or hotspot** (STUN only, no TURN: corporate
   NAT blocks the media legs). Same Snap Cloud project assigned on both.
2. Both Lenses open → each shows a code and `Ready · share your code…`.
3. On A type B's code → CALL FRIEND. B gets the dialog within ~2 s → ACCEPT.
4. Expected log sequence on both (`[S2S-RTC]`): `Session started as caller|callee`
   → out `offer` (A) / `Offer applied … answering` (B) → `Answer applied` (A) →
   candidates both ways → `call session CONNECTED`.
5. Expected caption: `CALL WITH <code> · rtc ✓` then `mic native ✓ · spk native ✓ · friend cam N frames`.
6. Both see each other's camera and hear each other. HANG UP on either side
   returns both to the home screen.

If a step fails, the per-2-second `diag` rows in `rtc_signals` (`kind = 'diag'`)
show each side's state (`st`), candidate counts, frames pulled, mic / speaker
states — readable from the Snap Cloud dashboard without a USB tether.

Known gaps: no TURN relay (LAN only); pairing codes are unauthenticated
(prototype RLS policy); one call at a time per device.
