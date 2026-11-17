//
//  RealtimeClient.swift
//  VideoCallS2M
//
//  Minimal Supabase Realtime (Phoenix channels) client for the VideoCallS2M
//  streaming pipeline. Speaks the same broadcast protocol as the Lens side
//  (Assets/Scripts/VideoCallS2MRealtime.ts): one channel per session
//  (realtime:pov-<session>), events `frame:<streamer>` / `audio:<streamer>`.
//
//  Hand-rolled over URLSessionWebSocketTask instead of pulling in
//  supabase-swift — broadcast-only needs just join, heartbeat, and push.
//  Phoenix JSON serializer (vsn=1.0.0). Reconnects with backoff and rejoins.
//

import Combine
import Foundation

final class RealtimeClient: NSObject, ObservableObject {
    /// True once the channel join was acknowledged (safe to send).
    @Published private(set) var isConnected = false

    private var socketTask: URLSessionWebSocketTask?
    private lazy var urlSession = URLSession(
        configuration: .default, delegate: self, delegateQueue: .main)

    private var sessionCode = ""
    private var topic = ""
    private var shouldRun = false
    private var joined = false
    private var refCounter = 0
    private var joinRef = ""
    private var handlers: [String: ([String: Any]) -> Void] = [:]
    private var heartbeatTimer: Timer?
    private var reconnectAttempt = 0

    // MARK: - Public API

    /// Connect and join the session channel. Safe to call repeatedly with the
    /// same session; a new session tears the old channel down first.
    func connect(session: String) {
        if shouldRun && session == sessionCode { return }
        disconnect()
        sessionCode = session
        topic = StreamConfig.channelTopic(session: session)
        shouldRun = true
        reconnectAttempt = 0
        openSocket()
    }

    func disconnect() {
        shouldRun = false
        joined = false
        isConnected = false
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
        socketTask?.cancel(with: .goingAway, reason: nil)
        socketTask = nil
    }

    /// Register the handler for a broadcast event (e.g. "frame:glasses").
    /// Handlers run on the main queue.
    func on(_ event: String, _ handler: @escaping ([String: Any]) -> Void) {
        handlers[event] = handler
    }

    func off(_ event: String) {
        handlers.removeValue(forKey: event)
    }

    /// Broadcast a payload on the channel. Silently dropped until joined.
    /// `completion` (optional) fires on the main queue once the frame left the
    /// socket (or failed) — senders use it to cap in-flight messages so live
    /// media drops frames instead of queueing lag.
    func send(event: String, payload: [String: Any], completion: ((Bool) -> Void)? = nil) {
        guard joined, let task = socketTask else {
            if let completion { DispatchQueue.main.async { completion(false) } }
            return
        }
        let message: [String: Any] = [
            "topic": topic,
            "event": "broadcast",
            "payload": [
                "type": "broadcast",
                "event": event,
                "payload": payload,
            ],
            "ref": nextRef(),
            "join_ref": joinRef,
        ]
        push(message, over: task, completion: completion)
    }

    // MARK: - Socket lifecycle

    private func openSocket() {
        let task = urlSession.webSocketTask(with: StreamConfig.realtimeSocketURL)
        socketTask = task
        task.resume()
        receiveLoop(task)
        joinChannel(task)
        startHeartbeat()
    }

    private func joinChannel(_ task: URLSessionWebSocketTask) {
        joinRef = nextRef()
        let join: [String: Any] = [
            "topic": topic,
            "event": "phx_join",
            "payload": [
                "config": [
                    "broadcast": ["self": false, "ack": false],
                    "presence": ["key": ""],
                    "postgres_changes": [],
                ],
                "access_token": StreamConfig.anonKey,
            ],
            "ref": joinRef,
            "join_ref": joinRef,
        ]
        push(join, over: task)
    }

    private func startHeartbeat() {
        heartbeatTimer?.invalidate()
        // Mirrors the Lens client's Snap Cloud alpha workaround (2.5 s).
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 2.5, repeats: true) { [weak self] _ in
            guard let self, let task = self.socketTask else { return }
            self.push([
                "topic": "phoenix",
                "event": "heartbeat",
                "payload": [:] as [String: Any],
                "ref": self.nextRef(),
            ], over: task)
        }
    }

    private func receiveLoop(_ task: URLSessionWebSocketTask) {
        task.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let message):
                self.handle(message)
                if task === self.socketTask { self.receiveLoop(task) }
            case .failure:
                DispatchQueue.main.async { self.scheduleReconnect() }
            }
        }
    }

    private func scheduleReconnect() {
        guard shouldRun else { return }
        joined = false
        isConnected = false
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
        socketTask?.cancel(with: .abnormalClosure, reason: nil)
        socketTask = nil
        let delay = min(pow(2.0, Double(reconnectAttempt)), 10.0)
        reconnectAttempt += 1
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self, self.shouldRun, self.socketTask == nil else { return }
            self.openSocket()
        }
    }

    // MARK: - Message handling

    private func handle(_ message: URLSessionWebSocketTask.Message) {
        let data: Data?
        switch message {
        case .string(let text): data = text.data(using: .utf8)
        case .data(let raw): data = raw
        @unknown default: data = nil
        }
        guard let data,
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let event = object["event"] as? String else { return }

        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            switch event {
            case "phx_reply":
                let ref = object["ref"] as? String
                let status = (object["payload"] as? [String: Any])?["status"] as? String
                if ref == self.joinRef {
                    if status == "ok" {
                        self.joined = true
                        self.isConnected = true
                        self.reconnectAttempt = 0
                        print("[Realtime] Joined \(self.topic)")
                    } else {
                        print("[Realtime] Join failed: \(object)")
                        self.scheduleReconnect()
                    }
                }
            case "broadcast":
                guard let envelope = object["payload"] as? [String: Any],
                      let innerEvent = envelope["event"] as? String,
                      let innerPayload = envelope["payload"] as? [String: Any] else { return }
                self.handlers[innerEvent]?(innerPayload)
            case "phx_error", "phx_close":
                self.scheduleReconnect()
            default:
                break
            }
        }
    }

    // MARK: - Helpers

    private func nextRef() -> String {
        refCounter += 1
        return String(refCounter)
    }

    private func push(_ message: [String: Any], over task: URLSessionWebSocketTask,
                      completion: ((Bool) -> Void)? = nil) {
        guard let data = try? JSONSerialization.data(withJSONObject: message),
              let text = String(data: data, encoding: .utf8) else {
            if let completion { DispatchQueue.main.async { completion(false) } }
            return
        }
        task.send(.string(text)) { [weak self] error in
            DispatchQueue.main.async {
                if error != nil { self?.scheduleReconnect() }
                completion?(error == nil)
            }
        }
    }
}

extension RealtimeClient: URLSessionWebSocketDelegate {
    func urlSession(
        _ session: URLSession, webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?
    ) {
        DispatchQueue.main.async { [weak self] in self?.scheduleReconnect() }
    }
}
