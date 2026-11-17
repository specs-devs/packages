//
//  NearbyInteractionModel.swift
//  FriendFinder
//
//  Phone-to-phone UWB ranging via NearbyInteraction. Discovery tokens ride
//  the existing MultipeerConnectivity link ({"type":"ni-token","d":<b64>});
//  while peers are within UWB range (~9 m on U1 iPhones, ~3× that on
//  iPhone 15+/U2, line of sight) `distanceM` updates several times a second
//  with ~±10 cm accuracy. The bonded phone forwards a fresh reading to the
//  Glasses inside the friend location payload ("uwbDist") where the Lens
//  prefers it over the GPS haversine at short range.
//
//  Both phones run a session (each measures the same distance); requires the
//  app foregrounded on both ends — iOS suspends NISession in the background.
//

import Combine
import Foundation
import NearbyInteraction

final class NearbyInteractionModel: NSObject, ObservableObject {
    @Published var distanceM: Double?
    @Published var lastUpdateAt: Date?
    @Published var statusLine: String = "UWB idle"

    /// Sends my discovery token to peers — injected by ContentView (multipeer).
    var sendToken: ((Data) -> Void)?

    private var session: NISession?
    private var peerToken: NIDiscoveryToken?
    private var permissionDenied = false

    var isSupported: Bool {
        if #available(iOS 16.0, *) {
            return NISession.deviceCapabilities.supportsPreciseDistanceMeasurement
        }
        return NISession.isSupported
    }

    /// Fresh reading suitable for relaying (nil once it goes stale).
    var freshDistanceM: Double? {
        guard let distanceM, let lastUpdateAt,
              Date().timeIntervalSince(lastUpdateAt) < 2 else { return nil }
        return distanceM
    }

    /// Idempotent — safe to call on every peer-connect event.
    func startIfNeeded() {
        guard session == nil, !permissionDenied else { return }
        guard isSupported else {
            statusLine = "UWB not supported on this iPhone"
            return
        }
        let s = NISession()
        s.delegate = self
        session = s
        statusLine = "UWB waiting for peer token…"
        shareToken()
    }

    func stop() {
        session?.invalidate()
        session = nil
        peerToken = nil
        distanceM = nil
        lastUpdateAt = nil
        statusLine = "UWB idle"
    }

    /// (Re)send my token — both phones do this whenever a peer connects.
    func shareToken() {
        guard let token = session?.discoveryToken,
              let data = try? NSKeyedArchiver.archivedData(
                withRootObject: token, requiringSecureCoding: true) else { return }
        sendToken?(data)
    }

    /// Peer token received over multipeer — start ranging.
    func receivedPeerToken(_ data: Data) {
        startIfNeeded()
        guard let session,
              let token = try? NSKeyedUnarchiver.unarchivedObject(
                ofClass: NIDiscoveryToken.self, from: data) else { return }
        peerToken = token
        session.run(NINearbyPeerConfiguration(peerToken: token))
        statusLine = "UWB ranging…"
    }
}

extension NearbyInteractionModel: NISessionDelegate {
    func session(_ session: NISession, didUpdate nearbyObjects: [NINearbyObject]) {
        guard let object = nearbyObjects.first, let distance = object.distance else { return }
        DispatchQueue.main.async {
            self.distanceM = Double(distance)
            self.lastUpdateAt = Date()
            let feet = Double(distance) * 3.28084
            self.statusLine = String(format: "UWB %.1f ft", feet)
        }
    }

    func session(_ session: NISession, didRemove nearbyObjects: [NINearbyObject],
                 reason: NINearbyObject.RemovalReason) {
        DispatchQueue.main.async {
            self.distanceM = nil
            self.statusLine = "UWB peer out of range"
        }
    }

    func sessionWasSuspended(_ session: NISession) {
        DispatchQueue.main.async { self.statusLine = "UWB suspended (app backgrounded?)" }
    }

    func sessionSuspensionEnded(_ session: NISession) {
        // Apple guidance: re-run with the saved peer token and re-share ours.
        if let peerToken {
            session.run(NINearbyPeerConfiguration(peerToken: peerToken))
        }
        shareToken()
    }

    func session(_ session: NISession, didInvalidateWith error: Error) {
        let nsError = error as NSError
        DispatchQueue.main.async {
            self.distanceM = nil
            if nsError.code == NIError.userDidNotAllow.rawValue {
                // Don't restart into a permission-prompt loop.
                self.permissionDenied = true
                self.statusLine = "UWB permission denied — enable in Settings"
                self.session = nil
                return
            }
            self.statusLine = "UWB error: \(error.localizedDescription)"
            // Invalidated sessions can't be reused — start fresh (new token;
            // peers re-exchange on the next connect event).
            self.session = nil
            self.startIfNeeded()
        }
    }
}
