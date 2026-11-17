//
//  MobileKitModel.swift
//  VideoCallS2M
//

import Combine
import Foundation
import SpectaclesKit

struct BondingData: Identifiable, Hashable {
    let id: String
}

final class VideoCallS2MAuthentication: Authentication {}

private let lensName = "VideoCallS2M"

final class MobileKitModel: ObservableObject {
    @Published var bondings: [BondingData] = []
    @Published var sessionStarted: Bool = false
    @Published var isConnected: Bool = false
    /// Bonding id the current session was started with (nil when stopped).
    @Published var activeBondingId: String?
    @Published var receivedMessage: String = ""
    @Published var lastError: String?
    @Published var lastTestSent: String?
    /// Mode control pushed by the Glasses Lens (sendData → .notify).
    @Published var receivedControl: VideoCallS2MControl?
    /// Call-request status from the Glasses (Lens sendOneShot → .notify):
    /// "ringing" | "accepted" | "declined" | "busy" | "missed". ContentView
    /// relays each one to the friend phone over multipeer.
    let callResponseSubject = PassthroughSubject<String, Never>()
    /// Video-quality preset applied by the Glasses (kbps). ContentView relays it
    /// to the friend phone over multipeer (UI mirror + return-camera cap).
    let qualityAppliedSubject = PassthroughSubject<Int, Never>()
    /// WebRTC signaling from the Glasses (Glasses → this bonded phone via .notify),
    /// a {type:"rtc",kind,from:"glasses",sig} envelope. ContentView (phoneA)
    /// relays it to the friend phone over multipeer. No Snap Cloud involved.
    @Published var receivedRtc: [String: Any]?

    private let bondingManager: any BondingManager
    private var currentSession: (any SpectaclesSession)?
    private var deeplinkStream: AsyncStream<URL>
    private var deeplinkContinuation: AsyncStream<URL>.Continuation
    private let locationSubject = PassthroughSubject<String, Never>()
    private let testSubject = PassthroughSubject<String, Never>()
    private let requestSubject = PassthroughSubject<String, Never>()
    /// phoneA → Glasses WebRTC signaling, yielded into the Lens "rtc" subscription.
    private let rtcSubject = PassthroughSubject<String, Never>()
    private var connectionTask: Task<Void, Never>?

    init() {
        let (stream, continuation) = AsyncStream<URL>.makeStream()
        deeplinkStream = stream
        deeplinkContinuation = continuation

        let clientId = Bundle.main.bundleIdentifier ?? "com.example.videocalls2m"
        bondingManager = BuilderFactory.create()
            .setIdentifier(ClientIdentifier(clientId: clientId, appName: "VideoCallS2M")!)
            .setVersion("1.0")
            .setAuth(VideoCallS2MAuthentication())
            .setBondingRedirectURL(URL(string: "videocalls2mapp://videocalls2m/")!)
            .build()

        getAllBonding()
    }

    func pushDeeplinkURL(url: URL) {
        deeplinkContinuation.yield(url)
    }

    func getAllBonding() {
        bondings.removeAll()
        // Dedupe: the repository can hand back the same id more than once
        // (observed: a doubled "…e80351" in the picker). Keep first occurrence.
        var seen = Set<String>()
        for bonding in bondingManager.availableBondings() where seen.insert(bonding.id).inserted {
            bondings.append(BondingData(id: bonding.id))
        }
        // Known-good pairing first — that's the one the user actually wants.
        if let lastGood = lastGoodBondingId,
           let idx = bondings.firstIndex(where: { $0.id == lastGood }), idx != 0 {
            bondings.insert(bondings.remove(at: idx), at: 0)
        }
    }

    /// Helper to map a saved bonding id back to a `Bonding` object.
    func availableBonding(id: String) -> (any Bonding)? {
        bondingManager.availableBondings().first { $0.id == id }
    }

    // MARK: - Last-good pairing (the SDK's Bonding carries only an opaque id,
    // so the app remembers which one last reached CONNECTED).

    private static let lastGoodKey = "videoCallS2M.lastGoodBondingId"

    var lastGoodBondingId: String? {
        UserDefaults.standard.string(forKey: Self.lastGoodKey)
    }

    private func rememberGoodBonding(_ id: String) {
        UserDefaults.standard.set(id, forKey: Self.lastGoodKey)
    }

    // MARK: - Nicknames (the SDK's Bonding exposes ONLY an opaque id, so the
    // picker is illegible with several stale pairings. Let the user name the
    // pair that actually connects; the name persists per id in UserDefaults.)

    private static let nicknameKey = "videoCallS2M.bondingNicknames"

    @Published var nicknames: [String: String] = MobileKitModel.loadNicknames()

    private static func loadNicknames() -> [String: String] {
        (UserDefaults.standard.dictionary(forKey: nicknameKey) as? [String: String]) ?? [:]
    }

    /// User-assigned name for a bonding id, or nil if none/blank.
    func nickname(for id: String) -> String? {
        let n = nicknames[id]?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (n?.isEmpty == false) ? n : nil
    }

    /// Set (empty string clears) the name for a bonding id.
    func setNickname(_ name: String, for id: String) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            nicknames.removeValue(forKey: id)
        } else {
            nicknames[id] = trimmed
        }
        UserDefaults.standard.set(nicknames, forKey: Self.nicknameKey)
    }

    /// The bonding a one-tap start should use: the last one that actually
    /// connected, else the only one available, else nil (user must pick).
    func preferredBonding() -> (any Bonding)? {
        if let lastGood = lastGoodBondingId, let b = availableBonding(id: lastGood) {
            return b
        }
        let all = bondingManager.availableBondings()
        return all.count == 1 ? all.first : nil
    }

    /// One-tap session start against the preferred bonding.
    /// Returns false when there is no unambiguous pairing to use.
    @discardableResult
    func startPreferredSession() -> Bool {
        guard !sessionStarted, let bonding = preferredBonding() else { return false }
        startSession(binding: bonding)
        return true
    }

    /// Cleanup for the stale-pairings pile: unbind everything except the
    /// last-good (or currently active) bonding.
    func forgetOtherBondings() {
        let keep = activeBondingId ?? lastGoodBondingId
        for bonding in bondingManager.availableBondings() where bonding.id != keep {
            unbind(id: bonding.id)
        }
    }

    /// Forget EVERY paired device. Manual / user-initiated only: each `unbind`
    /// is a deeplink round-trip (and likely a firmware chime), so this is never
    /// run automatically on launch — it backs the "Forget all paired devices"
    /// button for when the user wants a truly clean slate before re-bonding.
    func forgetAllBondings() {
        stopSession()
        UserDefaults.standard.removeObject(forKey: Self.lastGoodKey)
        for bonding in bondingManager.availableBondings() {
            unbind(id: bonding.id)
        }
    }

    func bind() {
        Task { @MainActor in
            let (stream, continuation) = AsyncStream<URL>.makeStream()
            deeplinkStream = stream
            deeplinkContinuation = continuation

            let request = BondingRequest.singleLensByName(lensName: lensName)
            let result = await bondingManager.bind(request: request, deeplinkAsyncStream: deeplinkStream)
            switch result {
            case let .success(newBonding):
                getAllBonding()
                print("[VideoCallS2M] newBonding: \(newBonding)")
                // One-tap "bond fresh": immediately connect to the pairing we
                // just created (it becomes last-good once it reaches .connected).
                if let b = availableBonding(id: newBonding.id) {
                    startSession(binding: b)
                }
            case let .failure(error):
                lastError = "Bind error: \(error)"
                print("[VideoCallS2M] bind error: \(error)")
            }
        }
    }

    func unbind(id: String) {
        Task { @MainActor in
            let (stream, continuation) = AsyncStream<URL>.makeStream()
            deeplinkStream = stream
            deeplinkContinuation = continuation
            let result = await bondingManager.unbind(id: id, deeplinkAsyncStream: deeplinkStream)
            switch result {
            case .success:
                setNickname("", for: id) // drop its name too
                getAllBonding()
                print("[VideoCallS2M] unbind: \(id)")
            case let .failure(error):
                lastError = "Unbind error: \(error)"
                print("[VideoCallS2M] unbind error: \(error)")
            }
        }
    }

    func startSession(binding: any Bonding) {
        Task { @MainActor in
            stopSession()
            do {
                let session = try bondingManager.createSession(
                    bonding: binding,
                    request: SessionRequest(autoReconnect: true, acceptUnfusedSpectacles: true, acceptUntrustedLenses: true),
                    delegateBuilder: { _ in self }
                )
                currentSession = session
                sessionStarted = true
                isConnected = false
                activeBondingId = binding.id

                connectionTask = Task { [weak self] in
                    for await status in session.connectionStatusStream {
                        guard let self = self else { return }
                        await MainActor.run {
                            switch status {
                            case .connected:
                                self.isConnected = true
                                // This pairing demonstrably works — make it
                                // the one-tap default from now on.
                                if let id = self.activeBondingId {
                                    self.rememberGoodBonding(id)
                                    self.getAllBonding()
                                }
                            case .connectStart:
                                self.isConnected = false
                            case .disconnected, .error:
                                self.isConnected = false
                            @unknown default:
                                break
                            }
                        }
                    }
                }
            } catch {
                lastError = "Session error: \(error)"
                print("[VideoCallS2M] session error: \(error)")
            }
        }
    }

    func stopSession() {
        connectionTask?.cancel()
        connectionTask = nil
        currentSession?.close(reason: nil)
        currentSession = nil
        sessionStarted = false
        isConnected = false
        activeBondingId = nil
    }

    private var lastStreamAt: [String: Date] = [:]

    /// Called by the UI when a new location payload should be streamed to GLASSES.
    @MainActor
    func streamLocation(role: String, payload: [String: Any]) {
        // Heading updates arrive many times per second; cap the per-role rate
        // so the BLE link to Glasses isn't flooded.
        let now = Date()
        if let last = lastStreamAt[role], now.timeIntervalSince(last) < 0.5 { return }
        lastStreamAt[role] = now

        var body = payload
        body["role"] = role
        guard let data = try? JSONSerialization.data(withJSONObject: body, options: []),
              let string = String(data: data, encoding: .utf8) else {
            return
        }
        locationSubject.send(string)
    }

    /// Forwards a friend phone's call request to the Lens over the "request"
    /// subscription (only meaningful on the bonded phone with a live session).
    /// Returns false when the Glasses session is down — the caller must NACK the
    /// friend phone instead of letting its "Calling…" spin into nothing.
    @MainActor
    @discardableResult
    func forwardCallRequest(name: String) -> Bool {
        guard isConnected else { return false }
        let payload: [String: Any] = ["type": "call-request", "name": name]
        guard let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
              let string = String(data: data, encoding: .utf8) else {
            return false
        }
        requestSubject.send(string)
        return true
    }

    /// Relay the friend's call-request cancel up to the Glasses (dialog dismissal).
    @MainActor
    func forwardCallCancel() {
        guard isConnected else { return }
        guard let data = try? JSONSerialization.data(withJSONObject: ["type": "call-cancel"]),
              let string = String(data: data, encoding: .utf8) else { return }
        requestSubject.send(string)
    }

    /// Relay the friend's video-quality request (kbps) up to the Glasses — the
    /// lens owns the setting, applies it, and acks with "quality-applied".
    @MainActor
    func forwardQualityRequest(kbps: Int) {
        guard isConnected else { return }
        guard let data = try? JSONSerialization.data(
                withJSONObject: ["type": "quality", "kbps": kbps] as [String: Any]),
              let string = String(data: data, encoding: .utf8) else { return }
        requestSubject.send(string)
    }

    /// Relay one WebRTC signaling message up to the Glasses over the "rtc"
    /// subscription (phoneA → Glasses). `payload` is a {type:"rtc",kind,from,sig}
    /// envelope originating from the friend phone.
    @MainActor
    func sendRtcToGlasses(_ payload: [String: Any]) {
        guard isConnected,
              let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
              let string = String(data: data, encoding: .utf8) else { return }
        rtcSubject.send(string)
    }

    /// Sends a plain-text message over the "test" subscription — the loopback
    /// path that proves phone → Glasses transport before any GPS logic runs.
    @MainActor
    func sendTestMessage(_ text: String) {
        guard isConnected, !text.isEmpty else { return }
        testSubject.send(text)
        lastTestSent = text
    }

    /// Ask the Glasses to leave the current VideoCallS2M mode — same as CHANGE MODES on
    /// the Lens. Rides the existing "request" channel as {type:"mode-exit"}.
    @MainActor
    func sendModeExit() {
        guard isConnected else { return }
        let payload: [String: Any] = ["type": "mode-exit"]
        guard let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
              let string = String(data: data, encoding: .utf8) else { return }
        requestSubject.send(string)
    }
}

extension MobileKitModel: SpectaclesRequestDelegate {
    nonisolated func processServiceRequest(_ request: SpectaclesRequest) async {
        switch request {
        case let .api(apiRequest):
            switch apiRequest {
            case let .call(callRequest):
                // Lens startSubscription(topic) arrives as a call whose SMKP path
                // (surfaced as `method` via the SMKPMessageHandler fix) is the
                // envelope word "subscribe", with the topic string as the BODY —
                // observed on-wire: path: "subscribe", body: "location"/"test".
                var topic = callRequest.method.trimmingCharacters(in: .whitespacesAndNewlines)
                if topic.isEmpty || topic == "GET" || topic == "subscribe" {
                    topic = String(data: callRequest.params, encoding: .utf8)?
                        .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                }
                print("[VideoCallS2M] Call request opened, topic: \"\(topic)\"")
                if topic == "location" {
                    let sendStream = makeStream()
                    for await message in sendStream {
                        callRequest.yield(message.data(using: .utf8)!, isComplete: false)
                    }
                } else if topic == "test" {
                    let sendStream = makeTestStream()
                    for await message in sendStream {
                        callRequest.yield(message.data(using: .utf8)!, isComplete: false)
                    }
                } else if topic == "request" {
                    let sendStream = makeRequestStream()
                    for await message in sendStream {
                        callRequest.yield(message.data(using: .utf8)!, isComplete: false)
                    }
                } else if topic == "rtc" {
                    let sendStream = makeRtcStream()
                    for await message in sendStream {
                        callRequest.yield(message.data(using: .utf8)!, isComplete: false)
                    }
                } else {
                    print("[VideoCallS2M] Unhandled call topic: \"\(topic)\"")
                }
            case let .notify(notifyRequest):
                // Glasses → phone control messages (mode selection) arrive here.
                if let json = try? JSONSerialization.jsonObject(with: notifyRequest.params) as? [String: Any],
                   let control = VideoCallS2MControl(json: json) {
                    Task { @MainActor in
                        self.receivedControl = control
                    }
                    print("[VideoCallS2M] VideoCallS2M control received: \(control.dict)")
                } else if let json = try? JSONSerialization.jsonObject(with: notifyRequest.params) as? [String: Any],
                          json["type"] as? String == "call-response" {
                    // Ringing/accepted/declined/busy/missed from the Glasses.
                    // The call itself still starts via the peopleFinder-control;
                    // these keep the friend phone's UI truthful meanwhile.
                    let status = json["status"] as? String
                        ?? ((json["accepted"] as? Bool ?? false) ? "accepted" : "declined")
                    Task { @MainActor in
                        self.callResponseSubject.send(status)
                    }
                    print("[VideoCallS2M] Call response from wearer: \(status)")
                } else if let json = try? JSONSerialization.jsonObject(with: notifyRequest.params) as? [String: Any],
                          json["type"] as? String == "quality-applied",
                          let kbps = json["kbps"] as? Int {
                    Task { @MainActor in
                        self.qualityAppliedSubject.send(kbps)
                    }
                    print("[VideoCallS2M] Video quality applied by Glasses: \(kbps) kbps")
                } else if let json = try? JSONSerialization.jsonObject(with: notifyRequest.params) as? [String: Any],
                          json["type"] as? String == "rtc" {
                    // WebRTC SDP/ICE from the Glasses — hand to ContentView to
                    // relay to the friend phone over multipeer.
                    Task { @MainActor in
                        self.receivedRtc = json
                    }
                } else {
                    print("[VideoCallS2M] notify: \(notifyRequest)")
                }
            }
        case let .asset(assetRequest):
            switch assetRequest {
            case let .load(asset):
                print("[VideoCallS2M] Load asset: \(asset)")
                asset.complete(throwing: SpectaclesRequestError.notFound)
            }
        }
    }

    private func makeStream() -> AsyncStream<String> {
        AsyncStream { continuation in
            let subscription = locationSubject.sink { value in
                continuation.yield(value)
            }
            continuation.onTermination = { _ in
                subscription.cancel()
            }
        }
    }

    private func makeTestStream() -> AsyncStream<String> {
        AsyncStream { continuation in
            let subscription = testSubject.sink { value in
                continuation.yield(value)
            }
            continuation.onTermination = { _ in
                subscription.cancel()
            }
        }
    }

    private func makeRequestStream() -> AsyncStream<String> {
        AsyncStream { continuation in
            let subscription = requestSubject.sink { value in
                continuation.yield(value)
            }
            continuation.onTermination = { _ in
                subscription.cancel()
            }
        }
    }

    private func makeRtcStream() -> AsyncStream<String> {
        AsyncStream { continuation in
            let subscription = rtcSubject.sink { value in
                continuation.yield(value)
            }
            continuation.onTermination = { _ in
                subscription.cancel()
            }
        }
    }
}
