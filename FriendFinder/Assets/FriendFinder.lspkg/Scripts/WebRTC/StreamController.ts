// StreamController — loads libFriendFinderStreamModule.so at Lens start and
// publishes its exports as a static so CallStreamer can pick the native
// video path. On preview (or before the .so is built/deployed) loading fails
// gracefully and `StreamController.native` stays null — consumers fall
// back to the JS capture path. Attached to the scene as its own SceneObject.

import {
    StreamNativeModule,
    type FriendFinderStreamNativeExports,
} from "./StreamNativeModule";

@component
export class StreamController extends BaseScriptComponent {
    /** Native exports once loaded (device only); null in preview / before build. */
    static native: FriendFinderStreamNativeExports | null = null;

    @StreamNativeModule()
    private nativeExports: FriendFinderStreamNativeExports | null = null;

    onAwake() {
        StreamNativeModule.load(this, this.onNativeLibraryLoaded);
    }

    /** Runs as **`onNativeLibraryLoaded.call(this, lib)`** after **`load`** assigns the decorated field. */
    protected onNativeLibraryLoaded(lib: FriendFinderStreamNativeExports) {
        if (!lib) {
            // Preview: the ARM .so resolves as an asset but only loads on device.
            print("[FriendFinderStream] Native module unavailable (preview?) — JS capture fallback.");
            return;
        }
        StreamController.native = lib;
        print("[FriendFinderStream] Native module loaded, ping -> " + lib.ping());
    }
}
