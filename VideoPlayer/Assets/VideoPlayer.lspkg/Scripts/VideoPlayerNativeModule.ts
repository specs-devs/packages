/**
 * SpecsNDK native bridge for libVideoPlayerModule.so — types + field decorator + `load` for SpecsVideoPlayer.
 * The module wraps the SpecsNDK SpecsPlayer API (libspecs_player.so, SpecsNDK 1.1.0).
 * When you add native exports, extend VideoPlayerNativeExports (and call sites) alongside the C++ module.
 */

/** Player state codes returned by getState() (mirrors JsState in VideoPlayerModule.cpp). */
export const enum VideoPlayerState {
    Idle = 0,
    Opening = 1,
    Buffering = 2,
    Playing = 3,
    Paused = 4,
    Stopped = 5,
    Ended = 6,
    Error = 7,
}

/** Parsed getMediaInfo() payload. Fields are 0 / "" until the media reaches PAUSED or PLAYING. */
export type VideoPlayerMediaInfo = {
    /** true once SpecsPlayer answered the property queries (media prerolled). */
    available: boolean;
    hasVideo: boolean;
    hasAudio: boolean;
    /** Source video size in pixels. */
    width: number;
    height: number;
    framerate: number;
    videoCodec: string;
    audioCodec: string;
    sampleRate: number;
    channels: number;
    /** SpecsPlayer_FrameFormat_t of the decoded frames (1 I420, 2 NV12, 3 RGBA). */
    frameFormat?: number;
    /** Size of the RGBA frames handed to pullFrameInto (after the max-size cap). */
    outputWidth?: number;
    outputHeight?: number;
};

export type VideoPlayerFrameInfo = {
    /** true when a new frame was copied into the buffer. */
    updated: boolean;
    /** Size of the newest frame (reported even when the buffer was too small). */
    width: number;
    height: number;
};

/**
 * Shape of JS values exported from the CoreJs native module (see assignNativeFunctions in C++).
 * Commands return a SpecsPlayer_Result_t code (0 = success).
 */
export type VideoPlayerNativeExports = {
    ping: () => number;
    /** Tear down any current media and open `url` (file://, http://, https://) on a worker thread. 0 = started. */
    open: (url: string, loop: boolean) => number;
    play: () => number;
    pause: () => number;
    /** Pause and rewind to 0; media stays open. */
    stop: () => number;
    seek: (seconds: number) => number;
    setLoop: (loop: boolean) => number;
    /** Linear volume 0..1. */
    setVolume: (volume: number) => number;
    /** See VideoPlayerState. */
    getState: () => number;
    getLastError: () => string;
    getDuration: () => number;
    getPosition: () => number;
    /** JSON string, see VideoPlayerMediaInfo. */
    getMediaInfo: () => string;
    /** Copy the newest RGBA frame (already flipped for setPixels) into a caller-owned PERSISTENT buffer. */
    pullFrameInto: (buffer: ArrayBuffer) => VideoPlayerFrameInfo;
    /** Cap the RGBA frame size handed to JS (default 1280x720, aspect preserved, never upscaled). */
    setMaxFrameSize: (width: number, height: number) => number;
    /** Close + destroy the player. */
    close: () => number;
};

/** Marks which field receives native exports (one decorated field per instance). */
const VideoPlayerNativeFieldKey = Symbol.for("specsndk.VideoPlayerModule.nativeField");

/**
 * Loads **`../Modules/libVideoPlayerModule.so`**, assigns exports to the **`@VideoPlayerNativeModule()`** field,
 * then calls **`onLoaded.call(self, exports)`**. On failure (always the case in the Lens Studio editor)
 * it assigns `null` and calls **`onLoaded.call(self, null)`** so callers can fall back.
 */
async function loadVideoPlayerNativeModule(
    self: BaseScriptComponent,
    onLoaded: (this: BaseScriptComponent, lib: VideoPlayerNativeExports | null) => void
): Promise<VideoPlayerNativeExports | null> {
    const inst = self as any;
    const propKey = inst[VideoPlayerNativeFieldKey] as string | symbol | undefined;
    if (propKey == null) {
        print(
            "VideoPlayerNativeModule.load: decorate a field with @" +
                "VideoPlayerNativeModule() before calling load()."
        );
        onLoaded.call(self, null);
        return null;
    }

    try {
        const asset = (await requireAsset("../Modules/libVideoPlayerModule.so")) as any;
        const exports = (await asset.load()) as VideoPlayerNativeExports;
        inst[propKey] = exports;
        onLoaded.call(self, exports);
        return exports;
    } catch (err) {
        print("VideoPlayerNativeModule: failed to load libVideoPlayerModule.so: " + err);
        inst[propKey] = null;
        onLoaded.call(self, null);
        return null;
    }
}

type VideoPlayerNativeModuleApi = (() => (_target: undefined, context: ClassFieldDecoratorContext) => void) & {
    load: typeof loadVideoPlayerNativeModule;
};

/**
 * **`@VideoPlayerNativeModule()`** — field decorator only: initializes the field to **`null`**
 * and records where **`load`** assigns exports. It does **not** load the `.so`.
 *
 * **`VideoPlayerNativeModule.load(this, onLoaded)`** — loads the library, assigns the field, then
 * **`onLoaded.call(this, exports)`** (`exports` is `null` when the library cannot load).
 */
export const VideoPlayerNativeModule: VideoPlayerNativeModuleApi = Object.assign(
    function VideoPlayerNativeModule(): (
        _target: undefined,
        context: ClassFieldDecoratorContext
    ) => void {
        return function (_target: undefined, context: ClassFieldDecoratorContext) {
            const propertyKey = context.name;

            context.addInitializer(function (this: BaseScriptComponent) {
                const inst = this as any;
                inst[propertyKey] = null;
                if (inst[VideoPlayerNativeFieldKey] != null && inst[VideoPlayerNativeFieldKey] !== propertyKey) {
                    print(
                        "VideoPlayerNativeModule: only one @VideoPlayerNativeModule() field is supported per instance."
                    );
                }
                inst[VideoPlayerNativeFieldKey] = propertyKey;
            });
        };
    },
    { load: loadVideoPlayerNativeModule }
) as VideoPlayerNativeModuleApi;
