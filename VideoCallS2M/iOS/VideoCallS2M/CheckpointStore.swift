//
//  CheckpointStore.swift
//  VideoCallS2M
//
//  Checkpoints + "was here" notifications over the Snap Cloud Postgres REST API,
//  mirroring the Lens-side CloudCheckpoints.ts. The phone MARKS checkpoints
//  (INSERT into `checkpoints`) and POLLS `checkpoint_visits` for the session,
//  raising an in-app banner when someone enters one. Geofence *detection* runs
//  on the Glasses (it logs both users' fixes); this side just marks + notifies.
//
//  Transport is PostgREST polling (not the Realtime WebSocket — it doesn't reach
//  device reliably, see RtcSignalMailbox). "In-app realtime" = live-while-open
//  via a short poll, not APNs push. Auth uses the public anon key directly; the
//  prototype RLS policy allows anon insert/select (see the checkpoints migration).
//

import Combine
import Foundation

struct Checkpoint: Identifiable, Equatable {
    let id: Int
    let name: String
    let lat: Double
    let lon: Double
}

@MainActor
final class CheckpointStore: ObservableObject {
    @Published private(set) var checkpoints: [Checkpoint] = []
    /// Transient "was here" line for the banner; auto-cleared after a few seconds.
    @Published private(set) var banner: String?
    @Published private(set) var lastError: String?

    private let restCheckpoints = StreamConfig.supabaseURL + "/rest/v1/checkpoints"
    private let restVisits = StreamConfig.supabaseURL + "/rest/v1/checkpoint_visits"
    private let apiKey = StreamConfig.anonKey
    private let urlSession = URLSession(configuration: .ephemeral)

    private var session: String?
    private var visitCursor = 0
    // First poll only adopts the newest id so we don't banner pre-session history.
    private var primed = false
    private var pollTask: Task<Void, Never>?
    private var bannerClearTask: Task<Void, Never>?

    private static let pollInterval: UInt64 = 4_000_000_000 // 4 s

    /// Point the store at a VideoCallS2M session: (re)loads checkpoints + polls visits.
    func configure(session: String) {
        guard session != self.session else { return }
        stop()
        self.session = session
        visitCursor = 0
        primed = false
        pollTask = Task { [weak self] in
            await self?.loadCheckpoints()
            while !Task.isCancelled {
                await self?.pollVisits()
                try? await Task.sleep(nanoseconds: CheckpointStore.pollInterval)
            }
        }
    }

    func stop() {
        pollTask?.cancel()
        pollTask = nil
        session = nil
        checkpoints = []
    }

    /// Mark a checkpoint at `lat/lon` under the active session.
    func mark(name: String, lat: Double, lon: Double, deviceName: String) {
        guard let session else { return }
        let label = name.trimmingCharacters(in: .whitespaces)
        let row: [String: Any] = [
            "session": session,
            "device_name": deviceName,
            "name": label.isEmpty ? "Checkpoint" : label,
            "lat": lat,
            "lon": lon,
        ]
        Task {
            if await post(restCheckpoints, row) {
                await loadCheckpoints()
            } else {
                lastError = "Couldn't save checkpoint (is the migration pushed?)"
            }
        }
    }

    // MARK: - REST (anon key; prototype RLS allows anon insert/select)

    private func loadCheckpoints() async {
        guard let session else { return }
        let q = "?session=eq.\(session)&order=id.asc&select=id,name,lat,lon"
        guard let rows = await get(restCheckpoints + q) else { return }
        checkpoints = rows.compactMap { r in
            guard let id = r["id"] as? Int,
                  let name = r["name"] as? String,
                  let lat = r["lat"] as? Double,
                  let lon = r["lon"] as? Double else { return nil }
            return Checkpoint(id: id, name: name, lat: lat, lon: lon)
        }
    }

    private func pollVisits() async {
        guard let session else { return }
        let q = "?session=eq.\(session)&id=gt.\(visitCursor)&order=id.asc&limit=50" +
                "&select=id,checkpoint_name,device_name,entered_at"
        guard let rows = await get(restVisits + q) else { return }
        for r in rows {
            if let id = r["id"] as? Int, id > visitCursor { visitCursor = id }
            if !primed { continue } // baseline pass — don't notify for old rows
            let who = (r["device_name"] as? String) ?? "Someone"
            let cp = (r["checkpoint_name"] as? String) ?? "a checkpoint"
            let age = CheckpointStore.ageString(r["entered_at"] as? String)
            showBanner("\(who) was at \(cp) \(age)")
        }
        primed = true
    }

    private func showBanner(_ text: String) {
        banner = text
        bannerClearTask?.cancel()
        bannerClearTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 6_000_000_000)
            if !Task.isCancelled { self?.banner = nil }
        }
    }

    private func post(_ base: String, _ row: [String: Any]) async -> Bool {
        guard let url = URL(string: base),
              let body = try? JSONSerialization.data(withJSONObject: row) else { return false }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(apiKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        req.httpBody = body
        do {
            let (_, response) = try await urlSession.data(for: req)
            return ((response as? HTTPURLResponse)?.statusCode ?? 500) < 300
        } catch {
            return false
        }
    }

    private func get(_ urlString: String) async -> [[String: Any]]? {
        guard let url = URL(string: urlString) else { return nil }
        var req = URLRequest(url: url)
        req.setValue(apiKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        do {
            let (data, response) = try await urlSession.data(for: req)
            if let http = response as? HTTPURLResponse, http.statusCode >= 300 { return nil }
            return (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]]
        } catch {
            return nil // transient network error — next poll retries
        }
    }

    /// "just now" / "N min ago" / "N h ago" from an ISO8601 timestamptz string.
    private static func ageString(_ iso: String?) -> String {
        guard let iso else { return "just now" }
        let withFrac = ISO8601DateFormatter()
        withFrac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        guard let date = withFrac.date(from: iso) ?? plain.date(from: iso) else { return "just now" }
        let age = max(0, -date.timeIntervalSinceNow)
        if age < 45 { return "just now" }
        if age < 3600 { return "\(Int((age / 60).rounded())) min ago" }
        return "\(Int((age / 3600).rounded())) h ago"
    }
}
