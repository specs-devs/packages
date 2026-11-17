/**
 * SpecsNDK native bridge for libDecartWebRTCModule.so — types + field decorator + `load` for DecartWebRTCController.
 * When you add native exports, extend DecartWebRTCNativeExports (and call sites) alongside the C++ module.
 */

export type DecartWebRTCFrameRGBA = {
    buffer: ArrayBuffer;
    width: number;
    height: number;
};

/** Session state codes returned by getState() (mirrors swrtc_state + a streaming pseudo-state). */
export const enum DecartWebRTCState {
    New = 0,
    Connecting = 1,
    Connected = 2,
    Disconnected = 3,
    Failed = 4,
    Closed = 5,
    Streaming = 6,
}

/** One queued outbound signaling item drained by TS and sent to Decart's WebSocket. */
export type DecartWebRTCSignalingOut = {
    kind: "offer" | "answer" | "cand" | "none";
    sdp?: string;
    candidate?: string;
    mid?: string;
};

/**
 * Shape of JS values exported from the CoreJs native module (see assignNativeFunctions in C++).
 * Signaling is bridged through TS: native emits offer/ICE via getSignalingOut(); TS feeds
 * Decart's answer/ICE back via setRemoteAnswer()/addRemoteCandidate(). The prompt rides the
 * Decart WebSocket directly from TS (not through native).
 */
export type DecartWebRTCNativeExports = {
    ping: () => number;
    /** Create the swrtc session (manual signaling, offerer) + generate the offer. Returns swrtc_result (0 = ok). */
    startSession: (useH265: number, fps: number, bitrateKbps: number, cameraMaxWidth: number) => number;
    /** Tear the session + decoder + camera down. Returns 1. */
    stopSession: () => number;
    /** Apply Decart's SDP answer. Returns swrtc_result. */
    setRemoteAnswer: (sdp: string) => number;
    /** Add a remote ICE candidate. Returns swrtc_result. */
    addRemoteCandidate: (candidate: string, mid: string) => number;
    /** Drain one queued outbound signaling item (offer / ICE candidate). */
    getSignalingOut: () => DecartWebRTCSignalingOut;
    /** Poll the session state (see DecartWebRTCState). */
    getState: () => number;
    /** Ask Decart for a fresh keyframe (RTCP PLI) so the HW decoder re-syncs after packet-loss corruption. */
    requestKeyframe: () => number;
    /** Ask Decart to cap its downlink bitrate (kbps) via REMB — fewer/smaller packets → less Wi-Fi loss. */
    requestDownlinkKbps: (kbps: number) => number;
    /** Pull the latest transformed frame (decoded return track, or a live test gradient). */
    getFrameRGBA: () => DecartWebRTCFrameRGBA;
    /** Copy the latest decoded frame into a caller-owned PERSISTENT buffer (zero per-frame alloc). width 0 = no new frame. */
    pullFrameInto: (buffer: ArrayBuffer) => {width: number; height: number};
};

/** Marks which field receives native exports (one decorated field per instance). */
const DecartWebRTCNativeFieldKey = Symbol.for("specsndk.clad.DecartWebRTCModule.nativeField");

/**
 * Loads **`../NativeModules/libDecartWebRTCModule.so`**, assigns exports to the **`@DecartWebRTCNativeModule()`** field,
 * then calls **`onLoaded.call(self, exports)`**.
 */
async function loadDecartWebRTCNativeModule(
    self: BaseScriptComponent,
    onLoaded: (this: BaseScriptComponent, lib: DecartWebRTCNativeExports) => void
): Promise<DecartWebRTCNativeExports | null> {
    const inst = self as any;
    const propKey = inst[DecartWebRTCNativeFieldKey] as string | symbol | undefined;
    if (propKey == null) {
        print(
            "DecartWebRTCNativeModule.load: decorate a field with @" +
                "DecartWebRTCNativeModule() before calling load()."
        );
        return null;
    }

    try {
        try {
            // Bundling anchor: force libSpecsWebRTC.so (the module's NEEDED engine, not
            // referenced elsewhere in TS) to be packaged + extracted beside the module so
            // its dlopen resolves on device. It has no CoreJsOnLoad, so requireAsset only.
            await requireAsset("../NativeModules/libSpecsWebRTC.so");
        } catch (e) {
            print("DecartWebRTCNativeModule: engine bundling-anchor note: " + e);
        }
        const asset = (await requireAsset("../NativeModules/libDecartWebRTCModule.so")) as any;
        const exports = (await asset.load()) as DecartWebRTCNativeExports;
        inst[propKey] = exports;
        onLoaded.call(self, exports);
        return exports;
    } catch (err) {
        print("DecartWebRTCNativeModule: failed to load libDecartWebRTCModule.so: " + err);
        inst[propKey] = null;
        return null;
    }
}

type DecartWebRTCNativeModuleApi = (() => (_target: undefined, context: ClassFieldDecoratorContext) => void) & {
    load: typeof loadDecartWebRTCNativeModule;
};

/**
 * **`@DecartWebRTCNativeModule()`** — field decorator only: initializes the field to **`null`**
 * and records where **`load`** assigns exports. It does **not** load the `.so`.
 *
 * **`DecartWebRTCNativeModule.load(this, onLoaded)`** — loads the library, assigns the field, then
 * **`onLoaded.call(this, exports)`** (use **`this.onNativeLibraryLoaded`** or any **`(lib) => { … }`**).
 */
export const DecartWebRTCNativeModule: DecartWebRTCNativeModuleApi = Object.assign(
    function DecartWebRTCNativeModule(): (
        _target: undefined,
        context: ClassFieldDecoratorContext
    ) => void {
        return function (_target: undefined, context: ClassFieldDecoratorContext) {
            const propertyKey = context.name;

            context.addInitializer(function (this: BaseScriptComponent) {
                const inst = this as any;
                inst[propertyKey] = null;
                if (inst[DecartWebRTCNativeFieldKey] != null && inst[DecartWebRTCNativeFieldKey] !== propertyKey) {
                    print(
                        "DecartWebRTCNativeModule: only one @DecartWebRTCNativeModule() field is supported per instance."
                    );
                }
                inst[DecartWebRTCNativeFieldKey] = propertyKey;
            });
        };
    },
    { load: loadDecartWebRTCNativeModule }
) as DecartWebRTCNativeModuleApi;
