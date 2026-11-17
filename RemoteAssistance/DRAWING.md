# Remote Assistance Drawing Channel

The helper (in the web portal, `web/`) draws on the POV video they are
watching; the SPECS wearer sees the strokes as **3D lines anchored in their
world**. This document is the wire-protocol spec plus the helper-side guide.

## End-to-end pipeline

```
helper pointer on the portal's canvas overlay (web/app.js)
  └─ pointer points, normalized to the VIDEO FRAME (u right, v down, 0..1)
      └─ stroke JSON rows INSERTed into Snap Cloud `rtc_signals`
         (kind "draw", sender "phoneB" — same table the WebRTC
          SDP/ICE signaling rides)
          └─ SPECS RtcMailbox.ts polls the table (~0.4 s)
              └─ RemoteAssistanceManager routes kind "draw" rows
                  └─ AnnotationRenderer.ts
                      • freezes the head pose from `poseLagMs` ago
                      • unprojects the 2D points onto a plane
                        `anchorDepthCm` ahead of that pose
                        (sized by `povHorizontalFovDeg` + payload `ar`)
                      • builds a world-anchored ribbon mesh per stroke
                        (MeshBuilder, unlit StrokeMat clone, per-stroke color)
```

No schema change was needed: `rtc_signals.kind` / `t` are free-text columns and
the prototype RLS policy already allows anon + authenticated insert/select.

## Wire format

One row per stroke **update** (cumulative) or clear:

| column | stroke update | clear |
|---|---|---|
| `session` | call session code (`wrp-…`) | same |
| `kind` | `"draw"` | `"draw"` |
| `sender` | `"phoneB"` (helper) / `"glasses"` (wearer) | same |
| `t` | `"stroke"` | `"clear"` |
| `sdp` | stroke JSON (below) | optional `{"id":"s3"}` (one stroke) or empty / `{"scope":"all"}` (all) |
| `cand`, `mid` | unused (null) | unused |

Stroke JSON (rides the `sdp` text column):

```json
{
  "id":    "s3",                 // unique per stroke within the session
  "color": [1.0, 0.35, 0.25],    // optional RGB 0..1 — receiver auto-palettes if absent
  "w":     0.008,                // optional width as a fraction of frame height
  "ar":    1.333,                // aspect (frame w / h) the annotator saw — send it!
  "done":  false,                // true on the final update of the stroke
  "pts":   [0.42,0.55, 0.43,0.54, ...]  // flat [u,v,...], normalized, v DOWN
}
```

Rules:

- **Cumulative updates.** Each `"stroke"` row carries the FULL point list so
  far; the receiver rebuilds the stroke mesh. Send an update every ~0.3 s while
  the finger moves, and a final one with `done: true` on finger-up. After
  `done`, further updates for that id are ignored.
- **Frame coords, not screen coords.** If the video is letterboxed on the
  phone screen, map touches into the video frame's 0..1 space before sending.
  `v` grows downward (image convention).
- **Send `ar`** (video width/height). The SPECS uses it to reconstruct the
  exact framing; without it the receiver assumes the SPECS camera's 4:3.
- **Clear works both ways.** The wearer's CLEAR DRAWINGS button posts a
  `t:"clear"` row with `sender:"glasses"` — the helper client wipes its 2D
  overlay when it sees one (poll already delivers rows with `sender != me`).

## SPECS side (this repo — DONE)

- `Assets/RemoteAssistance.lspkg/Scripts/Drawing/AnnotationTypes.ts` — parsing.
- `Assets/RemoteAssistance.lspkg/Scripts/Drawing/AnnotationRenderer.ts` — pose
  history, unprojection, ribbon meshes, palette, clear. Inspector tunables on
  the `Annotations3D` scene object:
  - `anchorDepthCm` (200) — how far ahead the drawing plane lands.
  - `povHorizontalFovDeg` (66) — match the SPECS RGB camera stream's
    horizontal FOV; calibrate on device if strokes land offset from what the
    helper circled.
  - `strokeWidthCm` (1.0), `poseLagMs` (400 — raise if the wearer moves and
    strokes land where they are looking NOW instead of where they looked when
    the helper drew).
- `RemoteAssistanceManager.ts` — routes mailbox `draw` rows to the renderer,
  wipes drawings on call end, `CLEAR DRAWINGS` button on the POV panel.
- **Preview simulation:** with `simulateInPreview` on, starting CALL HELPER in
  the Lens Studio preview streams a demo circle + arrow + dot through the real
  pipeline (no phone needed).

## Helper side (this repo — the web portal, DONE)

`web/app.js` implements the sending end: a canvas overlay on the `<video>`
element captures pointer strokes, maps them into video-frame space (correcting
the object-fit letterbox), and posts cumulative stroke rows at ~3 updates/s
with `done: true` on pointer-up. Color palette, Undo (per-stroke clear), Clear
All, and inbound-clear handling are all wired. See `web/README.md` to run it.

Any other client (an iOS app, another web view) can join the same channel by
following the wire format above — sender `"phoneB"`, cumulative updates,
frame-normalized coords.

## Streaming virtual content back to the helper (plan of record)

Today the outbound SPECS → phone video is the **raw camera only** — both
encoders capture natively (`rtcEnsureCamera()` in the WebRTC module, or
`startStream` in the stream module), below the Lens renderer, so no virtual
content is in the stream. The helper sees their own strokes only because the
phone draws a local 2D overlay on the video it displays.

Requirement (aligned with the NDK maintainer, 2026-08-12): stream **virtual +
camera background**, toggleable on/off at any time; approximate alignment is
acceptable (strokes are anchored by the 2D→3D transform on the SPECS side
regardless).

Options, in preference order:

1. **Virtual content as data, rendered by the receiving client** (maintainer's
   "even better" option — and what the stroke channel already does). Anything
   expressible as state rides the `rtc_signals` mailbox as new `kind`s, and
   the phone/web client mirrors it locally — e.g. a remote operator pressing a
   button on a web view that instantiates a cube on SPECS would also render
   that cube on their own overlay. Cheap, toggleable client-side, no encoder
   changes.
2. **Native Vulkan overlay** (maintainer's recommendation for true
   compositing): the NDK module draws the virtual layer directly onto the
   camera image before encode — single texture, easy on/off flag, and the
   camera stays native-owned. Needs NDK work: an overlay input (small RGBA
   layer pushed from the Lens at low fps, or stroke/gizmo data rasterized
   natively) plus a toggle export (e.g. `rtcSetOverlay(enabled)`).
3. **CompositeCameraTexture package (Lens-level)** — ortho camera composites
   the Device Camera Texture + a virtual-content render target into one
   texture. NOT viable for the native stream as-is: it needs CameraModule to
   own the camera (a second camera client evicts the native capture — see the
   warning in `StreamNativeModule.ts`) and the NDK modules expose no JS→native
   video-push API (only `rtcSendAudio`). Still the right tool for local
   capture/recording use cases.

## Latency & anchoring notes

- End-to-end stroke latency ≈ phone throttle (0.3 s) + DB poll (0.4 s) ≈
  **0.5–1 s** — fine for guidance annotation.
- The anchor pose is frozen **per stroke** at first-update time, `poseLagMs`
  back in the pose history. If the wearer holds still while being guided
  (the normal remote-assistance posture), strokes land precisely; if they pan
  quickly while the helper draws, raise `poseLagMs` or ask the wearer to hold.
- Strokes are world-anchored: walking around them is expected and supported
  (two-sided material).
