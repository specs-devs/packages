//
//  MultipeerSession.swift
//  VideoCallS2M
//

import Combine
import CoreLocation
import Foundation
import MultipeerConnectivity
import UIKit

enum VideoCallS2MRole: String, CaseIterable, Identifiable {
    case user = "User"
    case friend = "Friend"

    var id: String { rawValue }
}

struct Peer: Identifiable {
    let id: String
    let displayName: String
    var coordinate: CLLocationCoordinate2D?
    var horizontalAccuracy: Double?
    var altitude: Double?
    var verticalAccuracy: Double?
    var pressureKPa: Double?
    var isConnected: Bool = true
}

final class MultipeerSession: NSObject, ObservableObject {
    private let serviceType = "pf-p2p"
    private var peerID: MCPeerID?
    private var session: MCSession?
    private var advertiser: MCNearbyServiceAdvertiser?
    private var browser: MCNearbyServiceBrowser?
    private var lastSendAt = Date.distantPast

    @Published var connectedPeers: [MCPeerID] = []
    @Published var peers: [Peer] = []
    @Published var isAdvertising = false
    @Published var isBrowsing = false
    @Published var lastError: String?

    /// UIDevice.name returns a generic "iPhone" on modern iOS, so two phones would
    /// collide on identical MCPeerIDs and fail to connect. Append a stable per-device
    /// suffix so every install has a unique peer name.
    static func deviceDisplayName() -> String {
        let key = "pf-peer-suffix"
        let defaults = UserDefaults.standard
        let suffix: String
        if let saved = defaults.string(forKey: key) {
            suffix = saved
        } else {
            suffix = String(UUID().uuidString.prefix(4))
            defaults.set(suffix, forKey: key)
        }
        return "\(UIDevice.current.name) \(suffix)"
    }

    deinit {
        stop()
    }

    func start(displayName: String = MultipeerSession.deviceDisplayName()) {
        stop()

        let id = MCPeerID(displayName: displayName)
        peerID = id

        let sess = MCSession(peer: id, securityIdentity: nil, encryptionPreference: .required)
        sess.delegate = self
        session = sess

        let adv = MCNearbyServiceAdvertiser(peer: id, discoveryInfo: ["app": "videocalls2m"], serviceType: serviceType)
        adv.delegate = self
        advertiser = adv
        adv.startAdvertisingPeer()
        isAdvertising = true

        let br = MCNearbyServiceBrowser(peer: id, serviceType: serviceType)
        br.delegate = self
        browser = br
        br.startBrowsingForPeers()
        isBrowsing = true
    }

    /// iOS suspends MultipeerConnectivity while the app is backgrounded; call this
    /// on return to foreground to rebuild the link if it dropped.
    func restartIfDisconnected() {
        guard session == nil || connectedPeers.isEmpty else { return }
        start()
    }

    func stop() {
        advertiser?.stopAdvertisingPeer()
        browser?.stopBrowsingForPeers()
        session?.disconnect()
        advertiser = nil
        browser = nil
        session = nil
        connectedPeers = []
        peers.removeAll()
        isAdvertising = false
        isBrowsing = false
    }

    /// Emits VideoCallS2M control messages relayed by the bonded phone.
    let controlSubject = PassthroughSubject<VideoCallS2MControl, Never>()
    /// Reverse call initiation: a peer requested a video call (requester name).
    /// Fires on the bonded phone, which forwards the request to the Glasses.
    let callRequestSubject = PassthroughSubject<String, Never>()
    /// The peer cancelled its pending call request. Fires on the bonded phone,
    /// which forwards the cancel to the Glasses (dialog dismissal).
    let callCancelSubject = PassthroughSubject<Void, Never>()
    /// Call-request status relayed by the bonded phone: "ringing" | "accepted"
    /// | "declined" | "busy" | "missed" | "unreachable". The call itself still
    /// starts via the normal peopleFinder-control with call=true; these keep
    /// the friend phone's UI truthful while waiting (or failing).
    let callResponseSubject = PassthroughSubject<String, Never>()
    /// Friend phone asked for a video-quality preset (kbps). Fires on the
    /// bonded phone, which forwards it to the Glasses (the setting's owner).
    let qualityRequestSubject = PassthroughSubject<Int, Never>()
    /// The Glasses applied a quality preset (kbps), relayed by the bonded phone —
    /// the friend phone mirrors its UI and caps its return camera to match.
    let qualityAppliedSubject = PassthroughSubject<Int, Never>()
    /// UWB discovery token from a peer (NearbyInteraction handshake).
    let niTokenSubject = PassthroughSubject<Data, Never>()
    /// WebRTC signaling relayed phone↔phone ({type:"rtc",kind,from,sig}). On
    /// phoneA it's forwarded up to the Glasses; on phoneB it feeds the call.
    let rtcSubject = PassthroughSubject<[String: Any], Never>()

    /// Forward a Glasses control message to nearby peers (reliable, no rate cap).
    func sendControl(_ control: VideoCallS2MControl) {
        guard let session = session, !session.connectedPeers.isEmpty else { return }
        do {
            let data = try JSONSerialization.data(withJSONObject: control.dict, options: [])
            try session.send(data, toPeers: session.connectedPeers, with: .reliable)
        } catch {
            DispatchQueue.main.async {
                self.lastError = "Control send failed: \(error.localizedDescription)"
            }
        }
    }

    /// Send an arbitrary JSON message to all connected peers (reliable, no
    /// rate cap) — call requests/responses.
    func sendRaw(_ payload: [String: Any]) {
        guard let session = session, !session.connectedPeers.isEmpty else { return }
        do {
            let data = try JSONSerialization.data(withJSONObject: payload, options: [])
            try session.send(data, toPeers: session.connectedPeers, with: .reliable)
        } catch {
            DispatchQueue.main.async {
                self.lastError = "Send failed: \(error.localizedDescription)"
            }
        }
    }

    func sendLocation(_ payload: [String: Any]) {
        guard let session = session, !session.connectedPeers.isEmpty, !payload.isEmpty else { return }
        // Heading updates arrive many times per second; cap the send rate.
        let now = Date()
        guard now.timeIntervalSince(lastSendAt) >= 0.3 else { return }
        lastSendAt = now
        do {
            let data = try JSONSerialization.data(withJSONObject: payload, options: [])
            try session.send(data, toPeers: session.connectedPeers, with: .reliable)
        } catch {
            DispatchQueue.main.async {
                self.lastError = "Send failed: \(error.localizedDescription)"
            }
        }
    }

    private func upsertPeer(
        _ peerID: MCPeerID,
        coordinate: CLLocationCoordinate2D? = nil,
        horizontalAccuracy: Double? = nil,
        altitude: Double? = nil,
        verticalAccuracy: Double? = nil,
        pressureKPa: Double? = nil
    ) {
        if let index = peers.firstIndex(where: { $0.id == peerID.displayName }) {
            if let coordinate {
                peers[index].coordinate = coordinate
            }
            if let horizontalAccuracy {
                peers[index].horizontalAccuracy = horizontalAccuracy
            }
            if let altitude {
                peers[index].altitude = altitude
                peers[index].verticalAccuracy = verticalAccuracy
            }
            if let pressureKPa {
                peers[index].pressureKPa = pressureKPa
            }
            peers[index].isConnected = true
        } else {
            peers.append(Peer(
                id: peerID.displayName,
                displayName: peerID.displayName,
                coordinate: coordinate,
                horizontalAccuracy: horizontalAccuracy,
                altitude: altitude,
                verticalAccuracy: verticalAccuracy,
                pressureKPa: pressureKPa,
                isConnected: true
            ))
        }
    }

    private func markDisconnected(_ peerID: MCPeerID) {
        if let index = peers.firstIndex(where: { $0.id == peerID.displayName }) {
            peers[index].isConnected = false
        }
    }
}

extension MultipeerSession: MCSessionDelegate {
    func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        DispatchQueue.main.async {
            self.connectedPeers = session.connectedPeers
            switch state {
            case .connected:
                self.upsertPeer(peerID)
            case .notConnected:
                self.markDisconnected(peerID)
            default:
                break
            }
        }
    }

    func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        do {
            if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               let control = VideoCallS2MControl(json: json) {
                DispatchQueue.main.async {
                    self.controlSubject.send(control)
                }
            } else if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               json["type"] as? String == "call-request" {
                let name = json["name"] as? String ?? peerID.displayName
                DispatchQueue.main.async {
                    self.callRequestSubject.send(name)
                }
            } else if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               json["type"] as? String == "call-cancel" {
                DispatchQueue.main.async {
                    self.callCancelSubject.send(())
                }
            } else if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               json["type"] as? String == "call-response" {
                // Older senders carry only the accepted bool — map it.
                let status = json["status"] as? String
                    ?? ((json["accepted"] as? Bool ?? false) ? "accepted" : "declined")
                DispatchQueue.main.async {
                    self.callResponseSubject.send(status)
                }
            } else if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               json["type"] as? String == "quality",
               let kbps = json["kbps"] as? Int {
                DispatchQueue.main.async {
                    self.qualityRequestSubject.send(kbps)
                }
            } else if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               json["type"] as? String == "quality-applied",
               let kbps = json["kbps"] as? Int {
                DispatchQueue.main.async {
                    self.qualityAppliedSubject.send(kbps)
                }
            } else if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               json["type"] as? String == "ni-token",
               let b64 = json["d"] as? String,
               let tokenData = Data(base64Encoded: b64) {
                DispatchQueue.main.async {
                    self.niTokenSubject.send(tokenData)
                }
            } else if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               json["type"] as? String == "rtc" {
                DispatchQueue.main.async {
                    self.rtcSubject.send(json)
                }
            } else if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               let lat = json["lat"] as? Double,
               let lon = json["lon"] as? Double {
                let coordinate = CLLocationCoordinate2D(latitude: lat, longitude: lon)
                let horizontalAccuracy = json["accuracy"] as? Double
                let altitude = json["alt"] as? Double
                let verticalAccuracy = json["vAcc"] as? Double
                let pressureKPa = json["pressure"] as? Double
                DispatchQueue.main.async {
                    self.upsertPeer(
                        peerID,
                        coordinate: coordinate,
                        horizontalAccuracy: horizontalAccuracy,
                        altitude: altitude,
                        verticalAccuracy: verticalAccuracy,
                        pressureKPa: pressureKPa
                    )
                }
            }
        } catch {
            DispatchQueue.main.async {
                self.lastError = "Bad peer data: \(error.localizedDescription)"
            }
        }
    }

    func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {}
    func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, with progress: Progress) {}
    func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {}
}

extension MultipeerSession: MCNearbyServiceAdvertiserDelegate {
    func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID, withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        invitationHandler(true, session)
    }

    func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: Error) {
        DispatchQueue.main.async {
            self.lastError = "Advertiser error: \(error.localizedDescription)"
        }
    }
}

extension MultipeerSession: MCNearbyServiceBrowserDelegate {
    func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String: String]?) {
        guard let session = session, let myID = self.peerID else { return }
        guard info?["app"] == "videocalls2m" else { return }
        // Both phones browse and advertise; if both invite at once the connection
        // can deadlock, so only the peer with the greater name sends the invite.
        guard myID.displayName > peerID.displayName else { return }
        browser.invitePeer(peerID, to: session, withContext: nil, timeout: 30)
    }

    func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {}

    func browser(_ browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: Error) {
        DispatchQueue.main.async {
            self.lastError = "Browser error: \(error.localizedDescription)"
        }
    }
}
