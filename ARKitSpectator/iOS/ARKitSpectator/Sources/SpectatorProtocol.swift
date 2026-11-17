import Foundation
import simd
import UIKit

/// Wire format published by the Lens (SpectatorProtocol.ts) and validated by Snap Cloud (setup.sql).
/// Positions are centimetres relative to the Lens "Stage Origin", +Y up, right-handed — the same
/// handedness as SceneKit, so only the unit changes (cm → m).

/// Any JSON value (custom `data` payloads).
enum JSONValue: Codable, Equatable {
    case string(String), number(Double), bool(Bool), object([String: JSONValue]), array([JSONValue]), null

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(Double.self) { self = .number(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode([JSONValue].self) { self = .array(v) }
        else { self = .object(try c.decode([String: JSONValue].self)) }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let v): try c.encode(v)
        case .number(let v): try c.encode(v)
        case .bool(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .null: try c.encodeNil()
        }
    }
}

struct SpectatorClip: Codable, Equatable {
    let name: String
    var loop: Bool?
    var id: String?
}

struct SpectatorEntityState: Codable, Identifiable, Equatable {
    let id: String
    var name: String?
    let p: [Double]
    let r: [Double]
    let s: [Double]
    var asset: String?
    var primitive: String?
    var color: String?
    var visible: Bool?
    var clip: SpectatorClip?
    var data: JSONValue?

    var isValid: Bool {
        func vector(_ v: [Double], _ n: Int, _ limit: Double) -> Bool { v.count == n && v.allSatisfy { $0.isFinite && abs($0) <= limit } }
        return !id.isEmpty && id.count <= 80 && vector(p, 3, 100_000) && vector(r, 4, 1.01) && vector(s, 3, 1000)
            && (asset == nil || asset!.hasPrefix("https://"))
    }

    /// Stage-space position in metres.
    var position: SIMD3<Float> { SIMD3(Float(p[0]), Float(p[1]), Float(p[2])) / 100 }

    var orientation: simd_quatf {
        let q = simd_quatf(ix: Float(r[0]), iy: Float(r[1]), iz: Float(r[2]), r: Float(r[3]))
        return simd_length(q.vector) > 0.0001 ? simd_normalize(q) : simd_quatf(ix: 0, iy: 0, iz: 0, r: 1)
    }

    var scale: SIMD3<Float> { SIMD3(Float(s[0]), Float(s[1]), Float(s[2])) }

    var isVisible: Bool { visible ?? true }

    var assetURL: URL? { asset.flatMap(URL.init(string:)) }

    var uiColor: UIColor { color.flatMap(UIColor.init(spectatorHex:)) ?? UIColor(red: 0.55, green: 0.82, blue: 0.78, alpha: 1) }
}

struct SpectatorState: Codable, Equatable {
    var entities: [SpectatorEntityState]
    var data: JSONValue?

    static let empty = SpectatorState(entities: [], data: nil)
}

/// One row of public.spectator_states.
struct SpectatorStateRow: Codable {
    let room_id: UUID
    let revision: Int
    let state: SpectatorState
    let updated_at: String?
}

struct JoinedRoom: Equatable {
    let id: UUID
    let code: String
}

/// Reply of spectator_join_room: either the room or an `error` message.
struct RoomJoinReply: Decodable {
    let id: UUID?
    let code: String?
    let role: String?
    let error: String?
}

extension UIColor {
    /// Parses #RRGGBB or #RRGGBBAA.
    convenience init?(spectatorHex hex: String) {
        guard hex.hasPrefix("#"), hex.count == 7 || hex.count == 9, let value = UInt64(hex.dropFirst(), radix: 16) else { return nil }
        let hasAlpha = hex.count == 9
        let r = CGFloat((value >> (hasAlpha ? 24 : 16)) & 0xFF) / 255
        let g = CGFloat((value >> (hasAlpha ? 16 : 8)) & 0xFF) / 255
        let b = CGFloat((value >> (hasAlpha ? 8 : 0)) & 0xFF) / 255
        let a = hasAlpha ? CGFloat(value & 0xFF) / 255 : 1
        self.init(red: r, green: g, blue: b, alpha: a)
    }
}
