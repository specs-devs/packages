//
//  WebRTCCallManager.swift
//  FriendFinder
//
//  The phone side of the FriendFinder WebRTC call path (friend phone, role phoneB).
//  Two peer connections mirror the Glasses' native sessions (FriendFinderWebRTCModule):
//
//    pov   — Glasses OFFERS (H.264 camera + Opus mic). We ANSWER, render the
//            video track, and let the audio track play through libwebrtc
//            (which also runs echo cancellation against our own mic).
//    voice — WE OFFER our mic track (Opus, AEC/NS/AGC on); Glasses answers and
//            plays the decoded PCM.
//
//  Signaling rides the session's Realtime channel as rtc:<kind>:<from> events
//  (see FriendFinderTypes.ts / FriendFinderWebRTCSession.ts): we consume rtc:pov:glasses and
//  rtc:voice:glasses, and emit rtc:pov:phoneB / rtc:voice:phoneB. Media flows
//  peer-to-peer over RTP/SRTP — the 250 KB Realtime cap no longer applies.
//
//  Reconnect contract: the Glasses re-offers pov after ~8 s unconnected (every
//  offer gets a fresh answering PC here), and we re-offer voice whenever a new
//  pov offer arrives or our voice PC fails (the Glasses answers any fresh offer).
//
//  While either PC is connected the JPEG/WAV Realtime fallback stays quiet on
//  the wire (the Glasses stops sending it); FriendFinderModeModel keeps its handlers
//  registered so a WebRTC drop degrades back seamlessly.
//

import AVFoundation
import Combine
import Foundation
import WebRTC

@MainActor
final class WebRTCCallManager: NSObject, ObservableObject {
    /// A remote video frame has arrived — RemotePovView switches to the RTC view.
    @Published private(set) var povVideoLive = false
    /// Either PC is connected → WebRTC owns the phone's audio session;
    /// FriendFinderModeModel parks AudioChunkEngine while this is true.
    @Published private(set) var mediaLive = false
    /// Which camera the pov-return track is currently sending (drives the phone UI).
    @Published private(set) var usingFrontCamera = false
    /// Whether this phone's mic is muted (i.e. NOT transmitted to the Glasses).
    @Published private(set) var micMuted = false

    /// Fired when the peer (Glasses) ends the call via a cloud "bye". The owner
    /// (FriendFinderModeModel) tears the call down and clears the mode so all
    /// devices agree the call is over — even across networks.
    var onRemoteHangup: (() -> Void)?

    /// SDP/ICE mailbox over the Snap Cloud DB (PostgREST). Created per call in
    /// start(session:); each side inserts its signals and polls for the other's.
    private var mailbox: RtcSignalMailbox?

    /// The remote (Glasses POV) renderer, embedded by RTCVideoViewRepresentable.
    let remoteVideoView = RTCMTLVideoView(frame: .zero)
    /// Counts decoded inbound frames so "track live" (negotiation) can be told
    /// apart from real media actually arriving. Attached alongside the on-screen
    /// renderer in didAdd.
    private let frameCounter = InboundFrameCounter()

    private static let factory: RTCPeerConnectionFactory = {
        RTCInitializeSSL()
        return RTCPeerConnectionFactory(
            encoderFactory: RTCDefaultVideoEncoderFactory(),
            decoderFactory: RTCDefaultVideoDecoderFactory())
    }()

    private var povPC: RTCPeerConnection?
    private var voicePC: RTCPeerConnection?
    private var remoteVideoTrack: RTCVideoTrack?
    private var localAudioTrack: RTCAudioTrack?
    // The phone's front camera, added as a sendrecv track ON the POV answer so the
    // Glasses' DUPLEX video m-line carries it back (wearer sees friend). No separate
    // PC — it rides the POV connection that already works.
    private var povCamCapturer: RTCCameraVideoCapturer?
    private var povCamTrack: RTCVideoTrack?
    // Candidates that arrive before the matching remote description is set.
    private var pendingPovCandidates: [RTCIceCandidate] = []
    // Same buffering for voice: the Glasses' answer and its candidates are
    // separate async mailbox inserts, so a candidate row can land first —
    // pc.add() without a remote description fails and the candidate was
    // silently lost, starving voice ICE.
    private var pendingVoiceCandidates: [RTCIceCandidate] = []
    private var voiceRetryTask: Task<Void, Never>?
    private var running = false
    // Set per start(): a call uses the front camera + voice; Watch Your Back uses
    // the rear camera + no voice (the wearer's own phone → their Glasses, video only).
    private var cameraPosition: AVCaptureDevice.Position = .front
    private var voiceEnabled = true

    // ICE ufrag of the pov offer generation we're currently answering. A re-offer
    // carrying the SAME ufrag is an echo of that generation, so we IGNORE it rather
    // than tear down + rebuild — recreating the PC mid-handshake reset ICE and was a
    // prime cause of the never-connects churn. Only a NEW ufrag is a real generation.
    private var currentPovUfrag: String?
    // Candidates RECEIVED from the Glasses (0 ⇒ its ICE never reached us). Surfaced in
    // the diag snapshot so the failing direction is unambiguous.
    private var inPovCands = 0
    private var inVoiceCands = 0
    // Periodic diag writer (this phone's ICE view → DB, no IPs).
    private var diagTask: Task<Void, Never>?

    // TURN relay — REQUIRED for cross-network calls. The Glasses and the phone sit
    // on different subnets behind symmetric/corporate NAT, so STUN-only ICE finds
    // no workable candidate pair and never leaves `checking` (proven from the
    // exchanged candidate lines). A `relay` candidate is the only path that
    // connects. Fill these with APPROVED-INFRA credentials to enable it; empty ⇒
    // STUN-only (same-network / LAN calls only). Must mirror TURN_URL on the Glasses
    // (FriendFinderWebRTCSession.ts). See WEBRTC-CALL.md.
    private static let turnURL = ""   // e.g. "turn:turn.<approved-host>:3478?transport=udp"
    private static let turnUser = ""
    private static let turnCred = ""

    private static let stunConfig: RTCConfiguration = {
        let config = RTCConfiguration()
        var servers = [RTCIceServer(urlStrings: ["stun:stun.l.google.com:19302"])]
        if !turnURL.isEmpty {
            servers.append(RTCIceServer(
                urlStrings: [turnURL], username: turnUser, credential: turnCred))
        }
        config.iceServers = servers
        config.sdpSemantics = .unifiedPlan
        config.continualGatheringPolicy = .gatherContinually
        return config
    }()

    // MARK: - Lifecycle

    /// Start the WebRTC path. Defaults (front camera + voice) are the Call Friend
    /// case. Watch Your Back passes camera:.back, voiceEnabled:false so the wearer's
    /// OWN phone streams its rear camera to their Glasses with no audio. `me` is the
    /// signaling label the Glasses listens for — phoneB in both cases (the Glasses' pov
    /// session answers whichever phone speaks as phoneB).
    func start(session: String,
               me: String = StreamConfig.streamerFriend,
               camera: AVCaptureDevice.Position = .front,
               voiceEnabled: Bool = true) {
        guard !running else { return }
        running = true
        self.cameraPosition = camera
        self.usingFrontCamera = (camera == .front)
        self.voiceEnabled = voiceEnabled

        // Route call audio to the LOUDSPEAKER. libwebrtc's default iOS config
        // is playAndRecord on the EARPIECE — the Glasses mic was "silent" because
        // it played into the ear speaker while the phone was held at arm's
        // length. Overriding the template libwebrtc applies on activation (vs
        // setting AVAudioSession directly) survives its own reconfiguration.
        let audioConfig = RTCAudioSessionConfiguration.webRTC()
        audioConfig.category = AVAudioSession.Category.playAndRecord.rawValue
        audioConfig.categoryOptions = [.defaultToSpeaker, .allowBluetooth]
        audioConfig.mode = AVAudioSession.Mode.videoChat.rawValue
        RTCAudioSessionConfiguration.setWebRTC(audioConfig)

        // Mic permission: only the retired WAV path ever asked for it. Without
        // a grant, libwebrtc captures SILENCE while every connection indicator
        // stays green — the wearer hears nothing and no error fires anywhere.
        if voiceEnabled {
            switch AVAudioSession.sharedInstance().recordPermission {
            case .granted:
                break
            case .undetermined:
                AVAudioSession.sharedInstance().requestRecordPermission { granted in
                    print("[RTC] mic permission \(granted ? "granted" : "DENIED") (prompted at call start)")
                }
            case .denied:
                print("[RTC] mic permission DENIED — the Glasses will hear silence. "
                      + "Enable it in Settings > FriendFinder > Microphone.")
            @unknown default:
                break
            }
        }

        // Signaling over the Snap Cloud DB mailbox: inbound rows (pov offers/ICE,
        // voice answers/ICE from the Glasses) are polled and routed here; outbound
        // goes out via sendSignal → mailbox.send. We offer voice only for a call;
        // the Glasses offers pov on its own schedule.
        let box = RtcSignalMailbox(session: session, me: me) { [weak self] kind, sig in
            guard let self else { return }
            switch kind {
            case "pov": self.handlePovSignal(sig)
            case "voice": self.handleVoiceSignal(sig)
            case "bye": self.handleRemoteHangup()
            default: break
            }
        }
        mailbox = box
        box.start()
        if voiceEnabled { offerVoice() }
        startDiagLoop()
        print("[RTC] Call manager started (me=\(me), camera=\(camera == .back ? "back" : "front"), voice=\(voiceEnabled)).")
    }

    func stop() {
        running = false
        voiceRetryTask?.cancel()
        voiceRetryTask = nil
        diagTask?.cancel()
        diagTask = nil
        mailbox?.stop()
        mailbox = nil
        remoteVideoTrack?.remove(remoteVideoView)
        remoteVideoTrack = nil
        povCamCapturer?.stopCapture()
        povCamCapturer = nil
        povCamTrack = nil
        povPC?.close()
        povPC = nil
        voicePC?.close()
        voicePC = nil
        localAudioTrack = nil
        pendingPovCandidates = []
        pendingVoiceCandidates = []
        currentPovUfrag = nil
        inPovCands = 0
        inVoiceCands = 0
        povVideoLive = false
        mediaLive = false
    }

    // MARK: - pov (Glasses → phone): answer the offer, render video

    private func handlePovSignal(_ payload: [String: Any]) {
        guard running, let type = payload["t"] as? String else { return }
        switch type {
        case "offer":
            guard let sdp = payload["sdp"] as? String else { return }
            let ufrag = Self.iceUfrag(from: sdp)
            if let ufrag, ufrag == currentPovUfrag {
                // Echo / re-delivery of the generation we're already answering —
                // IGNORE. Candidates are durable mailbox rows so nothing is lost,
                // and rebuilding here is exactly what reset ICE mid-handshake and
                // starved the connection. Only a NEW ufrag is a real re-offer.
                return
            }
            currentPovUfrag = ufrag
            answerPovOffer(sdp)
            // NOTE: do NOT re-offer voice here. Voice has its own retry
            // (scheduleVoiceRetry) on actual PC failure; re-offering it on every
            // pov offer made the audio flap (connect → drop → reconnect).
        case "cand":
            guard let cand = payload["cand"] as? String else { return }
            inPovCands += 1
            let candidate = RTCIceCandidate(
                sdp: cand, sdpMLineIndex: 0, sdpMid: payload["mid"] as? String)
            if let pc = povPC, pc.remoteDescription != nil {
                pc.add(candidate) { _ in }
            } else {
                pendingPovCandidates.append(candidate)
            }
        default:
            break
        }
    }

    private func answerPovOffer(_ sdp: String) {
        remoteVideoTrack?.remove(remoteVideoView)
        remoteVideoTrack = nil
        povVideoLive = false
        povCamCapturer?.stopCapture()
        povCamCapturer = nil
        povCamTrack = nil
        povPC?.close()
        pendingPovCandidates = []

        guard let pc = Self.factory.peerConnection(
            with: Self.stunConfig, constraints: RTCMediaConstraints(
                mandatoryConstraints: nil, optionalConstraints: nil), delegate: self) else {
            print("[RTC] pov: peerConnection create failed")
            return
        }
        povPC = pc

        let offer = RTCSessionDescription(type: .offer, sdp: sdp)
        pc.setRemoteDescription(offer) { [weak self] error in
            Task { @MainActor [weak self] in
                guard let self, let pc = self.povPC else { return }
                if let error {
                    print("[RTC] pov setRemoteDescription failed: \(error)")
                    return
                }
                for cand in self.pendingPovCandidates { pc.add(cand) { _ in } }
                self.pendingPovCandidates = []
                // Fill the Glasses' duplex sendrecv video m-line with our front camera
                // (added AFTER setRemoteDescription so it binds to the offered
                // transceiver → the answer becomes sendrecv, sending our camera back).
                self.addPovReturnCamera(pc)
                pc.answer(for: RTCMediaConstraints(
                    mandatoryConstraints: nil, optionalConstraints: nil)) { answer, error in
                    Task { @MainActor [weak self] in
                        guard let self, let answer, error == nil else {
                            print("[RTC] pov answer failed: \(String(describing: error))")
                            return
                        }
                        self.povPC?.setLocalDescription(answer) { [weak self] error in
                            Task { @MainActor [weak self] in
                                guard let self, error == nil else { return }
                                self.sendSignal(kind: "pov", [
                                    "t": "answer", "sdp": answer.sdp,
                                ])
                                print("[RTC] pov answered.")
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - voice (phone → Glasses): offer our mic

    private func offerVoice() {
        guard running else { return }
        voicePC?.close()
        pendingVoiceCandidates = [] // buffered cands belong to the previous generation

        guard let pc = Self.factory.peerConnection(
            with: Self.stunConfig, constraints: RTCMediaConstraints(
                mandatoryConstraints: nil, optionalConstraints: nil), delegate: self) else {
            print("[RTC] voice: peerConnection create failed")
            return
        }
        voicePC = pc

        // Default audio processing = AEC + noise suppression + AGC: the
        // hand-tuned ×30 gain and echo pain of the WAV path go away here.
        let source = Self.factory.audioSource(with: RTCMediaConstraints(
            mandatoryConstraints: nil, optionalConstraints: nil))
        let track = Self.factory.audioTrack(with: source, trackId: "voice0")
        track.isEnabled = !micMuted // honor the current mute state across (re)offers
        localAudioTrack = track
        pc.add(track, streamIds: ["voice"])

        pc.offer(for: RTCMediaConstraints(
            mandatoryConstraints: nil, optionalConstraints: nil)) { [weak self] offer, error in
            Task { @MainActor [weak self] in
                guard let self, let offer, error == nil else {
                    print("[RTC] voice offer failed: \(String(describing: error))")
                    return
                }
                self.voicePC?.setLocalDescription(offer) { [weak self] error in
                    Task { @MainActor [weak self] in
                        guard let self, error == nil else { return }
                        self.sendSignal(kind: "voice", ["t": "offer", "sdp": offer.sdp])
                        print("[RTC] voice offered.")
                    }
                }
            }
        }
    }

    private func handleVoiceSignal(_ payload: [String: Any]) {
        guard running, let type = payload["t"] as? String, let pc = voicePC else { return }
        switch type {
        case "answer":
            guard let sdp = payload["sdp"] as? String else { return }
            pc.setRemoteDescription(RTCSessionDescription(type: .answer, sdp: sdp)) { [weak self] error in
                Task { @MainActor [weak self] in
                    guard let self else { return }
                    if let error {
                        print("[RTC] voice setRemoteDescription failed: \(error)")
                        return
                    }
                    if let pc = self.voicePC {
                        for cand in self.pendingVoiceCandidates { pc.add(cand) { _ in } }
                    }
                    if !self.pendingVoiceCandidates.isEmpty {
                        print("[RTC] voice flushed \(self.pendingVoiceCandidates.count) buffered candidate(s).")
                    }
                    self.pendingVoiceCandidates = []
                    print("[RTC] voice answer applied.")
                }
            }
        case "cand":
            guard let cand = payload["cand"] as? String else { return }
            inVoiceCands += 1
            let candidate = RTCIceCandidate(
                sdp: cand, sdpMLineIndex: 0, sdpMid: payload["mid"] as? String)
            if pc.remoteDescription != nil {
                pc.add(candidate) { _ in }
            } else {
                pendingVoiceCandidates.append(candidate)
            }
        default:
            break
        }
    }

    /// Debounced voice re-offer after a failure (fresh PC + fresh ICE).
    private func scheduleVoiceRetry() {
        guard running, voiceRetryTask == nil else { return }
        voiceRetryTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            self?.voiceRetryTask = nil
            self?.offerVoice()
        }
    }

    // MARK: - friend camera (phone → Glasses) on the DUPLEX POV m-line

    /// Add the phone's camera (front for a call, rear for Watch Your Back) as a sendrecv video track on the POV answer, so
    /// the Glasses' duplex video m-line receives it. Called inside answerPovOffer AFTER
    /// setRemoteDescription so the track binds to the offered transceiver. Codec is
    /// pinned to H.264 by the Glasses offerer (it offers only H.264).
    private func addPovReturnCamera(_ pc: RTCPeerConnection) {
        let source = Self.factory.videoSource()
        let capturer = RTCCameraVideoCapturer(delegate: source)
        povCamCapturer = capturer
        let track = Self.factory.videoTrack(with: source, trackId: "povcam0")
        povCamTrack = track
        pc.add(track, streamIds: ["povcam"])
        applyReturnVideoCap() // keep the quality preset across pov re-offers
        startPovCamCapture(capturer)
    }

    /// Gate on camera permission, then start the front camera at ~640 wide / ≤24 fps.
    private func startPovCamCapture(_ capturer: RTCCameraVideoCapturer) {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            beginPovCamCapture(capturer)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self, weak capturer] granted in
                Task { @MainActor in
                    guard let self, let capturer, self.running, self.povCamCapturer === capturer else { return }
                    if granted { self.beginPovCamCapture(capturer) }
                    else { print("[RTC] povcam: camera permission denied") }
                }
            }
        default:
            print("[RTC] povcam: camera not authorized — wearer will not see the friend")
        }
    }

    private func beginPovCamCapture(_ capturer: RTCCameraVideoCapturer) {
        let devices = RTCCameraVideoCapturer.captureDevices()
        guard let device = devices.first(where: { $0.position == self.cameraPosition })
            ?? devices.first else {
            print("[RTC] povcam: no camera device")
            return
        }
        let formats = RTCCameraVideoCapturer.supportedFormats(for: device)
        let target: Int32 = 640
        var best: AVCaptureDevice.Format?
        var bestErr = Int32.max
        for f in formats {
            let d = CMVideoFormatDescriptionGetDimensions(f.formatDescription)
            let err = abs(d.width - target)
            if err < bestErr { bestErr = err; best = f }
        }
        guard let format = best else { print("[RTC] povcam: no camera format"); return }
        let maxFps = format.videoSupportedFrameRateRanges.map { $0.maxFrameRate }.max() ?? 30
        capturer.startCapture(with: device, format: format, fps: Int(min(maxFps, 24))) { error in
            print("[RTC] povcam capture: \(error == nil ? "started" : String(describing: error))")
        }
    }

    /// Call-wide video-quality preset: cap the phone→Glasses return-camera
    /// bitrate to match the Glasses' POV encode (applied on the "quality-applied"
    /// ack so both directions always run the same preset). Remembered across
    /// pov re-offers — answerPovOffer re-applies it to the fresh sender.
    private var returnVideoMaxKbps: Int?

    func setReturnVideoMaxBitrate(kbps: Int) {
        returnVideoMaxKbps = kbps
        applyReturnVideoCap()
    }

    private func applyReturnVideoCap() {
        guard let kbps = returnVideoMaxKbps, let pc = povPC, let track = povCamTrack else { return }
        for sender in pc.senders where sender.track === track {
            let params = sender.parameters
            for enc in params.encodings {
                enc.maxBitrateBps = NSNumber(value: kbps * 1000)
            }
            sender.parameters = params
        }
        print("[RTC] return-camera max bitrate -> \(kbps) kbps")
    }

    /// Flip the streamed camera front↔back live — restarts the SAME capturer on
    /// the other device, so the WebRTC track keeps flowing (no renegotiation).
    func flipCamera() {
        guard running, let capturer = povCamCapturer else { return }
        cameraPosition = (cameraPosition == .back) ? .front : .back
        usingFrontCamera = (cameraPosition == .front)
        capturer.stopCapture { [weak self] in
            Task { @MainActor in
                guard let self, self.running, let capturer = self.povCamCapturer else { return }
                self.beginPovCamCapture(capturer)
            }
        }
    }

    /// Mute/unmute this phone's mic (whether voice is transmitted to the Glasses).
    /// Toggling isEnabled keeps the WebRTC track + connection up — it just sends
    /// silence — so there is no renegotiation.
    func setMicMuted(_ muted: Bool) {
        micMuted = muted
        localAudioTrack?.isEnabled = !muted
        print("[RTC] mic \(muted ? "muted" : "unmuted")")
    }

    /// End the call from THIS phone: tell the peer (Glasses) over the cloud mailbox
    /// ("bye" — reaches it on any network), THEN tear down. The send goes out
    /// before stop() while the mailbox is still alive.
    func hangup() {
        guard running else { return }
        mailbox?.send(kind: "bye", ["t": "bye"])
        print("[CallState] local hangup — sent bye, tearing down.")
        stop()
    }

    /// The peer (Glasses) hung up (a cloud "bye" arrived). Let the owner tear the
    /// call down and clear the mode; do NOT echo a bye back. Falls back to a
    /// direct stop() if no owner is wired.
    private func handleRemoteHangup() {
        guard running else { return }
        print("[CallState] remote bye received — ending call.")
        if let onRemoteHangup { onRemoteHangup() } else { stop() }
    }

    // MARK: - Helpers

    private func sendSignal(kind: String, _ payload: [String: Any]) {
        mailbox?.send(kind: kind, payload)
    }

    /// The ICE ufrag from an SDP — the natural per-generation token, since a
    /// fresh PeerConnection always mints a new one. nil if the line is absent.
    private static func iceUfrag(from sdp: String) -> String? {
        for line in sdp.split(whereSeparator: { $0 == "\n" || $0 == "\r" }) {
            if line.hasPrefix("a=ice-ufrag:") {
                return String(line.dropFirst("a=ice-ufrag:".count))
            }
        }
        return nil
    }

    /// Every 2 s, mirror this phone's ICE view to the DB (NO IPs) so a stuck call
    /// is diagnosable without an attached Xcode. povIce/voiceIce =
    /// RTCIceConnectionState raw (1 checking · 2 connected · 3 completed · 4 failed
    /// · 5 disconnected); inPov/inVoice = Glasses candidates that reached us (0 ⇒
    /// its ICE never arrived); frames = decoded POV frames.
    private func startDiagLoop() {
        diagTask?.cancel()
        diagTask = Task { @MainActor [weak self] in
            while !Task.isCancelled {
                guard let self, self.running else { break }
                let povIce = self.povPC?.iceConnectionState.rawValue ?? -1
                let voiceIce = self.voicePC?.iceConnectionState.rawValue ?? -1
                // View probe: the render view's actual layout size + whether it
                // is in a window. viewW/viewH of 0 with frames climbing = the
                // zero-size collapse; readable from the DB without a tether.
                let vs = self.remoteVideoView.bounds.size
                let json = "{\"r\":\"phoneB\",\"povIce\":\(povIce),\"voiceIce\":\(voiceIce),"
                    + "\"inPov\":\(self.inPovCands),\"inVoice\":\(self.inVoiceCands),"
                    + "\"frames\":\(self.frameCounter.frames),\"media\":\(self.mediaLive),"
                    + "\"viewW\":\(Int(vs.width)),\"viewH\":\(Int(vs.height)),"
                    + "\"inWin\":\(self.remoteVideoView.window != nil)}"
                self.mailbox?.sendDiag(json)
                try? await Task.sleep(nanoseconds: 2_000_000_000)
            }
        }
    }

    private func refreshLiveness() {
        let povUp = povPC?.connectionState == .connected
        let voiceUp = voicePC?.connectionState == .connected
        let live = povUp || voiceUp
        if live != mediaLive {
            mediaLive = live
            print("[RTC] mediaLive=\(live) (pov=\(povUp) voice=\(voiceUp))")
        }
    }
}

// MARK: - RTCPeerConnectionDelegate (worker threads → hop to main)

extension WebRTCCallManager: RTCPeerConnectionDelegate {
    nonisolated func peerConnection(_ pc: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {
        Task { @MainActor [weak self] in
            guard let self else { return }
            // Identify by IDENTITY. A candidate fired by a torn-down (stale) PC
            // would otherwise be mislabeled "voice" and pollute the live voice
            // channel with dead pov candidates — drop it instead.
            let kind: String
            if pc === self.povPC { kind = "pov" }
            else if pc === self.voicePC { kind = "voice" }
            else { return }
            // Log the candidate TYPE (host/srflx/relay) — an srflx proves a STUN
            // round-trip; host-only across networks/an isolating AP can't pair.
            let parts = candidate.sdp.split(separator: " ").map(String.init)
            let typ = parts.firstIndex(of: "typ").flatMap { parts.indices.contains($0 + 1) ? parts[$0 + 1] : nil } ?? "?"
            print("[RTC] \(kind) local cand: \(typ)")
            self.sendSignal(kind: kind, [
                "t": "cand",
                "cand": candidate.sdp,
                "mid": candidate.sdpMid ?? "",
            ])
        }
    }

    nonisolated func peerConnection(_ pc: RTCPeerConnection, didAdd rtpReceiver: RTCRtpReceiver,
                                    streams: [RTCMediaStream]) {
        Task { @MainActor [weak self] in
            guard let self else { return }
            if let video = rtpReceiver.track as? RTCVideoTrack {
                self.remoteVideoTrack?.remove(self.remoteVideoView)
                self.remoteVideoTrack?.remove(self.frameCounter)
                self.remoteVideoTrack = video
                video.add(self.remoteVideoView)
                video.add(self.frameCounter)
                self.povVideoLive = true
                print("[RTC] Glasses POV video track NEGOTIATED (H.264) — awaiting frames (watch 'inbound POV frames').")
            }
            // The Glasses mic audio track plays automatically (with AEC).
        }
    }

    nonisolated func peerConnection(_ pc: RTCPeerConnection,
                                    didChange newState: RTCPeerConnectionState) {
        Task { @MainActor [weak self] in
            guard let self else { return }
            let kind = (pc === self.povPC) ? "pov" : "voice"
            print("[RTC] \(kind) connectionState=\(newState.rawValue)")
            if pc === self.povPC, newState == .failed || newState == .disconnected {
                self.povVideoLive = false // Glasses re-offers; view falls back to JPEG
            }
            if pc === self.voicePC, newState == .failed {
                self.scheduleVoiceRetry()
            }
            self.refreshLiveness()
        }
    }

    // ICE connection state is the real "is the P2P path up?" signal — the pov
    // re-offer loop + no media means this never reaches connected/completed.
    nonisolated func peerConnection(_ pc: RTCPeerConnection, didChange newState: RTCIceConnectionState) {
        Task { @MainActor [weak self] in
            guard let self else { return }
            let kind = (pc === self.povPC) ? "pov" : "voice"
            print("[RTC] \(kind) iceConnectionState=\(newState.rawValue) (1=checking 2=connected 3=completed 4=failed 5=disconnected)")
        }
    }

    // Unused delegate requirements.
    nonisolated func peerConnection(_ pc: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {}
    nonisolated func peerConnection(_ pc: RTCPeerConnection, didAdd stream: RTCMediaStream) {}
    nonisolated func peerConnection(_ pc: RTCPeerConnection, didRemove stream: RTCMediaStream) {}
    nonisolated func peerConnectionShouldNegotiate(_ pc: RTCPeerConnection) {}
    nonisolated func peerConnection(_ pc: RTCPeerConnection, didChange newState: RTCIceGatheringState) {}
    nonisolated func peerConnection(_ pc: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {}
    nonisolated func peerConnection(_ pc: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {}
}

/// Counts decoded inbound video frames. `renderFrame` only fires when real
/// H.264 frames arrive and decode — so a nonzero count is the ground truth that
/// media is actually flowing (vs. a merely-negotiated track).
final class InboundFrameCounter: NSObject, RTCVideoRenderer {
    private var count = 0
    private var size: CGSize = .zero

    /// Decoded-frame count for the diag snapshot (benign cross-thread read).
    var frames: Int { count }

    func setSize(_ size: CGSize) {
        self.size = size
        print("[RTC] inbound POV frame size \(Int(size.width))x\(Int(size.height))")
    }

    func renderFrame(_ frame: RTCVideoFrame?) {
        count += 1
        if count == 1 || count % 30 == 0 {
            print("[RTC] inbound POV frames: \(count) (\(Int(size.width))x\(Int(size.height)))")
        }
        // Content probe: average luma on a 16×16 sample grid. Splits "the Glasses
        // sends black frames" (luma ~0-16) from "real video the UI isn't
        // showing" (luma varies) without needing eyes on the screen.
        if count % 120 == 1, let frame {
            let i420 = frame.buffer.toI420()
            let w = Int(i420.width), h = Int(i420.height)
            let stride = Int(i420.strideY)
            let data = i420.dataY
            var sum = 0, samples = 0
            var y = 0
            while y < h {
                var x = 0
                while x < w {
                    sum += Int(data[y * stride + x])
                    samples += 1
                    x += max(1, w / 16)
                }
                y += max(1, h / 16)
            }
            let avg = samples > 0 ? sum / samples : -1
            print("[RTC] inbound POV luma avg \(avg) (≤16 = black frames from Glasses)")
        }
    }
}
