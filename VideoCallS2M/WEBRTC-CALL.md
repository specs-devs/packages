# VideoCallS2M WebRTC Call Path

> **v6 (2026-08-10): native-first audio — XR-AI parity** (lens tag
> `v12-native-audio`, module rebuild required — done on this machine; the Lens
> must be RE-SENT to the device). Root-caused that day's total outbound
> silence to a kernel-level capture failure (`pal_stream_start` → `-ENODEV`
> after a battery-brownout boot; playback unaffected) — no code can fix that
> state, but it reshaped the reliability policy. Changes, mirroring the
> stable XR-AI-Lens design:
>
> 1. **ONE shared AUDIO_IN_OUT focus session** (HIGH priority) now brackets
>    both audio devices — acquired before either opens, released after both
>    stop (`setFocusInterest` in the module). `NATIVE_MIC_USE_FOCUS` defaults
>    **true**: the platform coordinator arbitrates duplex mic+speaker instead
>    of leaving both streams unfocused and preemptible.
> 2. **Native friend-voice speaker enabled** (`rtcSpeakerStart/Stop/State`):
>    decoded Opus PCM flows decode-thread → 300 ms-primed pull-mode
>    SpecsAudioPlayback ring — no JS bridge, immune to lens fps. Started from
>    JS on voice connect on a detached worker (the 2026-08-06 crash was a
>    start inside the decode callback — never do that). While ACTIVE,
>    `rtcPollAudio` runs dry; on failure the JS AudioOutput fallback keeps
>    receiving PCM automatically (caption shows `spk: js`).
> 3. **No more audio-device churn.** The JS mic no longer opens at call start
>    — the native VOICE_CALL mic gets ONE attempt per pov connection; any
>    failure (open rejected/failed, stuck starting, stall) opens the JS
>    fallback ONCE and latches until the pov leg reconnects. The JS fallback's
>    dead-air recovery is one restart, then a caption warning. Rationale:
>    repeated opens at a sick audio service wedge the whole stack (observed
>    2026-08-07), and a dead capture DSP (-ENODEV, 2026-08-10) makes every
>    retry pointless.
> 4. **Diag rows now carry the outbound-audio truth**: `sent` (JS chunks),
>    `spkSt` (native speaker state), `micStrikes` (lifetime failures) join
>    `mic`/`micF`/`arx` — the 2026-08-10 diagnosis had to guess JS-path
>    liveness from the LS log.
>
> Debug workflow that found all this (keep using it): `adb -s <serial>_app
> shell journalctl -f` streams the device journal incl. the audio HAL (the
> LS log never sees native stderr); `pactl list sources short` shows capture
> sources; the `rtc_signals` table holds per-2s diag rows from both peers.

> **v5 (2026-08-07): SPECS → phone audio reliability pass** (lens tag
> `v8-aud-fec-pace`, module rebuild required — done on this machine). The
> SPECS→phone voice leg was unreliable while phone→SPECS was fine; the fixes
> attack the three causes found:
>
> 1. **Video bursts starved audio on the shared pov socket.** The engine sent
>    each H.264 access unit's RTP packets back-to-back (a keyframe = 40-150 ms
>    of wire time), queuing the 20 ms Opus packets behind it — no congestion
>    control. Now `rtcChainPacingHandler` (libdatachannel) drains the video
>    track at 2× the nominal bitrate in 5 ms slices (`specs_webrtc.cpp`,
>    `setup_video_send_track`), so audio interleaves.
> 2. **Native mic had no recovery.** One failed `rtcMicStart` permanently
>    doomed the call to the JS fallback, and a record stream that opened but
>    silently died was invisible (state stayed 2). New: `rtcMicFrames()`
>    export + a JS stall watchdog (3 s frozen counter ⇒ restart), bounded
>    retries (3 strikes, 10 s cooldown) instead of the one-shot fallback
>    (`CallStreamer.manageNativeMic`). Diag rows now carry `micF` (frame
>    counter) + `micStrikes`.
> 3. **The JS fallback was bursty and loss-fragile.** Chunks shrank 0.3 s →
>    60 ms (3-packet bursts instead of 15 — the phone's NetEQ stops
>    time-warping speech), and the Opus encoder now runs VOIP mode with
>    in-band FEC (`OPUS_SET_INBAND_FEC` + 15 % expected loss), which the
>    already-offered `useinbandfec=1` fmtp lets the phone consume — a lost
>    packet is rebuilt, not concealed.
>
> **v4 (2026-07-21): Call Friend is now WebRTC-ONLY and uses NO Snap Cloud.**
> The Supabase Realtime backend stopped answering channel joins on device
> (auth succeeds, `phx_join` gets no reply, 10 s timeout → CLOSED loop — a
> server-side regression, see the journal analysis), which killed *both* the
> WebRTC signaling and the JPEG/WAV fallback (both rode that one channel). So
> the call was rearchitected: **the SDP/ICE signaling now rides the existing
> Mobile Kit → phoneA → Multipeer → phoneB relay** (the same path that carries
> control messages), and the JPEG/WAV fallback has been removed from the call.
> Media is still peer-to-peer WebRTC. The `callTransport` inspector switch is
> gone (there's nothing to switch between anymore).
>
> **Scope:** SPECS POV → friend's phone (video) and two-way voice are WebRTC
> and work. Friend's camera → SPECS (the wearer seeing the friend) needs
> on-device H.264 decode-to-texture and is **not built yet** (phase 2) — the
> SPECS call panel shows the WebRTC link + mic status, no remote video.

Call Friend runs on real WebRTC: **H.264 hardware encode + Opus over RTP/SRTP**,
peer-to-peer between the SPECS and the friend's iPhone. Signaling (SDP/ICE) is
relayed over the phone link; the media never touches any server.

## Signaling transport (v4 — the phone relay, no cloud)

`VideoCallS2MWebRTCSession` depends only on the `RtcSignalTransport` interface
(`VideoCallS2MTypes.ts`). `PhoneLink` implements it over Mobile Kit:

- **SPECS → phone:** `session.sendData({type:"rtc",kind,from:"glasses",sig})` →
  arrives on iOS as a `.notify` (`MobileKitModel.receivedRtc`) → phoneA relays
  it to phoneB over Multipeer (`sendRaw`) → `WebRTCCallManager.handleRelaySignal`.
- **phone → SPECS:** phoneB's `WebRTCCallManager.sendSignalRelay` → Multipeer →
  phoneA → `MobileKitModel.sendRtcToGlasses` (yields into the new `"rtc"` Mobile
  Kit subscription) → `PhoneLink`'s `"rtc"` subscription → `VideoCallS2MWebRTCSession`.

phoneA vs phoneB is decided by `mobileKitModel.isConnected` (only the bonded
phone has a live SPECS session). No infinite loop: each hop either forwards
onward or is consumed at its endpoint.

## What changed

| Leg | Before (fallback, still present) | Now (preferred) |
|---|---|---|
| SPECS POV → phone | base64 JPEG q65 480px ~11 fps over Realtime | H.264 @ 2.5 Mbps, 640px, 24 fps over RTP |
| SPECS mic → phone | 0.3 s WAV chunks, ~1.2 s jitter buffer | Opus 20 ms frames; phone plays via libwebrtc **with echo cancellation** |
| Friend voice → SPECS | 0.5 s WAV chunks, 1.2 s buffer | Opus over RTP → native decode → 0.5 s buffer |
| Phone camera → SPECS | JPEG over Realtime (unchanged) | unchanged — SPECS has no H.264 decode path yet (phase 2) |

Architecture:

- **SpecsWebRTC engine, compiled in** — the reusable engine in
  `VideoCallS2MWebRTCModule/SpecsWebRTC/` (libdatachannel + libopus +
  SpecsMediaCodec hardware encode) is compiled **into**
  `libVideoCallS2MWebRTCModule.so` (static archives), NOT shipped as a separate
  `.so`: the device deploys each native-library asset to its own path, so a
  NEEDED sibling + `$ORIGIN` rpath does not resolve there (observed on device
  2026-07-20: `libSpecsWebRTC.so: cannot open shared object file`). libopus
  must be built with `-DCMAKE_POSITION_INDEPENDENT_CODE=ON` for this. One
  engine patch was made in the reference repo: inbound tracks are identified
  by codec, not just mid (libwebrtc mids are `"0"/"1"`), in
  `src/specs_webrtc.cpp` `on_track_tramp`. Validated by the repo's loopback
  self-test (3/3 PASS).
- **`VideoCallS2MWebRTCModule/`** (new, in this repo) — CoreJs bridge exposing two
  sessions to the Lens: `pov` (SPECS offers camera H.264 + mic Opus) and
  `voice` (phone offers its mic; SPECS answers, receives decoded PCM).
  Reuses `VideoCallS2MStreamModule/CameraCapture` (single-camera-client rule
  respected: camera is grabbed only while pov is CONNECTED, released on drop).
- **Signaling** — `MANUAL` mode: SDP/ICE ride the existing Supabase channel
  as `rtc:<pov|voice>:<from>` events (`VideoCallS2MWebRTCSession.ts` on the Lens,
  `WebRTCCallManager.swift` on the phone). Media never touches Supabase, so
  the 250 KB / message-budget limits no longer bound quality.
- **ICE** — STUN only (`stun:stun.l.google.com:19302`), which covers same-LAN
  and most home NATs. **No TURN relay yet**: a phone on LTE/carrier NAT may
  fail to connect — the call then simply stays on the Realtime fallback.
  For production, TURN must be hosted on approved Snap infrastructure (ask
  the security team / #web-devs before wiring one in).
- **Fallback + handover** — `CallStreamer` starts the JPEG/WAV path
  immediately; when the pov session connects it hands the camera and mic to
  WebRTC (and hands back on drop). The SPECS re-offers every ~8 s while
  unconnected; the phone re-answers any fresh offer and re-offers voice.

## Build (the committed `.so` is prebuilt; rebuild after C++ changes)

Download **SpecsNDK 1.1 (1.1.0)** from
https://github.com/specs-devs/ndk. Follow the self-contained
[package setup guide](Assets/VideoCallS2M.lspkg/README.md#native-development-specsndk)
to configure `SPECSNDK_ROOT` and obtain the matching WebRTC third-party libraries.

The source package includes the engine source, but not its Opus and patched
libdatachannel build dependencies. See the
[module guide](VideoCallS2MWebRTCModule/README.md) for the required dependency layout.
Run from the project root, after configuring both paths:

```bash
bash VideoCallS2MStreamModule/build.sh "$SPECSNDK_ROOT"
bash VideoCallS2MWebRTCModule/build.sh "$SPECSNDK_ROOT"
```

## Scene setup (done)

`VideoCallS2MWebRTCControllerRoot` is in the scene with the `VideoCallS2MWebRTCController`
script attached (loads the new `.so`). Preview logs
`[VideoCallS2MWebRTC] Native module unavailable (preview?) — Realtime JPEG/WAV fallback.`
(expected — the `.so` is device-only); on device expect `ping -> 2`. If the
object is ever deleted, recreate it: empty SceneObject + Script component →
`VideoCallS2MWebRTCController`.

## Test procedure

1. **Preview sanity (no device):** run the Lens in preview, start CALL
   FRIEND. Everything must behave exactly as before (JPEG/WAV path) — the
   WebRTC module never loads in preview.
2. **On device, same Wi-Fi as the phone (do this first):**
   - Deploy the Lens; on the friend phone open VideoCallS2M and accept/start
     the call.
   - Watch the call caption line 1: `rtc: pov ✓ voice ✓` = WebRTC live.
   - Phone UI shows `Voice link · WebRTC (echo-cancelled) · POV video live`.
   - Expect: POV video visibly smoother/sharper (24 fps 640px vs ~11 fps
     480px), voice latency well under a second, no echo on the phone side.
3. **Cross-network (phone on LTE):** may or may not connect with STUN only.
   If `rtc: pov …` never turns ✓, the call is riding the fallback — that's
   the designed degradation until a TURN relay exists.
4. **Handover check:** toggle the phone's Wi-Fi mid-call — video should
   coarsen (JPEG fallback) within ~10 s, then recover when WebRTC reconnects.

### Debugging

- Device logs stream into the LS log as `[com.example.videocalls2m]` (phone)
  and the Lens's own prints. Grep for `[VideoCallS2MRTC]`, `[Call]`,
  `[VideoCallS2MWebRTCModule]`, `[RTC]` (phone).
- `udpProbe(b0,b1,b2,b3,port)` on the native module checks UDP egress from
  the SPECS sandbox (send one datagram to your Mac's IP, any port; >0 = sent).
  If UDP egress to the internet is blocked, STUN can't work — LAN-only then.
- Loopback self-test for the engine (no device needed):
  `$ENGINE/build-mac/swrtc_loopback_test`
- The old wire format is untouched: killing the WebRTC path entirely (e.g.
  deleting the two new `.so` files) reverts to the exact pre-existing call.

## Known limitations / phase 2

- **Phone → SPECS video** stays JPEG-over-Realtime (SPECS-side H.264 decode
  + texture upload is new native work; the POV leg was the priority).
- **No TURN** — cellular NAT traversal unreliable; needs Snap-approved infra.
- **SPECS mic quirks remain** (flaky start, auto-gain ×30): the same
  battle-tested JS mic pipeline feeds both paths, so the mitigations carry over.
- The engine's Opus receive side has no packet-loss concealment; heavy loss
  will sound choppy despite the jitter buffer.
- Not yet validated on physical SPECS hardware — see Test procedure.
