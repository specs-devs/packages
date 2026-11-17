// WebRTCController — loads libVideoCallS2SWebRTCModule.so at Lens start and
// publishes its exports as a static so CallStreamer can run the WebRTC media
// path. In the Lens Studio preview (or before the .so is deployed) loading fails
// gracefully and `WebRTCController.native` stays null — the call UI still works,
// the media simply reports "device only". Lives on its own SceneObject under
// the ▸ WebRTC · NDK object of the prefab.

import {
    S2S_MODULE_GENERATION,
    WebRTCNativeModule,
    type VideoCallS2SWebRTCNativeExports,
} from "./WebRTCNativeModule"

@component
export class WebRTCController extends BaseScriptComponent {
    /** Native exports once loaded (device only); null in preview / before build. */
    static native: VideoCallS2SWebRTCNativeExports | null = null

    @WebRTCNativeModule()
    private nativeExports: VideoCallS2SWebRTCNativeExports | null = null

    onAwake() {
        WebRTCNativeModule.load(this, this.onNativeLibraryLoaded)
    }

    /** Runs as **`onNativeLibraryLoaded.call(this, lib)`** after **`load`** assigns the field. */
    protected onNativeLibraryLoaded(lib: VideoCallS2SWebRTCNativeExports) {
        if (!lib) {
            print("[VideoCallS2SWebRTC] Native module unavailable (preview?) — media runs on device only.")
            return
        }
        WebRTCController.native = lib
        const gen = lib.ping()
        print("[VideoCallS2SWebRTC] Native module loaded, generation " + gen +
            (gen >= S2S_MODULE_GENERATION ? " (Glasses ↔ Glasses capable)."
                : " — TOO OLD for Glasses ↔ Glasses calls: rebuild VideoCallS2SWebRTCModule."))
        // One-shot UDP egress probe to a public STUN port: tells us whether the
        // native sandbox can send UDP to the internet at all (STUN/ICE needs it).
        try {
            const probe = lib.udpProbe(8, 8, 8, 8, 19302)
            print("[VideoCallS2SWebRTC] UDP egress probe -> " + probe +
                (probe >= 0 ? " (OK)" : " (BLOCKED — STUN/ICE cannot traverse)"))
        } catch (e) {
            print("[VideoCallS2SWebRTC] UDP egress probe threw: " + e)
        }
    }
}
