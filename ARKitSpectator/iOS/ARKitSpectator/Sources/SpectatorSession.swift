import Foundation
import Supabase

/// Joins a room by code as a read-only spectator and keeps the latest published state:
/// Realtime Postgres Changes for live updates, plus a recovery snapshot every 8 seconds.
@MainActor final class SpectatorSession: ObservableObject {
    @Published private(set) var status = "Enter the 4-digit code shown in the Lens"
    @Published private(set) var room: JoinedRoom?
    @Published private(set) var state: SpectatorState = .empty
    @Published private(set) var revision = -1
    @Published private(set) var realtimeConnected = false
    @Published private(set) var joining = false
    /// Seconds between the two most recent updates (used to smooth motion).
    @Published private(set) var updateInterval: TimeInterval = 0.2

    private var client: SupabaseClient?
    private var clientConfig: SpectatorConfig?
    private var channel: RealtimeChannelV2?
    private var tasks: [Task<Void, Never>] = []
    private var generation = 0
    private var lastUpdate = Date.distantPast

    /// Room codes are exactly 4 digits (leading zeros allowed), matching spectator_join_room.
    nonisolated static func isValidCode(_ code: String) -> Bool { code.range(of: "^[0-9]{4}$", options: .regularExpression) != nil }

    private func client(for config: SpectatorConfig) throws -> SupabaseClient {
        if let client, clientConfig == config { return client }
        guard let url = config.url, config.isComplete else {
            throw SpectatorError("Add your Snap Cloud URL and public key in Settings")
        }
        let created = SupabaseClient(supabaseURL: url, supabaseKey: config.publishableKey)
        client = created
        clientConfig = config
        return created
    }

    func join(code raw: String, config: SpectatorConfig) async {
        let code = raw.trimmingCharacters(in: .whitespaces)
        guard !joining else { return }
        guard Self.isValidCode(code) else { status = "Enter the 4-digit room code"; return }
        joining = true
        defer { joining = false }
        await leave(silently: true)
        generation += 1
        let epoch = generation
        do {
            let client = try client(for: config)
            status = "Connecting…"
            if (try? await client.auth.session) == nil { try await client.auth.signInAnonymously() }
            let reply: RoomJoinReply = try await client.rpc("spectator_join_room", params: ["p_code": AnyJSON.string(code)]).execute().value
            if let error = reply.error { throw SpectatorError(error) }
            guard let id = reply.id, let roomCode = reply.code else { throw SpectatorError("Invalid room response — is supabase/setup.sql installed?") }
            guard epoch == generation else { return }
            if reply.role == "host" {
                _ = try? await client.rpc("spectator_leave_room", params: ["p_room": AnyJSON.string(id.uuidString)]).execute()
                throw SpectatorError("This identity hosts the room. Spectate from another device.")
            }
            room = JoinedRoom(id: id, code: roomCode)
            try await subscribe(client: client, room: id, epoch: epoch)
            await refresh(epoch: epoch)
        } catch {
            if epoch == generation { room = nil; status = error.localizedDescription }
        }
    }

    private func subscribe(client: SupabaseClient, room id: UUID, epoch: Int) async throws {
        let channel = client.realtimeV2.channel("arkit-spectator:\(id.uuidString.lowercased())")
        let updates = channel.postgresChange(UpdateAction.self, schema: "public", table: "spectator_states",
                                             filter: "room_id=eq.\(id.uuidString.lowercased())")
        self.channel = channel
        tasks.append(Task { [weak self] in
            for await status in channel.statusChange {
                guard let self, !Task.isCancelled, epoch == self.generation else { return }
                self.realtimeConnected = status == .subscribed
                self.status = self.realtimeConnected ? self.liveStatus : "Realtime reconnecting · refreshing every 8 s"
            }
        })
        tasks.append(Task { [weak self] in
            for await action in updates {
                guard let self, !Task.isCancelled, epoch == self.generation else { return }
                if let row = try? action.decodeRecord(as: SpectatorStateRow.self, decoder: JSONDecoder()) {
                    self.accept(row)
                } else {
                    await self.refresh(epoch: epoch)
                }
            }
        })
        tasks.append(Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(8))
                guard let self, !Task.isCancelled else { return }
                await self.refresh(epoch: epoch)
            }
        })
        do {
            try await channel.subscribeWithError()
            if epoch == generation { realtimeConnected = true; status = liveStatus }
        } catch {
            if epoch == generation { status = "Realtime unavailable · refreshing every 8 s" }
        }
    }

    private var liveStatus: String { room.map { "Watching room \($0.code)" } ?? "Live" }

    private func accept(_ row: SpectatorStateRow) {
        guard let room, row.room_id == room.id, row.revision > revision else { return }
        let valid = row.state.entities.filter(\.isValid)
        let now = Date()
        updateInterval = min(0.5, max(0.05, now.timeIntervalSince(lastUpdate)))
        lastUpdate = now
        revision = row.revision
        state = SpectatorState(entities: Array(valid.prefix(64)), data: row.state.data)
    }

    private func refresh(epoch: Int) async {
        guard let room, let client, epoch == generation else { return }
        do {
            let rows: [SpectatorStateRow] = try await client.from("spectator_states").select().eq("room_id", value: room.id).execute().value
            guard epoch == generation else { return }
            if let row = rows.first { accept(row) }
            else {
                // Membership ends when the host closes the room or it expires.
                state = .empty
                status = "The host closed room \(room.code)"
                await leave(silently: true)
                status = "The host closed room \(room.code). Enter a new code."
            }
        } catch {
            if epoch == generation { status = "Reconnecting: \(error.localizedDescription)" }
        }
    }

    func leave(silently: Bool = false) async {
        generation += 1
        tasks.forEach { $0.cancel() }
        tasks = []
        realtimeConnected = false
        if let channel, let client { await client.realtimeV2.removeChannel(channel) }
        channel = nil
        let old = room
        room = nil
        state = .empty
        revision = -1
        if let old, let client { _ = try? await client.rpc("spectator_leave_room", params: ["p_room": AnyJSON.string(old.id.uuidString)]).execute() }
        if !silently { status = "Enter the 4-digit code shown in the Lens" }
    }
}

struct SpectatorError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}
