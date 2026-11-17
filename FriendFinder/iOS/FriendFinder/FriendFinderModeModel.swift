//
//  FriendFinderModeModel.swift
//  FriendFinder
//
//  Owns the phone's role in the FriendFinder mode system. A control message from
//  the Glasses Lens arrives either over Mobile Kit (bonded phone → role phoneA)
//  or over multipeer (friend phone → role phoneB); this model joins the
//  session's Realtime channel and starts/stops the camera streamer and the
//  call audio engine accordingly. During a call it also decodes the Glasses
//  POV frames (frame:glasses) into `glassesFrame` for RemotePovView.
//

import AVFoundation
import Combine
import UIKit

@MainActor
final class FriendFinderModeModel: ObservableObject {
    @Published var control: FriendFinderControl?
    /// This phone's streamer id ("phoneA" bonded / "phoneB" friend), set by
    /// whichever transport delivered the control message.
    @Published var role: String?
    /// Latest Glasses POV frame during a call (friend phone only).
    @Published var glassesFrame: UIImage?

    let realtime = RealtimeClient()
    let frameStreamer = FrameStreamer()
    let audioEngine = AudioChunkEngine()
    /// WebRTC call path (preferred). While either of its peer connections is
    /// live, libwebrtc owns the audio session and AudioChunkEngine is parked.
    let callManager = WebRTCCallManager()

    init() {
        frameStreamer.realtime = realtime
        audioEngine.realtime = realtime
        // Call Friend is WebRTC-only now: its SDP/ICE is relayed over multipeer
        // (wired in ContentView via callManager.sendSignalRelay), media is P2P.
        // Snap Cloud / Realtime is used only by Watch Your Back.
        // A cloud "bye" from the Glasses ends the call on this phone too, so every
        // device agrees the call is over even when they are on different networks.
        callManager.onRemoteHangup = { [weak self] in
            self?.endCall(local: false)
        }
    }

    var isStreamingVideo: Bool {
        guard let control, let role else { return false }
        return control.shouldStreamVideo(as: role)
    }

    /// Friend phone in a call: sees the Glasses POV + exchanges audio.
    var isInCall: Bool {
        guard let control, let role else { return false }
        return control.call && role == StreamConfig.streamerFriend
    }

    func apply(_ control: FriendFinderControl, as role: String) {
        self.control = control
        self.role = role
        print("[FriendFinder] Control as \(role): wyb=\(control.wyb) call=\(control.call) " +
              "source=\(control.source) session=\(control.session)")

        // Both modes are WebRTC now, so nothing here uses the Supabase Realtime
        // channel (Call Friend never did; Watch Your Back moved off JPEG). WebRTC
        // signaling rides the Snap Cloud DB mailbox inside WebRTCCallManager.
        realtime.disconnect()
        frameStreamer.stop()

        if control.wyb && control.shouldStreamVideo(as: role) {
            // Watch Your Back: stream THIS phone's REAR camera to the wearer's own
            // Glasses over WebRTC, plus ONE-WAY audio (this phone's mic → Glasses, so
            // the wearer hears the phone's surroundings; toggle with the Mute
            // button). We answer the Glasses pov offer as "phoneB".
            callManager.start(session: control.session,
                              me: StreamConfig.streamerFriend,
                              camera: .back, voiceEnabled: true)
        } else if control.call && role == StreamConfig.streamerFriend {
            // Call Friend (friend phone): front camera + two-way Opus voice.
            callManager.start(session: control.session,
                              me: StreamConfig.streamerFriend,
                              camera: .front, voiceEnabled: true)
        } else {
            callManager.stop()
        }

        // The legacy base64/WAV call fallback is retired.
        audioEngine.stop()
        glassesFrame = nil
    }

    func stopAll() {
        callManager.stop()
        frameStreamer.stop()
        audioEngine.stop()
        realtime.disconnect()
        glassesFrame = nil
        control = nil
        role = nil
    }

    /// End the active call. `local` = this phone tapped End Call (send a bye to
    /// the Glasses); otherwise the Glasses already hung up (bye received). Drops only
    /// the call from the mode — Find/Watch Your Back stay if they were on — so the
    /// phone's mode state mirrors the Glasses. Clears the mode entirely if nothing
    /// is left active.
    func endCall(local: Bool) {
        if local { callManager.hangup() } else { callManager.stop() }
        audioEngine.stop()
        if let c = control {
            let next = c.with(call: false)
            control = (next.call || next.wyb || next.find) ? next : nil
            if control == nil { role = nil }
        }
        glassesFrame = nil
        let state = control.map { "wyb=\($0.wyb) call=\($0.call) find=\($0.find)" } ?? "none"
        print("[CallState] call ended (local=\(local)) — mode now \(state).")
    }
}
