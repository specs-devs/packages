//
//  ControlLobby.swift
//  FriendFinder
//
//  Cloud fallback for the Glasses → friend-phone control relay. The primary
//  path is multipeer (phoneA forwards the Mobile Kit control to nearby
//  peers), but MultipeerConnectivity discovery is slow/unstable on corporate
//  WiFi and while a phone is running a hotspot — which blocked call testing
//  entirely. This lobby mirrors every control through the Snap Cloud DB
//  (same `rtc_signals` table the WebRTC mailbox already uses reliably on any
//  network): the WEARER's phone publishes each control it receives, the
//  FRIEND's phone polls the newest one. Multipeer remains the fast path;
//  whichever copy arrives first wins (apply is deduped by the caller's mode
//  state — reapplying an identical control is a no-op start()/stop()).
//
//  The lobby is a single well-known session row-space (prototype: one lobby
//  for everyone on this Snap Cloud project). Controls older than
//  FRESHNESS_S are ignored so a stale `call=true` from a long-dead run can't
//  start a phantom call — the same lesson as the mailbox's stale-bye filter.
//

import Foundation

@MainActor
final class ControlLobby: ObservableObject {
    private static let lobbySession = "wrp-control-lobby"
    /// Ignore lobby controls older than this (stale-run protection).
    private static let freshnessS: TimeInterval = 300
    private static let pollInterval: UInt64 = 1_500_000_000 // 1.5 s

    private let restBase = StreamConfig.supabaseURL + "/rest/v1/rtc_signals"
    private let apiKey = StreamConfig.anonKey
    private let urlSession = URLSession(configuration: .ephemeral)

    private var pollTask: Task<Void, Never>?
    private var lastSeenId = 0
    private var polling = false

    private static let isoParser: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    /// Wearer's phone: mirror a Glasses control into the lobby (fire-and-forget).
    func publish(_ control: FriendFinderControl) {
        guard let body = try? JSONSerialization.data(withJSONObject: control.dict),
              let json = String(data: body, encoding: .utf8) else { return }
        let row: [String: Any] = [
            "session": Self.lobbySession, "kind": "control",
            "sender": StreamConfig.streamerBonded, "t": "control", "sdp": json,
        ]
        guard let url = URL(string: restBase),
              let rowBody = try? JSONSerialization.data(withJSONObject: row) else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(apiKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        req.httpBody = rowBody
        urlSession.dataTask(with: req) { _, response, error in
            if let error {
                print("[ControlLobby] publish failed: \(error.localizedDescription)")
            } else if let http = response as? HTTPURLResponse, http.statusCode >= 300 {
                print("[ControlLobby] publish HTTP \(http.statusCode)")
            }
        }.resume()
    }

    /// Friend's phone: poll the newest lobby control and hand fresh ones to
    /// `onControl`. Safe to call repeatedly; restarts the loop.
    func startPolling(onControl: @escaping (FriendFinderControl) -> Void) {
        guard !polling else { return }
        polling = true
        pollTask = Task { [weak self] in
            while !Task.isCancelled, self?.polling == true {
                await self?.poll(onControl)
                try? await Task.sleep(nanoseconds: ControlLobby.pollInterval)
            }
        }
        print("[ControlLobby] Polling for controls (cloud fallback for multipeer).")
    }

    func stopPolling() {
        polling = false
        pollTask?.cancel()
        pollTask = nil
    }

    private func poll(_ onControl: (FriendFinderControl) -> Void) async {
        let q = "?session=eq.\(Self.lobbySession)&kind=eq.control"
            + "&order=id.desc&limit=1&select=id,sdp,created_at"
        guard let url = URL(string: restBase + q) else { return }
        var req = URLRequest(url: url)
        req.setValue(apiKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        guard let (data, response) = try? await urlSession.data(for: req),
              (response as? HTTPURLResponse).map({ $0.statusCode < 300 }) ?? false,
              let rows = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]],
              let row = rows.first,
              let id = row["id"] as? Int, id > lastSeenId else { return }
        lastSeenId = id // consume even if stale/undecodable — never retry a row
        guard let createdAt = (row["created_at"] as? String).flatMap(Self.isoParser.date(from:)),
              Date().timeIntervalSince(createdAt) < Self.freshnessS else {
            print("[ControlLobby] Skipping stale lobby control (row \(id)).")
            return
        }
        guard let sdp = row["sdp"] as? String,
              let obj = (try? JSONSerialization.jsonObject(with: Data(sdp.utf8))) as? [String: Any],
              let control = FriendFinderControl(json: obj) else { return }
        print("[ControlLobby] Control received via cloud (row \(id)).")
        onControl(control)
    }
}
