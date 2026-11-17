#!/usr/bin/env python3 -I
"""Pulls the H.265 camera video out of a WebCapture recording (background.video) and checks it.
Usage: nkc_extract.py <recording.json> <outdir>   (writes camera.h265, camera.mp4 and prints packet timing)"""
import base64, json, struct, subprocess, sys, os, statistics as st
rec = json.load(open(sys.argv[1])); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
v = (rec.get("background") or {}).get("video")
if not v: sys.exit("no background.video in this recording")
raw = b"".join(base64.b64decode(b) for b in v["batches"])
pk, i = [], 0
while i + 16 <= len(raw):
    layer, flags, _, ts, size = struct.unpack_from("<BBHQI", raw, i)
    if i + 16 + size > len(raw): break
    pk.append((layer, flags, ts, raw[i+16:i+16+size])); i += 16 + size
print("packets", len(pk), "bytes", len(raw), "| trailing bytes", len(raw) - i)
t = [(p[2] - v["startNs"]) / 1e9 for p in pk]; keys = sum(1 for p in pk if p[1] & 1)
dur = rec["meta"]["duration"]; gaps = [b - a for a, b in zip(t, t[1:])]
print("video: %.1f fps over %.1fs | keyframes %d | first t=%.3f last t=%.3f" % (len(pk) / max(t[-1] - t[0], 1e-6) if len(pk) > 1 else 0, dur, keys, t[0], t[-1]))
if gaps: print("frame gap ms: median %.1f  p95 %.1f  max %.1f" % (st.median(gaps)*1000, sorted(gaps)[int(len(gaps)*.95)]*1000, max(gaps)*1000))
open(out + "/camera.h265", "wb").write(b"".join(p[3] for p in pk))
r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "hevc", "-framerate", str(int(v.get("fps", 30))), "-i", out + "/camera.h265", "-c", "copy", out + "/camera.mp4"], capture_output=True, text=True)
print("ffmpeg:", r.stderr.strip() or "ok")
p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_name,width,height,nb_frames,avg_frame_rate", "-of", "default=nw=1", out + "/camera.mp4"], capture_output=True, text=True); print(p.stdout.strip())
