// SPECS Inc. 2027
// The camera recorded by the glasses as hardware-encoded H.265 (NDK `camera` layer), played in the browser with
// WebCodecs. Packets are NKC1-framed (see WebCaptureProtocol.ts); only a short window of decoded frames is kept,
// decoding runs ahead of the playhead, and a seek restarts from the nearest keyframe, so a 30 s clip never needs
// gigabytes of RAM.

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Splits base64 batches of NKC1 packets into {ts (ns), key, data}. */
export function parsePackets(batches) {
  const parts = batches.map(b64ToBytes);
  let total = 0;
  for (const p of parts) total += p.length;
  const all = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    all.set(p, o);
    o += p.length;
  }
  const dv = new DataView(all.buffer);
  const packets = [];
  let i = 0;
  while (i + 16 <= all.length) {
    const flags = all[i + 1];
    const ts = Number(dv.getBigUint64(i + 4, true));
    const size = dv.getUint32(i + 12, true);
    if (i + 16 + size > all.length) break;
    packets.push({ts, key: (flags & 1) === 1, data: all.subarray(i + 16, i + 16 + size)});
    i += 16 + size;
  }
  return packets;
}

/**
 * The NDK camera stream (1920x1440) is a zoomed and panned crop of the camera the DeviceCamera calibration describes:
 * the recorder applies an alignment profile to the intrinsics (zoom 1.325323, normalized pan 0.1638 / 0.0099, per the
 * SPECS recorder team). Virtual content projected with the plain calibration is too wide by that zoom and slides
 * against the picture as the head turns.
 */
export const VIDEO_PROFILE = {zoom: 1.325323, panX: 0.1638, panY: 0.0099};

/** Intrinsics of the recorded video: focal lengths in calibration pixels and the principal point as 0..1 of the image. */
export function videoIntrinsics(calib, profile) {
  const w = calib.resolution[0];
  const h = calib.resolution[1];
  const zx = profile ? (profile.zoomX != null ? profile.zoomX : profile.zoom) : 1;
  const zy = profile ? (profile.zoomY != null ? profile.zoomY : profile.zoom) : 1;
  return {
    focal: [calib.focal[0] * zx, calib.focal[1] * zy],
    cx: 0.5 + (calib.principal[0] / w - 0.5) * zx + (profile ? profile.panX : 0),
    cy: 0.5 + (calib.principal[1] / h - 0.5) * zy + (profile ? profile.panY : 0)
  };
}

export function videoSupported() {
  return typeof VideoDecoder !== "undefined";
}

export class VideoTrack {
  /** `video`: recording.background.video; `pose0`: the recording's start on the pose clock (always 0). */
  constructor(video) {
    this.packets = parsePackets(video.batches);
    // Packet clock -> recording time. offsetNs comes from the Lens (it measured the clock difference while polling);
    // without it, the first packet is put at the start.
    // Recordings made before the Lens measured it: the packet clock ran 5.12 s ahead on the test Specs (three captures
    // gave -5.07 to -5.16 s by correlating image motion with head-pose speed).
    this.baseOffset = video.offsetNs != null ? video.offsetNs / 1e9 : -5.12;
    this.startNs = video.startNs;
    this.shift = 0; // seconds, the editor's "Camera sync" fine-tune
    this.times = this.packets.map((p) => this.timeOf(p));
    this.codec = "hev1.1.6.L153.B0";
    this.frames = new Map(); // packet index -> VideoFrame (a small window around the playhead)
    this.decodedUpTo = -1;
    this.nextFeed = 0;
    this.decoder = null;
    this.generation = 0;
    this.pending = 0;
    this.width = 0;
    this.height = 0;
    this.last = null; // a clone of the newest frame shown, held while a later one decodes (never closed under a draw)
    this.lastSrc = null;
    this.ready = false;
    this.errors = 0;
  }

  /** Recording time of packet `index` with the editor's fine-tune removed (what Auto-sync measures against). */
  timeOfIndex(index) {
    return this.timeOf(this.packets[index]) - this.shift;
  }

  timeOf(p) {
    return (p.ts - this.startNs) / 1e9 + this.baseOffset + this.shift;
  }

  /** Moves the video against the poses by `seconds` (positive = later). */
  setShift(seconds) {
    this.shift = seconds;
    this.times = this.packets.map((p) => this.timeOf(p));
  }

  get duration() {
    return this.times.length ? this.times[this.times.length - 1] : 0;
  }

  async init() {
    if (!videoSupported() || !this.packets.length) return false;
    const cfg = {codec: this.codec, hevc: {format: "annexb"}, codedWidth: 1920, codedHeight: 1440};
    const support = await VideoDecoder.isConfigSupported(cfg).catch(() => ({supported: false}));
    if (!support.supported) return false;
    this.config = cfg;
    this.ready = true;
    this.restart(0);
    return true;
  }

  indexAt(t) {
    // The last packet at or before t.
    let lo = 0;
    let hi = this.times.length - 1;
    let ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.times[mid] <= t) {
        ans = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return ans;
  }

  /** The keyframe to start decoding from for `index`: the one at or before it, else the first one after (a capture
   *  can start mid-GOP; decoding from a delta frame makes the decoder fail and no picture shows). */
  /** The packet whose time is closest to t (the frame shown for t). */
  nearestIndex(t) {
    const i = this.indexAt(t);
    return i + 1 < this.times.length && this.times[i + 1] - t < t - this.times[i] ? i + 1 : i;
  }

  keyBefore(index) {
    for (let i = index; i >= 0; i--) if (this.packets[i].key) return i;
    for (let i = index + 1; i < this.packets.length; i++) if (this.packets[i].key) return i;
    return 0;
  }

  restart(index) {
    this.generation++;
    if (this.decoder && this.decoder.state !== "closed") {
      try {
        this.decoder.close();
      } catch (e) {
        // already closed
      }
    }
    for (const f of this.frames.values()) f.close();
    this.frames.clear();
    this.lastSrc = null; // `last` (a clone) stays on screen until the new position has a decoded frame
    const gen = this.generation;
    this.decoder = new VideoDecoder({
      output: (frame) => this.onFrame(frame, gen),
      error: () => {
        // A bad stretch: restart from the next keyframe instead of losing the picture for good.
        if (gen === this.generation && this.errors++ < 3) setTimeout(() => this.restart(Math.min(this.packets.length - 1, this.nextFeed + 1)), 0);
        else this.ready = false;
      }
    });
    this.decoder.configure(this.config);
    this.nextFeed = this.keyBefore(index);
    this.decodedUpTo = this.nextFeed - 1;
    this.feedTo(Math.min(this.packets.length - 1, this.nextFeed + 12));
  }

  feedTo(last) {
    while (this.nextFeed <= last && this.nextFeed < this.packets.length) {
      const p = this.packets[this.nextFeed];
      // The packet index travels in the timestamp (microseconds), so output frames map back to their packet.
      this.decoder.decode(
        new EncodedVideoChunk({type: p.key ? "key" : "delta", timestamp: this.nextFeed, data: p.data})
      );
      this.pending++;
      this.nextFeed++;
    }
  }

  onFrame(frame, gen) {
    if (gen !== this.generation) {
      frame.close();
      return;
    }
    this.pending = Math.max(0, this.pending - 1);
    const index = frame.timestamp;
    this.width = frame.displayWidth;
    this.height = frame.displayHeight;
    const old = this.frames.get(index);
    if (old) old.close();
    this.frames.set(index, frame);
    this.decodedUpTo = Math.max(this.decodedUpTo, index);
  }

  /** The decoded frame for recording time t (or the nearest earlier one while it decodes); null before any. */
  frameAt(t) {
    if (!this.ready) return this.last;
    const want = this.nearestIndex(t);
    // A seek outside the decoded window (backwards, or far ahead): restart from a keyframe.
    const windowStart = this.frames.size ? Math.min(...this.frames.keys()) : want;
    if ((want < windowStart - 1 && this.keyBefore(want) < windowStart) || want > this.nextFeed + 30) this.restart(want);
    // Decode ahead of the playhead (about a third of a second).
    this.feedTo(Math.min(this.packets.length - 1, want + 10));
    // Drop frames well behind the playhead.
    for (const [i, f] of this.frames) {
      if (i < want - 4) {
        f.close();
        this.frames.delete(i);
        if (this.lastSrc === f) this.lastSrc = null;
      }
    }
    for (let i = want; i >= Math.max(0, want - 6); i--) {
      const f = this.frames.get(i);
      if (f) {
        if (this.lastSrc !== f) {
          // Hold a clone: the decoded frame itself may be closed when the window moves or a seek restarts.
          if (this.last) this.last.close();
          this.last = f.clone();
          this.lastSrc = f;
        }
        return this.last;
      }
    }
    return this.last;
  }

  close() {
    this.ready = false;
    if (this.decoder && this.decoder.state !== "closed") this.decoder.close();
    for (const f of this.frames.values()) f.close();
    this.frames.clear();
    if (this.last) this.last.close();
    this.last = null;
    this.lastSrc = null;
  }
}
