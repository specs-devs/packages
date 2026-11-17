#!/usr/bin/env python3
"""Generate samples/demo: a small ndkcapture/1 recording (3 visual layers as JPEG proxies + synthetic
native packets) used by the Studio tests and as a demo. Usage: python3 tools/make-sample.py"""
import base64, io, json, math, os, struct
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "samples", "demo")
os.makedirs(OUT, exist_ok=True)
W, H, FPS, SECONDS = 320, 240, 6, 4

def jpeg(img):
    b = io.BytesIO(); img.save(b, "JPEG", quality=60); return base64.b64encode(b.getvalue()).decode()

def camera(i):
    img = Image.new("RGB", (W, H), (30 + i * 3 % 60, 60, 90))
    d = ImageDraw.Draw(img)
    for x in range(0, W, 40): d.line([(x + i * 4) % W, 0, (x + i * 4) % W, H], fill=(70, 100, 130), width=2)
    d.text((10, 10), "camera %02d" % i, fill=(255, 255, 255))
    return img

def ar(i):
    img = Image.new("RGB", (W, H), (0, 0, 0))
    d = ImageDraw.Draw(img)
    a = i / (FPS * SECONDS) * 2 * math.pi
    cx, cy = W / 2 + math.cos(a) * 70, H / 2 + math.sin(a) * 50
    d.ellipse([cx - 30, cy - 30, cx + 30, cy + 30], fill=(52, 211, 153))
    return img

def ui(i):
    img = Image.new("RGB", (W, H), (0, 0, 0))
    ImageDraw.Draw(img).rectangle([10, H - 40, 10 + i * 7 % (W - 20), H - 20], fill=(96, 165, 250))
    return img

frames = {"camera": camera, "ar": ar, "ui": ui}
chunks = {}
for layer, fn in frames.items():
    lines = [json.dumps({"t": round(i * 1000 / FPS), "d": jpeg(fn(i))}) for i in range(FPS * SECONDS)]
    half = len(lines) // 2  # two chunks per layer, like the plugin's periodic flush
    for n, part in enumerate([lines[:half], lines[half:]]):
        with open(os.path.join(OUT, "%s.proxy.%d.ndjson" % (layer, n)), "w") as f: f.write("\n".join(part) + "\n")
    chunks[layer + ".proxy"] = 2

# Synthetic native camera packets (NKC1 framing; H.265 IDR then trailing frames).
def packet(layer, key, ts, payload):
    return struct.pack("<BBHQI", layer, 1 if key else 0, 0, ts, len(payload)) + payload
idr = b"\x00\x00\x00\x01\x40\x01" + b"\x0c" * 20  # VPS NAL (type 32)
trail = b"\x00\x00\x00\x01\x02\x01" + b"\x11" * 40  # TRAIL_R NAL (type 1)
lines = []
for i in range(30):
    lines.append(base64.b64encode(packet(0, i % 15 == 0, 1_000_000_000 + i * 33_333_333, idr if i % 15 == 0 else trail)).decode())
with open(os.path.join(OUT, "camera.nkc.0.b64"), "w") as f: f.write("\n".join(lines) + "\n")
chunks["camera.nkc"] = 1

def settings(layer):
    return {"enabled": True, "opacity": 1, "blend": "normal" if layer == "camera" else "screen",
            "transform": {"x": 0, "y": 0, "scale": 1, "rotation": 0}, "z": {"camera": 0, "ar": 1, "ui": 2, "mic": 3}[layer],
            "fps": 30, "bitrate": 0, "keyFrameInterval": 30, "proxyFps": FPS}

manifest = {
    "format": "ndkcapture/1", "version": "4.0.0", "id": "rec-demo0001", "name": "Demo capture",
    "createdAt": "2026-10-19T12:00:00.000Z", "lens": "NDK Capture", "durationMs": SECONDS * 1000,
    "device": "editor", "ndk": "sample",
    "layers": [
        {"id": "camera", "kind": "video", "codec": "jpeg", "source": "proxy", "file": "camera.proxy.ndjson"},
        {"id": "camera", "kind": "video", "codec": "hevc", "source": "native", "file": "camera.nkc"},
        {"id": "ar", "kind": "video", "codec": "jpeg", "source": "proxy", "file": "ar.proxy.ndjson"},
        {"id": "ui", "kind": "video", "codec": "jpeg", "source": "proxy", "file": "ui.proxy.ndjson"},
    ],
    "initial": {l: settings(l) for l in ["camera", "ar", "ui", "mic"]},
    "timeline": [
        {"t": 1500, "layer": "ar", "set": {"opacity": 0.5}},
        {"t": 2500, "layer": "ui", "set": {"transform": {"scale": 0.6}}},
    ],
    "markers": [{"t": 1000, "label": "Good part", "color": "#F5A524"}, {"t": 3000, "label": "Take 2", "color": "#F5A524"}],
    "clock": {"nativeStartNs": 1_000_000_000},
    "chunks": chunks,
}
with open(os.path.join(OUT, "manifest.json"), "w") as f: json.dump(manifest, f, indent=1)
print("wrote", OUT, sorted(os.listdir(OUT)))
