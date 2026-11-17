//
//  StreamConfig.swift
//  VideoCallS2M
//
//  Snap Cloud (Supabase) endpoints for the VideoCallS2M POV streaming pipeline.
//  Mirrors Assets/Scripts/VideoCallS2MTypes.ts on the Lens side: one Realtime
//  broadcast channel per session (`pov-<session>`), events `frame:<streamer>`
//  and `audio:<streamer>` — see RealtimeClient.swift for the transport.
//
//  The anon key is the project's PUBLIC token (same one baked into the Lens
//  asset). Realtime broadcast rides the anon JWT (prototype).
//

import Foundation

enum StreamConfig {
    static let supabaseURL = "https://kjxmfkpcafpeuzrwcrjo.snapcloud.dev"
    static let anonKey = ""

    static let streamerBonded = "phoneA"
    static let streamerFriend = "phoneB"
    static let streamerGlasses = "glasses"

    /// Phoenix websocket endpoint (JSON serializer).
    static var realtimeSocketURL: URL {
        URL(string: "wss://kjxmfkpcafpeuzrwcrjo.snapcloud.dev/realtime/v1/websocket" +
            "?apikey=\(anonKey)&vsn=1.0.0")!
    }

    /// Phoenix topic for a session's streaming channel.
    static func channelTopic(session: String) -> String {
        "realtime:pov-\(session)"
    }

    /// Broadcast event carrying one JPEG frame: payload { d, n, t }.
    static func frameEvent(_ streamer: String) -> String {
        "frame:\(streamer)"
    }

    /// Broadcast event carrying one WAV voice chunk: payload { d, n, r, t }.
    static func audioEvent(_ streamer: String) -> String {
        "audio:\(streamer)"
    }
}

/// Control message broadcast by the Glasses Lens when the user picks modes.
/// Arrives on the bonded phone via Mobile Kit (`.notify`), then gets forwarded
/// to the friend phone over multipeer.
struct VideoCallS2MControl: Equatable {
    let session: String
    let wyb: Bool
    let call: Bool
    let find: Bool
    /// Which phone streams in Watch Your Back mode: "phoneA" | "phoneB".
    let source: String
    /// Suggested starting camera: "front" | "back".
    let camera: String

    init(session: String, wyb: Bool, call: Bool, find: Bool, source: String, camera: String) {
        self.session = session
        self.wyb = wyb
        self.call = call
        self.find = find
        self.source = source
        self.camera = camera
    }

    /// The same control with the call flag flipped — used when a call ends but
    /// other modes (e.g. Find Your Friend) stay on, so the phone's mode state
    /// mirrors the Glasses instead of clearing entirely.
    func with(call: Bool) -> VideoCallS2MControl {
        VideoCallS2MControl(session: session, wyb: wyb, call: call,
                            find: find, source: source, camera: camera)
    }

    init?(json: [String: Any]) {
        guard json["type"] as? String == "peopleFinder-control",
              let session = json["session"] as? String else { return nil }
        self.session = session
        self.wyb = json["wyb"] as? Bool ?? false
        self.call = json["call"] as? Bool ?? false
        self.find = json["find"] as? Bool ?? false
        self.source = json["source"] as? String ?? StreamConfig.streamerFriend
        self.camera = json["camera"] as? String ?? "back"
    }

    var dict: [String: Any] {
        [
            "type": "peopleFinder-control",
            "session": session,
            "wyb": wyb,
            "call": call,
            "find": find,
            "source": source,
            "camera": camera,
        ]
    }

    /// True when the phone with the given streamer id should stream video.
    func shouldStreamVideo(as streamer: String) -> Bool {
        if call { return streamer == StreamConfig.streamerFriend }
        if wyb { return streamer == source }
        return false
    }
}
