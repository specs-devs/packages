//
//  RtcSignalMailbox.swift
//  VideoCallS2M
//
//  WebRTC signaling over the Snap Cloud Postgres REST API (PostgREST/HTTPS).
//  Mirrors the Lens-side VideoCallS2MRtcMailbox.ts: each peer INSERTs its outbound
//  SDP/ICE as rows in `rtc_signals` and POLLs for the other peer's rows. This
//  avoids the broken Realtime WebSocket and the unstable BLE relay — the DB
//  REST API works reliably on device. Media stays peer-to-peer WebRTC.
//
//  Auth: uses the public anon key directly (role `anon`); the prototype RLS
//  policy on rtc_signals allows anon insert/select, so no GoTrue sign-in is
//  needed here.
//

import Foundation

@MainActor
final class RtcSignalMailbox {
    /// (kind, sig) — kind is "pov"/"voice"; sig carries t/sdp/cand/mid.
    typealias SignalHandler = (_ kind: String, _ sig: [String: Any]) -> Void

    private let session: String
    private let me: String
    private let onSignal: SignalHandler

    private let restBase = StreamConfig.supabaseURL + "/rest/v1/rtc_signals"
    private let apiKey = StreamConfig.anonKey
    private let urlSession = URLSession(configuration: .ephemeral)

    private var readCursor = 0
    private var pollTask: Task<Void, Never>?
    private var running = false

    private static let pollInterval: UInt64 = 400_000_000 // 0.4 s

    init(session: String, me: String, onSignal: @escaping SignalHandler) {
        self.session = session
        self.me = me
        self.onSignal = onSignal
    }

    func start() {
        guard !running else { return }
        running = true
        pollTask = Task { [weak self] in
            await self?.seedCursor()
            while !Task.isCancelled, self?.running == true {
                await self?.poll()
                try? await Task.sleep(nanoseconds: RtcSignalMailbox.pollInterval)
            }
        }
        print("[RtcMailbox] Started (session \(session), me \(me)).")
    }

    func stop() {
        running = false
        pollTask?.cancel()
        pollTask = nil
    }

    /// Insert one outbound signaling row.
    func send(kind: String, _ sig: [String: Any]) {
        guard running else { return }
        var row: [String: Any] = ["session": session, "kind": kind, "sender": me]
        if let t = sig["t"] as? String { row["t"] = t }
        if let sdp = sig["sdp"] as? String { row["sdp"] = sdp }
        if let cand = sig["cand"] as? String { row["cand"] = cand }
        if let mid = sig["mid"] as? String { row["mid"] = mid }
        insertRow(row)
    }

    /// Fire-and-forget diagnostic snapshot (ICE states + candidate counts as
    /// JSON in the `sdp` column, NO IPs). Read back off-device via a
    /// `kind=eq.diag` REST query so a stuck call's phone side is diagnosable
    /// without an attached Xcode. The Glasses' poller has no "diag" handler, so
    /// this carries no signaling meaning.
    func sendDiag(_ state: String) {
        guard running else { return }
        insertRow(["session": session, "kind": "diag", "sender": me, "t": "diag", "sdp": state])
    }

    private func insertRow(_ row: [String: Any]) {
        guard let url = URL(string: restBase),
              let body = try? JSONSerialization.data(withJSONObject: row, options: []) else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(apiKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        req.httpBody = body
        urlSession.dataTask(with: req) { _, response, error in
            if let error {
                print("[RtcMailbox] insert failed: \(error.localizedDescription)")
            } else if let http = response as? HTTPURLResponse, http.statusCode >= 300 {
                print("[RtcMailbox] insert HTTP \(http.statusCode)")
            }
        }.resume()
    }

    // MARK: - Polling

    /// Ignore rows that already exist for this session before we joined.
    private func seedCursor() async {
        let q = "?session=eq.\(session)&order=id.desc&limit=1&select=id"
        if let rows = await get(q), let first = rows.first, let id = first["id"] as? Int {
            readCursor = id
        }
    }

    private func poll() async {
        let q = "?session=eq.\(session)&sender=neq.\(me)&id=gt.\(readCursor)&order=id.asc&limit=50"
        guard let rows = await get(q) else { return }
        for r in rows {
            if let id = r["id"] as? Int, id > readCursor { readCursor = id }
            guard let kind = r["kind"] as? String else { continue }
            var sig: [String: Any] = [:]
            if let t = r["t"] as? String { sig["t"] = t }
            if let sdp = r["sdp"] as? String { sig["sdp"] = sdp }
            if let cand = r["cand"] as? String { sig["cand"] = cand }
            if let mid = r["mid"] as? String { sig["mid"] = mid }
            onSignal(kind, sig)
        }
    }

    private func get(_ query: String) async -> [[String: Any]]? {
        guard let url = URL(string: restBase + query) else { return nil }
        var req = URLRequest(url: url)
        req.setValue(apiKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        do {
            let (data, response) = try await urlSession.data(for: req)
            if let http = response as? HTTPURLResponse, http.statusCode >= 300 {
                print("[RtcMailbox] poll HTTP \(http.statusCode)")
                return nil
            }
            return (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]]
        } catch {
            return nil // transient network error — next poll retries
        }
    }
}
