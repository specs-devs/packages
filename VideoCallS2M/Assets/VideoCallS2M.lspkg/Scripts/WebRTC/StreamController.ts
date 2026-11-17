// StreamController — loads libVideoCallS2MStreamModule.so at Lens start and
// publishes its exports as a static so CallStreamer can pick the native
// video path. On preview (or before the .so is built/deployed) loading fails
// gracefully and `StreamController.native` stays null — consumers fall
// back to the JS capture path. Attached to the scene as its own SceneObject.

import {
    StreamNativeModule,
    type VideoCallS2MStreamNativeExports,
} from "./StreamNativeModule";

@component
export class StreamController extends BaseScriptComponent {
    /** Native exports once loaded (device only); null in preview / before build. */
    static native: VideoCallS2MStreamNativeExports | null = null;

    @StreamNativeModule()
    private nativeExports: VideoCallS2MStreamNativeExports | null = null;

    onAwake() {
        StreamNativeModule.load(this, this.onNativeLibraryLoaded);
    }

    /** Runs as **`onNativeLibraryLoaded.call(this, lib)`** after **`load`** assigns the decorated field. */
    protected onNativeLibraryLoaded(lib: VideoCallS2MStreamNativeExports) {
        if (!lib) {
            // Preview: the ARM .so resolves as an asset but only loads on device.
            print("[VideoCallS2MStream] Native module unavailable (preview?) — JS capture fallback.");
            return;
        }
        StreamController.native = lib;
        print("[VideoCallS2MStream] Native module loaded, ping -> " + lib.ping());
    }
}
