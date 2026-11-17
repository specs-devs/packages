// SPECS Inc. 2027
// Video export in the browser: plays the edited clip in real time into the composite canvas and
// records it with MediaRecorder (MP4/H.264 where the browser supports it, otherwise WebM), with the
// music track mixed in through WebAudio. Nothing leaves the computer.
import {clipLength, frameAt, OUTPUTS, sourceTimeForClip, titlesAt} from "./model.js";

const TYPES = [
  "video/mp4;codecs=avc1.640028,mp4a.40.2",
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm"
];

export function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  return TYPES.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

export class Exporter {
  constructor(viewer) {
    this.viewer = viewer;
    this.cancelled = false;
    this.running = false;
  }

  cancel() {
    this.cancelled = true;
  }

  /**
   * Renders the clip and resolves with {blob, type, extension, seconds, width, height}.
   * `music`: optional {buffer: AudioBuffer, volume, offset}. `onProgress(0..1)`.
   */
  async run(rec, music, onProgress, overrideSize) {
    const type = pickMimeType();
    if (type === null)
      throw new Error("This browser cannot record video (no MediaRecorder). Use a recent Chrome, Edge or Firefox.");
    let out = overrideSize || OUTPUTS[rec.edits.output.preset] || OUTPUTS.lens;
    if (out.auto) {
      const aspect = (rec.meta && rec.meta.aspect) || 16 / 9;
      out = {width: Math.round((out.height * aspect) / 2) * 2, height: out.height};
    }
    const fps = rec.edits.output.fps || 30;
    const length = clipLength(rec);
    if (length <= 0.05) throw new Error("The clip is empty: check the trim and cuts");
    const v = this.viewer;
    this.cancelled = false;
    this.running = true;
    v.fixedSize = {width: out.width, height: out.height};
    v.resize();
    const stream = v.composite.captureStream(fps);
    let audio = null;
    if (music && music.buffer) {
      const ac = new AudioContext();
      const dest = ac.createMediaStreamDestination();
      const src = ac.createBufferSource();
      src.buffer = music.buffer;
      const gain = ac.createGain();
      gain.gain.value = music.volume == null ? 0.8 : music.volume;
      src.connect(gain).connect(dest);
      for (const track of dest.stream.getAudioTracks()) stream.addTrack(track);
      audio = {ac, src, offset: music.offset || 0};
    }
    const recorder = new MediaRecorder(
      stream,
      type ? {mimeType: type, videoBitsPerSecond: out.height >= 1080 ? 12e6 : 6e6} : {}
    );
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    const stopped = new Promise((resolve) => {
      recorder.onstop = resolve;
    });
    const drawAt = (clipT) => {
      const s = sourceTimeForClip(rec, clipT);
      v.update(frameAt(rec, v.sceneTime(s)));
      v.render(rec.edits.camera.shots, s, titlesAt(rec, clipT));
    };
    drawAt(0);
    recorder.start(250);
    if (audio) audio.src.start(0, Math.max(0, audio.offset));
    const t0 = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        const clipT = (performance.now() - t0) / 1000;
        if (this.cancelled || clipT >= length) {
          drawAt(Math.min(clipT, length));
          resolve();
          return;
        }
        drawAt(clipT);
        if (onProgress) onProgress(clipT / length);
        setTimeout(tick, 1000 / fps / 2);
      };
      tick();
    });
    recorder.stop();
    await stopped;
    if (audio) {
      try {
        audio.src.stop();
      } catch (e) {
        /* not started */
      }
      audio.ac.close();
    }
    for (const track of stream.getTracks()) track.stop();
    v.fixedSize = null;
    v.resize();
    this.running = false;
    if (this.cancelled) throw new Error("Export cancelled");
    const finalType = recorder.mimeType || type || "video/webm";
    const blob = new Blob(chunks, {type: finalType});
    if (onProgress) onProgress(1);
    return {
      blob,
      type: finalType,
      extension: finalType.indexOf("mp4") >= 0 ? "mp4" : "webm",
      seconds: length,
      width: out.width,
      height: out.height
    };
  }
}
