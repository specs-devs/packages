/**
 * SPECS Inc. 2027
 * SpecsNDK 1.1.0 bridge for libNDKCaptureModule.so (source: NDKCaptureModule/ at the project root).
 * When you add native exports, extend NDKCaptureNativeExports alongside the C++ module.
 */

/** Native layer names (the "ui" layer is proxy-only and never reaches the native module). */
export type NativeLayer = "camera" | "ar" | "mic"

/** Shape of the JS values exported by the native module (see assignNativeFunctions in C++). */
export type NDKCaptureNativeExports = {
  ping: () => number
  version: () => string
  /** Monotonic clock in nanoseconds (same clock as packet timestamps). */
  clockNs: () => number
  /**
   * fps, bitrate (bps), keyFrameInterval (frames), rateControl (SpecsMedia_RateControl_t); 0 = SDK
   * default. extra = AR eye (SpecsRecorder_ArCameraPosition_t) for "ar", sample rate for "mic".
   * Applied on the next startLayer().
   */
  configureLayer: (
    layer: NativeLayer,
    fps: number,
    bitrate: number,
    keyFrameInterval: number,
    rateControl: number,
    extra: number
  ) => number
  /** Start the layer's SpecsRecorder session. 0 or a SpecsMedia_Result_t error. Idempotent. */
  startLayer: (layer: NativeLayer) => number
  stopLayer: (layer: NativeLayer) => number
  /** Queue the layer's encoded packets for pollLayer() (on = 1) or stop queueing (0). */
  streamLayer: (layer: NativeLayer, on: number) => number
  /** Base64 of NKC1-framed packets (up to maxBytes), or undefined when nothing is queued. */
  pollLayer: (layer: NativeLayer, maxBytes: number) => string | undefined
  /** Write the layer to an NKC1 track file on the device; path "" closes it. */
  recordLayer: (layer: NativeLayer, path: string, headerJson: string) => number
  /** action 0 = request a key frame, 1 = set the target bitrate to value (bps). */
  layerAction: (layer: NativeLayer, action: number, value: number) => number
  /** JSON: {layers: {camera, ar, mic}, proxy, composite}. */
  stats: () => string
  /** Low-rate JPEG camera feed for live previews. 0 ok, -1 camera unavailable. */
  startProxy: (maxWidth: number, quality: number, fps: number) => number
  stopProxy: () => number
  /** "<tsNs>:<base64 JPEG>" or undefined when no new frame is ready. */
  proxyFrame: () => string | undefined
  /** One finished MP4 through SpecsCapture: camera + AR (blend 0 = alpha, 1 = additive) + audio. */
  startComposite: (
    path: string,
    withAr: number,
    blend: number,
    alpha: number,
    width: number,
    height: number,
    bitrate: number,
    durationSec: number
  ) => number
  stopComposite: () => number
}

/** Load the native module. Resolves null in the Lens Studio editor or if the .so can't load. */
export async function loadNDKCaptureNative(log: (m: string) => void): Promise<NDKCaptureNativeExports | null> {
  if (global.deviceInfoSystem.isEditor()) {
    log("Editor: native module unavailable, using the editor backend")
    return null
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- native module asset
    const asset = (await requireAsset("../Modules/libNDKCaptureModule.so")) as any
    const exports = (await asset.load()) as NDKCaptureNativeExports
    if (!exports || exports.ping() !== 1) throw new Error("ping failed")
    log("Native module loaded: " + exports.version())
    return exports
  } catch (e) {
    log("Native module failed to load: " + e)
    return null
  }
}
