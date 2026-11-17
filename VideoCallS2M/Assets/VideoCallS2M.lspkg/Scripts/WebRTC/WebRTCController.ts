// WebRTCController — loads libVideoCallS2MWebRTCModule.so at Lens start and
// publishes its exports as a static so CallStreamer can pick the WebRTC
// media path. On preview (or before the .so is built/deployed) loading fails
// gracefully and `WebRTCController.native` stays null — the call runs
// on the JPEG/WAV Realtime path exactly as before. Attach to the scene as its
// own SceneObject (next to StreamController).

import {
    WebRTCNativeModule,
    type VideoCallS2MWebRTCNativeExports,
} from "./WebRTCNativeModule"

@component
export class WebRTCController extends BaseScriptComponent {
    /** Native exports once loaded (device only); null in preview / before build. */
    static native: VideoCallS2MWebRTCNativeExports | null = null

    @WebRTCNativeModule()
    private nativeExports: VideoCallS2MWebRTCNativeExports | null = null

    onAwake() {
        WebRTCNativeModule.load(this, this.onNativeLibraryLoaded)
    }

    /** Runs as **`onNativeLibraryLoaded.call(this, lib)`** after **`load`** assigns the field. */
    protected onNativeLibraryLoaded(lib: VideoCallS2MWebRTCNativeExports) {
        if (!lib) {
            print("[VideoCallS2MWebRTC] Native module unavailable (preview?) — Realtime JPEG/WAV fallback.")
            return
        }
        WebRTCController.native = lib
        print("[VideoCallS2MWebRTC] Native module loaded, ping -> " + lib.ping())
        // One-shot UDP egress probe to a public IP (8.8.8.8:19302). This is the
        // single most-unverified assumption in the whole call path: whether the
        // Glasses native sandbox is even allowed to send a UDP datagram to the
        // internet. Result: >=0 = bytes sent OK (raw egress path open, so STUN
        // *can* work); <0 = blocked at the socket layer (-(1000+errno) create,
        // -(2000+errno) sendto) → STUN/ICE can never traverse → LAN-only, every
        // media leg dies once the peers are on different networks.
        try {
            const probe = lib.udpProbe(8, 8, 8, 8, 19302)
            print("[VideoCallS2MWebRTC] UDP egress probe (8.8.8.8:19302) -> " + probe +
                (probe >= 0 ? " (OK — sandbox permits UDP egress)"
                    : " (BLOCKED — STUN/ICE cannot traverse to the internet)"))
        } catch (e) {
            print("[VideoCallS2MWebRTC] UDP egress probe threw: " + e)
        }
    }
}
