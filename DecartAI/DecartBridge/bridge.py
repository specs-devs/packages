#!/usr/bin/env python3
"""
DecartBridge — realtime WebRTC bridge between a Lens and Decart's realtime API.

    Lens (WebSocket, JSON+base64 JPEG)  ⟷  bridge.py  ⟷  Decart Lucy realtime
                                                          (LiveKit / WebRTC)

The Lens runtime has no WebRTC stack, so this process does the WebRTC leg:
it feeds camera JPEGs from the Lens into a LiveKit video track, and relays
Decart's transformed frames back to the Lens as JPEG over the same socket.

Protocol (all text frames, JSON):
  Lens → bridge:  {"type":"frame","data":"<base64 jpeg>"}
                  {"type":"prompt","prompt":"...","enhance":true}
  bridge → Lens:  {"type":"frame","data":"<base64 jpeg>"}
                  {"type":"status","message":"..."}

Usage:
  python3 -m venv .venv && source .venv/bin/activate
  pip install -r requirements.txt
  DECART_API_KEY=dct_... python bridge.py [--port 8765] [--model lucy-2.5] [--out-width 640]

Then in the Lens: mode = "bridge", bridgeUrl = ws://localhost:8765 (editor)
or ws://<this-mac's-LAN-ip>:8765 (Glasses device on the same Wi-Fi).
"""

import argparse
import asyncio
import base64
import io
import json
import os
import sys
import time

import certifi

# macOS Python often ships without a usable CA path — point OpenSSL at
# certifi's bundle before any TLS context is created (fixes
# CERTIFICATE_VERIFY_FAILED against api3.decart.ai).
os.environ.setdefault("SSL_CERT_FILE", certifi.where())

import websockets
from PIL import Image

from decart import DecartClient, SetInput, models
from decart.realtime import RealtimeClient, RealtimeConnectOptions
from decart.types import ModelState, Prompt
from livekit import rtc

DEFAULT_API_KEY = ""
DEFAULT_PROMPT = "turn the world into a vivid watercolor painting"


class Bridge:
    """One Decart realtime session, shared across Lens (re)connections."""

    def __init__(self, api_key: str, model_name: str, out_width: int, jpeg_quality: int):
        self.api_key = api_key
        self.model_name = model_name
        self.out_width = out_width
        self.jpeg_quality = jpeg_quality

        self.client: DecartClient | None = None
        self.realtime = None
        self.model = None
        self.source: rtc.VideoSource | None = None
        self.prompt = DEFAULT_PROMPT
        self.enhance = True

        self.lens_ws = None                 # current Lens websocket (one at a time)
        self.out_queue: asyncio.Queue = asyncio.Queue(maxsize=1)  # newest-only
        self.frames_in = 0
        self.frames_out = 0
        self._connecting = False

    # ── Decart session ──────────────────────────────────────────────────────

    async def ensure_connected(self):
        if self.realtime is not None or self._connecting:
            return
        self._connecting = True
        try:
            await self._status(f"connecting to Decart ({self.model_name})…")
            self.client = DecartClient(api_key=self.api_key)
            try:
                self.model = models.realtime(self.model_name)
            except Exception:
                print(f"[bridge] model {self.model_name!r} unknown, falling back to lucy-2.1")
                self.model_name = "lucy-2.1"
                self.model = models.realtime(self.model_name)

            self.source = rtc.VideoSource(self.model.width, self.model.height)
            local_track = rtc.LocalVideoTrack.create_video_track("lens-camera", self.source)

            def on_remote_stream(track: rtc.RemoteVideoTrack):
                asyncio.create_task(self._consume(track))

            self.realtime = await RealtimeClient.connect(
                base_url=self.client.realtime_base_url,
                api_key=self.client.api_key,
                local_track=local_track,
                options=RealtimeConnectOptions(
                    model=self.model,
                    on_remote_stream=on_remote_stream,
                    initial_state=ModelState(
                        prompt=Prompt(text=self.prompt, enhance=self.enhance),
                    ),
                ),
            )
            self.realtime.on("error", lambda e: print(f"[bridge] decart error: {e}"))
            self.realtime.on(
                "connection_change", lambda s: print(f"[bridge] decart connection: {s}")
            )
            self.realtime.on(
                "generation_tick",
                lambda m: print(f"[bridge] billed realtime seconds: {m.seconds}"),
            )
            await self._status(
                f"Decart {self.model_name} connected ({self.model.width}x{self.model.height})"
            )
            print(f"[bridge] decart connected: {self.model_name} "
                  f"{self.model.width}x{self.model.height}@{getattr(self.model, 'fps', '?')}fps")
        except Exception as e:
            await self._status(f"Decart connect FAILED: {e}")
            print(f"[bridge] decart connect failed: {e!r}")
            self.realtime = None
        finally:
            self._connecting = False

    async def _consume(self, track: rtc.RemoteVideoTrack):
        print("[bridge] receiving transformed stream from Decart")
        async for event in rtc.VideoStream(track):
            frame = event.frame
            try:
                jpeg_b64 = await asyncio.to_thread(self._frame_to_jpeg_b64, frame)
            except Exception as e:
                print(f"[bridge] output convert failed: {e!r}")
                continue
            # newest-only queue: drop the stale frame if the Lens is slower
            if self.out_queue.full():
                try:
                    self.out_queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            await self.out_queue.put(jpeg_b64)

    def _frame_to_jpeg_b64(self, frame: rtc.VideoFrame) -> str:
        rgb = frame.convert(rtc.VideoBufferType.RGB24)
        img = Image.frombytes("RGB", (rgb.width, rgb.height), bytes(rgb.data))
        if self.out_width and img.width > self.out_width:
            h = int(img.height * self.out_width / img.width)
            img = img.resize((self.out_width, h), Image.BILINEAR)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=self.jpeg_quality)
        return base64.b64encode(buf.getvalue()).decode("ascii")

    def _jpeg_to_video_frame(self, jpeg_b64: str) -> rtc.VideoFrame:
        img = Image.open(io.BytesIO(base64.b64decode(jpeg_b64))).convert("RGB")
        img = img.resize((self.model.width, self.model.height), Image.BILINEAR)
        return rtc.VideoFrame(
            width=self.model.width,
            height=self.model.height,
            type=rtc.VideoBufferType.RGB24,
            data=img.tobytes(),
        )

    # ── Lens side ───────────────────────────────────────────────────────────

    async def _status(self, message: str):
        ws = self.lens_ws
        if ws is not None:
            try:
                await ws.send(json.dumps({"type": "status", "message": message}))
            except Exception:
                pass

    async def sender_loop(self):
        """Forward transformed frames to whichever Lens socket is current."""
        while True:
            jpeg_b64 = await self.out_queue.get()
            ws = self.lens_ws
            if ws is None:
                continue
            try:
                await ws.send(json.dumps({"type": "frame", "data": jpeg_b64}))
                self.frames_out += 1
            except Exception:
                pass  # socket died; handle_client clears self.lens_ws

    async def stats_loop(self):
        while True:
            await asyncio.sleep(5)
            if self.lens_ws is not None:
                print(f"[bridge] last 5s: {self.frames_in} frames in, {self.frames_out} out")
            self.frames_in = 0
            self.frames_out = 0

    async def handle_client(self, ws):
        peer = getattr(ws, "remote_address", "?")
        print(f"[bridge] lens connected from {peer}")
        if self.lens_ws is not None:
            try:
                await self.lens_ws.close()
            except Exception:
                pass
        self.lens_ws = ws
        await self._status("bridge ready" if self.realtime else "bridge ready — Decart connects on first frame")

        try:
            async for raw in ws:
                if not isinstance(raw, str):
                    continue
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                mtype = msg.get("type")

                if mtype == "frame" and msg.get("data"):
                    self.frames_in += 1
                    await self.ensure_connected()
                    if self.realtime is None or self.source is None:
                        continue
                    try:
                        frame = await asyncio.to_thread(self._jpeg_to_video_frame, msg["data"])
                        self.source.capture_frame(frame)
                    except Exception as e:
                        print(f"[bridge] input frame failed: {e!r}")

                elif mtype == "prompt" and msg.get("prompt"):
                    self.prompt = msg["prompt"]
                    self.enhance = bool(msg.get("enhance", True))
                    print(f"[bridge] prompt: {self.prompt!r} (enhance={self.enhance})")
                    if self.realtime is not None:
                        try:
                            await self.realtime.set(
                                SetInput(prompt=self.prompt, enhance=self.enhance)
                            )
                            await self._status(f"prompt applied: {self.prompt[:60]}")
                        except Exception as e:
                            await self._status(f"prompt failed: {e}")
        except websockets.ConnectionClosed:
            pass
        finally:
            if self.lens_ws is ws:
                self.lens_ws = None
            print(f"[bridge] lens disconnected ({peer})")


async def main():
    ap = argparse.ArgumentParser(description="Lens ⟷ Decart realtime WebRTC bridge")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--model", default="lucy-2.5", help="realtime model (falls back to lucy-2.1)")
    ap.add_argument("--out-width", type=int, default=640,
                    help="downscale frames sent to the Lens to this width (0 = original)")
    ap.add_argument("--jpeg-quality", type=int, default=70)
    ap.add_argument("--api-key", default=os.environ.get("DECART_API_KEY", DEFAULT_API_KEY))
    args = ap.parse_args()

    bridge = Bridge(args.api_key, args.model, args.out_width, args.jpeg_quality)
    asyncio.create_task(bridge.sender_loop())
    asyncio.create_task(bridge.stats_loop())

    async with websockets.serve(bridge.handle_client, "0.0.0.0", args.port,
                                max_size=16 * 1024 * 1024):
        print(f"[bridge] listening on ws://0.0.0.0:{args.port} "
              f"(model={args.model}, out_width={args.out_width})")
        print("[bridge] Lens editor URL: ws://localhost:%d — device URL: ws://<this-mac-ip>:%d"
              % (args.port, args.port))
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[bridge] bye")
        sys.exit(0)
