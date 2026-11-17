# RemoteAssistance helper portal guide

[← Agent usage index](../README.md)

## Use when

Prepare the external browser helper and match the Lens mailbox.

This helper lives at project-root `web/`, outside the exported package; obtain those companion files when using an Asset Library import. Commands below run from the project root. Media/credentials were not tested by this pass.

The helper's end of the Remote Assistance call, as a dependency-free static
web page. The SPECS wearer starts a call from the Lens; the helper opens this
page, enters the session code from the wearer's start menu, and then:

- **sees** the wearer's POV camera live (peer-to-peer WebRTC, H.264),
- **hears** the wearer and **talks back** (Opus, both directions),
- **draws** on the video — every stroke lands in the wearer's world as a
  3D line (see `../DRAWING.md` for the wire format),
- can optionally **send their webcam back** to the wearer's panel.

## Run it

```bash
cd web
./serve.sh          # → http://localhost:8000
```

Run the server **on the helper's machine** and open `http://localhost:8000`
(localhost is a secure context, so the mic/webcam prompts work without HTTPS).

## What you need

| Field | Where it comes from |
|---|---|
| Snap Cloud URL | The Supabase project the Lens uses (Lens Studio → Window > Supabase). |
| Anon key | Same project — the public anon key. Nothing is hardcoded in this repo. |
| Session code | Shown on the SPECS start menu (`wrp-…`); a new one per lens run. |

The URL and anon key are remembered in the browser's localStorage for next
time; the session code is created once per manager/lens instance and reused across calls.

## How it works

Signaling and drawing ride the same Snap Cloud `rtc_signals` table the Lens
uses (PostgREST, polled every 400 ms — no realtime channel, no extra
services). Media is peer-to-peer WebRTC with a public STUN server, matching
the Lens's configuration:

```
SPECS offers  rtc:pov:glasses  (POV H.264 + wearer mic; duplex video)
   ↳ portal answers, renders <video>, optionally adds webcam track back
portal offers rtc:voice:phoneB (helper mic Opus)
   ↳ SPECS answers, plays it on the wearer's speaker
portal posts  draw rows (cumulative stroke JSON) → 3D lines on the SPECS
either side posts bye → both ends tear down
```

The portal identifies itself as sender `phoneB` — kept from the phone-app era
so the Lens wire protocol is unchanged.

## Limits

- Same-network / home-NAT calls connect via STUN. Symmetric or enterprise
  NATs on both ends need a TURN relay (same limitation as the Lens — see
  `../WEBRTC-CALL.md`).
- The Lens preview in Lens Studio cannot run the native WebRTC module, so a
  full end-to-end test needs the Lens on a SPECS device.
