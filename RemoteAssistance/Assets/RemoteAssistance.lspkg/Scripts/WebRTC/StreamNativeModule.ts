/**
 * SpecsNDK native bridge for libRemoteAssistanceStreamModule.so — types + field decorator + `load` for StreamController.
 * When you add native exports, extend RemoteAssistanceStreamNativeExports (and call sites) alongside the C++ module.
 */

/** Shape of JS values exported from the CoreJs native module (see assignNativeFunctions in C++). */
export type RemoteAssistanceStreamNativeExports = {
    ping: () => number;
    /**
     * Open the Glasses RGB camera and start the native encoder worker: camera frames
     * are downscaled to <= maxWidth, JPEG-encoded (4:2:0, `quality` 1-100) and
     * base64'd at `fps`, entirely off the JS thread. Idempotent; parameters are
     * applied on every call. Returns 0 ok, -1 camera failed.
     *
     * While the native stream runs, the Lens must NOT also request the camera via
     * CameraModule — a second camera client evicts the first.
     */
    startStream: (maxWidth: number, quality: number, fps: number) => number;
    /** Stop the encoder worker and release the camera. Returns 0. */
    stopStream: () => number;
    /**
     * The latest base64 JPEG frame, or undefined when no NEW frame was encoded
     * since the last call (never returns duplicates). Sub-millisecond: one string
     * copy — drop the result straight into the Realtime `frame:<streamer>` payload.
     */
    getEncodedFrame: () => string | undefined;
};

/** Marks which field receives native exports (one decorated field per instance). */
const RemoteAssistanceStreamNativeFieldKey = Symbol.for("specsndk.clad.RemoteAssistanceStreamModule.nativeField");

/**
 * Loads **`../Modules/libRemoteAssistanceStreamModule.so`**, assigns exports to the **`@StreamNativeModule()`** field,
 * then calls **`onLoaded.call(self, exports)`**.
 */
async function loadStreamNativeModule(
    self: BaseScriptComponent,
    onLoaded: (this: BaseScriptComponent, lib: RemoteAssistanceStreamNativeExports) => void
): Promise<RemoteAssistanceStreamNativeExports | null> {
    const inst = self as any;
    const propKey = inst[RemoteAssistanceStreamNativeFieldKey] as string | symbol | undefined;
    if (propKey == null) {
        print(
            "StreamNativeModule.load: decorate a field with @" +
                "StreamNativeModule() before calling load()."
        );
        return null;
    }

    try {
        const asset = (await requireAsset("../../Modules/libRemoteAssistanceStreamModule.so")) as any;
        const exports = (await asset.load()) as RemoteAssistanceStreamNativeExports;
        inst[propKey] = exports;
        onLoaded.call(self, exports);
        return exports;
    } catch (err) {
        print("StreamNativeModule: failed to load libRemoteAssistanceStreamModule.so: " + err);
        inst[propKey] = null;
        return null;
    }
}

type StreamNativeModuleApi = (() => (_target: undefined, context: ClassFieldDecoratorContext) => void) & {
    load: typeof loadStreamNativeModule;
};

/**
 * **`@StreamNativeModule()`** — field decorator only: initializes the field to **`null`**
 * and records where **`load`** assigns exports. It does **not** load the `.so`.
 *
 * **`StreamNativeModule.load(this, onLoaded)`** — loads the library, assigns the field, then
 * **`onLoaded.call(this, exports)`** (use **`this.onNativeLibraryLoaded`** or any **`(lib) => { … }`**).
 */
export const StreamNativeModule: StreamNativeModuleApi = Object.assign(
    function StreamNativeModule(): (
        _target: undefined,
        context: ClassFieldDecoratorContext
    ) => void {
        return function (_target: undefined, context: ClassFieldDecoratorContext) {
            const propertyKey = context.name;

            context.addInitializer(function (this: BaseScriptComponent) {
                const inst = this as any;
                inst[propertyKey] = null;
                if (inst[RemoteAssistanceStreamNativeFieldKey] != null && inst[RemoteAssistanceStreamNativeFieldKey] !== propertyKey) {
                    print(
                        "StreamNativeModule: only one @StreamNativeModule() field is supported per instance."
                    );
                }
                inst[RemoteAssistanceStreamNativeFieldKey] = propertyKey;
            });
        };
    },
    { load: loadStreamNativeModule }
) as StreamNativeModuleApi;
