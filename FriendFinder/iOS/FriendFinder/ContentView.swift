//
//  ContentView.swift
//  FriendFinder
//

import CoreLocation
import MapKit
import SwiftUI

/// Friend-phone state for an outgoing "video-call the wearer" request.
/// Every transition is driven by an explicit call-response status from the
/// wearer's side (or a local timeout/cancel) so this phone's UI never lies:
///   idle → calling (request sent) → ringing (Glasses dialog is up)
///        → starting (wearer accepted; the control that starts the call is
///          in flight) → idle (call running, or failed(reason)).
private enum CallRequestState: Equatable {
    case idle
    case calling
    case ringing
    case starting
    case failed(String)
}

/// Answered on the launch ask ("Are you wearing Glasses?"). Decides which
/// controls this phone shows: the wearer's phone owns the Glasses link, the
/// friend's phone shares location and can request video calls.
private enum AppRole {
    case wearer, friend
}

struct ContentView: View {
    @EnvironmentObject var locationModel: LocationModel
    @EnvironmentObject var multipeerSession: MultipeerSession
    @EnvironmentObject var mobileKitModel: MobileKitModel
    @EnvironmentObject var friendFinder: FriendFinderModeModel
    @EnvironmentObject var nearby: NearbyInteractionModel
    @Environment(\.scenePhase) private var scenePhase

    /// Follows the user's real location as soon as a GPS fix arrives.
    @State private var cameraPosition: MapCameraPosition = .userLocation(fallback: .automatic)
    @State private var cameraHeading: Double = 0
    @State private var testMessage: String = "Hello Glasses 👋"
    @State private var callRequestState: CallRequestState = .idle
    /// Bumped on every call-request transition; timeout closures capture it so
    /// a stale timer can never flip the state of a NEWER attempt.
    @State private var callAttempt = 0
    /// Call-wide video quality preset (kbps). The LENS owns the value: we send
    /// a request and update only on its "quality-applied" ack, so every device
    /// always shows the same number. Default mirrors the lens default (1K).
    @State private var videoQualityKbps = 1000
    /// Non-nil while the rename-pairing alert is up; holds the bonding id.
    @State private var renamingBondingId: String?
    @State private var renameText: String = ""
    /// nil until the launch ask is answered (asked once per launch).
    @State private var appRole: AppRole?
    /// Last answered role, kept across launches so the wearer's phone can
    /// pre-warm its Glasses session while the ask is still on screen.
    @AppStorage("friendFinder.lastRole") private var lastRoleRaw: String = ""

    /// Checkpoints + "was here" notifications (Snap Cloud), scoped to the active
    /// FriendFinder session (configured when a control message arrives).
    @StateObject private var checkpointStore = CheckpointStore()
    /// Cloud fallback for the control relay: the wearer's phone publishes each
    /// Glasses control here; the friend's phone polls it. Makes call start
    /// independent of multipeer discovery (slow/unstable on corp WiFi/hotspot).
    @StateObject private var controlLobby = ControlLobby()
    @State private var checkpointName: String = ""

    private var peerAnnotations: [PeerAnnotation] {
        multipeerSession.peers.compactMap { peer in
            guard let coordinate = peer.coordinate else { return nil }
            return PeerAnnotation(id: peer.id, name: peer.displayName, coordinate: coordinate)
        }
    }

    /// The friend the radar tracks: the first peer with a GPS fix, else any
    /// peer (so a UWB-only reading still shows a name).
    private var radarFriend: Peer? {
        multipeerSession.peers.first(where: { $0.coordinate != nil }) ?? multipeerSession.peers.first
    }

    /// Device heading in screen space: compass heading minus the map camera's rotation.
    private var userHeadingOnScreen: Double? {
        guard let heading = locationModel.lastHeading else { return nil }
        let degrees = heading.trueHeading >= 0 ? heading.trueHeading : heading.magneticHeading
        return degrees - cameraHeading
    }

    var body: some View {
        ZStack {
            mapBody
            if appRole == nil {
                roleAskOverlay
            }
            if let banner = checkpointStore.banner {
                VStack {
                    checkpointBanner(banner)
                    Spacer()
                }
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.25), value: checkpointStore.banner)
    }

    // MARK: - Launch Ask

    private var roleAskOverlay: some View {
        VStack(spacing: 22) {
            Spacer()

            Image(systemName: "eyeglasses")
                .font(.system(size: 56))
                .foregroundStyle(.teal)

            Text("Are you wearing Glasses?")
                .font(.title2.weight(.bold))

            Text("The wearer's phone links to the Glasses. The friend's phone shares its location and can request a video call.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 28)

            VStack(spacing: 12) {
                Button {
                    chooseRole(.wearer)
                } label: {
                    Label("Yes — I'm wearing Glasses", systemImage: "eyeglasses")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .tint(.teal)

                Button {
                    chooseRole(.friend)
                } label: {
                    Label("No — I'm the friend", systemImage: "person.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .tint(.indigo)
            }
            .padding(.horizontal, 24)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.regularMaterial)
    }

    /// Apply a control as the FRIEND phone (arrives via multipeer or the cloud
    /// lobby — whichever lands first; a repeat of the same mode is a no-op).
    /// A phone holding a live Glasses session is the wearer's relay (phoneA) and
    /// must never adopt the friend role — the dual-phoneB state broke calls.
    private func applyFriendControl(_ control: FriendFinderControl) {
        guard !mobileKitModel.sessionStarted else {
            print("[FriendFinder] Ignoring relayed control — this phone holds the Glasses link (role phoneA). "
                  + "If this phone should be the FRIEND, pick \"No — I'm the friend\" at launch.")
            return
        }
        friendFinder.apply(control, as: StreamConfig.streamerFriend)
        if control.call {
            callRequestState = .idle // our request was accepted
        }
    }

    private func chooseRole(_ role: AppRole) {
        appRole = role
        lastRoleRaw = role == .wearer ? "wearer" : "friend"
        if role == .wearer {
            controlLobby.stopPolling()
            // One-tap path: start against the last pairing that actually
            // CONNECTED (never an arbitrary stale one). No pairing at all →
            // jump straight into bonding instead of hiding it behind ⋯.
            if !mobileKitModel.startPreferredSession(),
               !mobileKitModel.sessionStarted {
                if mobileKitModel.bondings.isEmpty {
                    mobileKitModel.bind()
                }
                // Several pairings and none known-good: the ⋯ menu lists them;
                // the first session that connects becomes the default.
            }
        } else {
            // Friend phone must not hold the Glasses link (it may have been
            // pre-warmed on launch or left over from a wearer run).
            mobileKitModel.stopSession()
            controlLobby.startPolling { applyFriendControl($0) }
        }
    }

    /// The full map experience (everything the app was before the role ask).
    private var mapBody: some View {
        Map(position: $cameraPosition) {
            ForEach(peerAnnotations) { peer in
                Annotation(peer.name, coordinate: peer.coordinate) {
                    PeerDot()
                }
            }

            // Declared last so the user's own dot always draws above peer dots.
            UserAnnotation { _ in
                UserDot(heading: userHeadingOnScreen)
            }
        }
        .mapStyle(.standard(elevation: .flat))
        .mapControls {
            MapUserLocationButton()
            MapCompass()
        }
        .onMapCameraChange(frequency: .continuous) { context in
            cameraHeading = context.camera.heading
        }
        .tint(.indigo)
        .safeAreaInset(edge: .top, spacing: 0) {
            topBar
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            bottomPanel
        }
        .onAppear {
            locationModel.requestAuthorization()
            multipeerSession.start()
            nearby.sendToken = { data in
                multipeerSession.sendRaw(["type": "ni-token", "d": data.base64EncodedString()])
            }
            // Call Friend signaling now rides the Snap Cloud DB mailbox
            // (RtcSignalMailbox, created inside WebRTCCallManager) — nothing to
            // wire here.
            // Pre-warm: this phone was the wearer last time, so start the
            // known-good Glasses session while the role ask is still up.
            // Choosing "friend" stops it again.
            if lastRoleRaw == "wearer" {
                mobileKitModel.startPreferredSession()
            } else if lastRoleRaw == "friend" {
                // Mirror of the wearer pre-warm: start the lobby poll while the
                // role ask is still up, so a call that starts right now isn't
                // missed. Choosing wearer stops it again.
                controlLobby.startPolling { applyFriendControl($0) }
            }
        }
        // UWB handshake: whenever the peer set changes, make sure our session
        // exists and (re)share our discovery token.
        .onReceive(multipeerSession.$connectedPeers) { peers in
            guard !peers.isEmpty else { return }
            nearby.startIfNeeded()
            nearby.shareToken()
        }
        .onReceive(multipeerSession.niTokenSubject) { tokenData in
            nearby.receivedPeerToken(tokenData)
        }
        .onDisappear {
            locationModel.stopUpdates()
            multipeerSession.stop()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                multipeerSession.restartIfDisconnected()
            }
        }
        .onReceive(locationModel.$lastLocation) { _ in
            broadcastLocation()
        }
        .onReceive(locationModel.$lastHeading) { _ in
            broadcastLocation()
        }
        .onReceive(multipeerSession.$peers) { peers in
            streamFriendToGlasses(peers)
        }
        // Control from the Glasses Lens over Mobile Kit → this is the bonded
        // phone (phoneA). Apply, then relay to the friend phone via multipeer.
        .onReceive(mobileKitModel.$receivedControl) { control in
            guard let control else { return }
            friendFinder.apply(control, as: StreamConfig.streamerBonded)
            multipeerSession.sendControl(control)
            // Mirror through the cloud lobby so the friend phone gets it even
            // when multipeer discovery is down.
            controlLobby.publish(control)
        }
        // Control relayed over multipeer → this is the friend phone (phoneB).
        // A phone holding a live Glasses session is the wearer's relay (phoneA)
        // and must NEVER adopt the friend role: when BOTH phones are bonded
        // (two-phone dev rig), each forwards the Glasses control to the other,
        // and honoring the relayed copy made both phones run a call manager as
        // "phoneB" in the same session — duplicate offers/answers per signal,
        // so ICE credentials never matched and voice sat in `checking` forever.
        .onReceive(multipeerSession.controlSubject) { control in
            applyFriendControl(control)
        }
        // Multipeer watchdog: discovery on corp WiFi / next to a hotspot often
        // wedges silently. restartIfDisconnected() no-ops while peers are
        // connected, so this just keeps kicking a dead scan back to life.
        .onReceive(Timer.publish(every: 8, on: .main, in: .common).autoconnect()) { _ in
            multipeerSession.restartIfDisconnected()
        }
        // Every control carries the session code — point the checkpoint store at
        // it so marking + "was here" notifications share the Glasses' session.
        .onReceive(friendFinder.$control) { control in
            if let session = control?.session { checkpointStore.configure(session: session) }
        }
        // A peer asked for a video call → this is the bonded phone; forward
        // the request to the Glasses over Mobile Kit. When the Glasses session is
        // down the forward is impossible — NACK right away so the friend's
        // "Calling…" fails fast with a reason instead of spinning into a void.
        .onReceive(multipeerSession.callRequestSubject) { name in
            if !mobileKitModel.forwardCallRequest(name: name) {
                multipeerSession.sendRaw([
                    "type": "call-response", "accepted": false, "status": "unreachable",
                ])
            }
        }
        // The friend cancelled its pending request → bonded phone relays the
        // cancel to the Glasses so the incoming-call dialog goes away.
        .onReceive(multipeerSession.callCancelSubject) { _ in
            mobileKitModel.forwardCallCancel()
        }
        // Wearer's answer (ringing/accepted/declined/busy/missed) → bonded
        // phone relays it to the friend.
        .onReceive(mobileKitModel.callResponseSubject) { status in
            multipeerSession.sendRaw([
                "type": "call-response", "accepted": status == "accepted", "status": status,
            ])
        }
        // Status relayed over multipeer → this is the friend phone.
        .onReceive(multipeerSession.callResponseSubject) { status in
            handleCallResponse(status)
        }
        // Friend asked for a quality preset → bonded phone forwards to the Glasses.
        .onReceive(multipeerSession.qualityRequestSubject) { kbps in
            mobileKitModel.forwardQualityRequest(kbps: kbps)
        }
        // Glasses applied a preset → bonded phone relays the ack to the friend.
        .onReceive(mobileKitModel.qualityAppliedSubject) { kbps in
            multipeerSession.sendRaw(["type": "quality-applied", "kbps": kbps])
        }
        // Applied-preset ack on the friend phone: mirror the UI and cap our own
        // return camera so BOTH video directions run the same preset.
        .onReceive(multipeerSession.qualityAppliedSubject) { kbps in
            videoQualityKbps = kbps
            friendFinder.callManager.setReturnVideoMaxBitrate(kbps: kbps)
        }
    }

    /// Friend phone's Video button: ask the lens for the next preset. The UI
    /// updates when the "quality-applied" ack comes back (truthful, in sync).
    private func cycleVideoQuality() {
        let presets = [1000, 2000, 3500]
        let i = presets.firstIndex(of: videoQualityKbps) ?? 0
        multipeerSession.sendRaw([
            "type": "quality", "kbps": presets[(i + 1) % presets.count],
        ])
    }

    // MARK: - Outgoing call request (friend phone)

    private func beginCallRequest() {
        multipeerSession.sendRaw([
            "type": "call-request",
            "name": MultipeerSession.deviceDisplayName(),
        ])
        callAttempt += 1
        callRequestState = .calling
        // No "ringing" ack means the request never reached the Glasses (multipeer
        // down, relay phone missing, or its Glasses link dead) — fail fast so the
        // user can retry instead of waiting on a silent void.
        scheduleCallTimeout(after: 15, ifStillIn: .calling,
                            reason: "Couldn't reach the wearer — try again")
    }

    private func cancelCallRequest() {
        multipeerSession.sendRaw(["type": "call-cancel"])
        callAttempt += 1
        callRequestState = .idle
    }

    private func failCallRequest(_ reason: String) {
        callAttempt += 1
        callRequestState = .failed(reason)
        let attempt = callAttempt
        DispatchQueue.main.asyncAfter(deadline: .now() + 6) {
            if callAttempt == attempt, callRequestState == .failed(reason) {
                callRequestState = .idle
            }
        }
    }

    private func scheduleCallTimeout(after seconds: TimeInterval,
                                     ifStillIn state: CallRequestState,
                                     reason: String) {
        let attempt = callAttempt
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds) {
            if callAttempt == attempt, callRequestState == state {
                failCallRequest(reason)
            }
        }
    }

    /// Friend phone: apply a call-response status from the wearer's side.
    private func handleCallResponse(_ status: String) {
        guard callRequestState != .idle else { return } // no request pending
        switch status {
        case "ringing":
            if callRequestState == .calling {
                callAttempt += 1
                callRequestState = .ringing
                // The Glasses resolves an unanswered dialog as "missed" at 60 s;
                // this longer fallback only covers that message getting lost.
                scheduleCallTimeout(after: 75, ifStillIn: .ringing, reason: "No answer")
            }
        case "accepted":
            callAttempt += 1
            callRequestState = .starting
            scheduleCallTimeout(after: 20, ifStillIn: .starting,
                                reason: "Accepted, but the call didn't start — try again")
        case "declined":
            failCallRequest("Declined by the wearer")
        case "busy":
            failCallRequest("The wearer is in another call")
        case "missed":
            failCallRequest("No answer")
        case "unreachable":
            failCallRequest("The wearer's Glasses aren't connected")
        default:
            break
        }
    }

    // MARK: - Top Bar

    private var topBar: some View {
        HStack(spacing: 12) {
            statusPill(
                icon: "person.2.fill",
                text: multipeerSession.peers.isEmpty ? "Searching…" : "\(multipeerSession.peers.count) nearby",
                color: multipeerSession.peers.isEmpty ? .orange : .green
            )

            Spacer()

            // Chosen role — tap to answer the launch ask again.
            if let role = appRole {
                Button {
                    appRole = nil
                } label: {
                    statusPill(
                        icon: role == .wearer ? "eyeglasses" : "person.fill",
                        text: role == .wearer ? "Wearer" : "Friend",
                        color: role == .wearer ? .teal : .indigo
                    )
                }
                .buttonStyle(.plain)
            }

            statusPill(
                icon: locationModel.lastLocation == nil ? "location.slash.fill" : "location.fill",
                text: locationModel.lastLocation == nil ? "Locating…" : "GPS ready",
                color: locationModel.lastLocation == nil ? .orange : .blue
            )
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 12)
    }

    private func statusPill(icon: String, text: String, color: Color) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.caption.weight(.semibold))
                .foregroundStyle(color)
            Text(text)
                .font(.subheadline.weight(.semibold))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.regularMaterial, in: Capsule())
    }

    // MARK: - Bottom Panel

    private var bottomPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let error = locationModel.errorMessage ?? multipeerSession.lastError {
                HStack(spacing: 10) {
                    Image(systemName: "exclamationmark.triangle.fill")
                    Text(error)
                        .font(.caption)
                        .lineLimit(2)
                    Spacer()
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(.red.opacity(0.9), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            // Glasses link controls only make sense on the wearer's phone.
            if appRole != .friend {
                Text("Glasses")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)

                glassesRow

                if mobileKitModel.sessionStarted {
                    testRow
                }
            }

            if friendFinder.control != nil {
                Text("FriendFinder Mode")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                    .padding(.top, 4)
                friendFinderSection

                checkpointsSection
            }

            Text("Nearby")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .padding(.top, 4)

            // Radar scope: you at center (heading-up), friend as a blip at true
            // bearing + distance. UWB = crisp green; phone GPS = fuzzy indigo halo.
            RadarView(
                selfLocation: locationModel.lastLocation,
                heading: locationModel.lastHeading,
                friendCoordinate: radarFriend?.coordinate,
                friendAccuracyM: radarFriend?.horizontalAccuracy,
                friendName: radarFriend?.displayName,
                uwbFreshM: nearby.freshDistanceM,
                uwbSupported: nearby.isSupported
            )
            .padding(.vertical, 2)

            if multipeerSession.peers.isEmpty {
                HStack(alignment: .top, spacing: 12) {
                    ProgressView()
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Scanning for friends nearby…")
                            .font(.subheadline)
                        Text("Let your friend launch Friend Finder too — they'll show up here.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                }
                .padding(.vertical, 6)
            } else {
                ForEach(multipeerSession.peers) { peer in
                    peerRow(peer)
                }
                if nearby.isSupported {
                    HStack(spacing: 6) {
                        Image(systemName: "wave.3.right")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(nearby.freshDistanceM != nil ? .green : .secondary)
                        Text(nearby.statusLine)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Spacer()
                    }
                }
                // Friend phone only (the wearer can't call themselves): ask
                // the Glasses wearer to start a video call. They accept or deny
                // on a dialog in the Lens.
                if appRole == .friend && !friendFinder.isInCall {
                    callRequestRow
                }
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .padding(.horizontal, 12)
        .padding(.bottom, 8)
    }

    private var glassesRow: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(Color.teal.opacity(0.2))
                    .frame(width: 44, height: 44)
                Image(systemName: "eyeglasses")
                    .font(.title3)
                    .foregroundStyle(.teal)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("GLASSES")
                    .font(.subheadline.weight(.semibold))
                Text(glassesStatusText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            // One-tap fresh bond. The stale-pairings list is intentionally
            // hidden — the user re-bonds each test (see "Forget all" below).
            if !mobileKitModel.sessionStarted {
                Button {
                    mobileKitModel.bind() // fresh pair → auto-connects on success
                } label: {
                    Label("Bond", systemImage: "link")
                        .font(.subheadline.weight(.semibold))
                }
                .buttonStyle(.borderedProminent)
                .tint(.teal)
            }

            Menu {
                Button {
                    if mobileKitModel.sessionStarted { mobileKitModel.stopSession() }
                    mobileKitModel.bind() // re-bond fresh
                } label: {
                    Label("Bond fresh Glasses", systemImage: "link.badge.plus")
                }
                if mobileKitModel.sessionStarted {
                    Button(role: .destructive) {
                        mobileKitModel.stopSession()
                    } label: {
                        Label("Stop session", systemImage: "stop.circle")
                    }
                }
                // The only cleanup surfaced now: wipe every paired device for a
                // clean slate. Each unbind is a deeplink round-trip (chime), so
                // it's manual, never automatic.
                if !mobileKitModel.bondings.isEmpty {
                    Button(role: .destructive) {
                        mobileKitModel.forgetAllBondings()
                    } label: {
                        Label("Forget all paired devices", systemImage: "trash")
                    }
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .font(.title3)
                    .foregroundStyle(.teal)
            }
        }
        .padding(.vertical, 4)
        .alert("Name this Glasses", isPresented: Binding(
            get: { renamingBondingId != nil },
            set: { if !$0 { renamingBondingId = nil } }
        )) {
            TextField("e.g. My Glasses", text: $renameText)
            Button("Save") {
                if let id = renamingBondingId { mobileKitModel.setNickname(renameText, for: id) }
                renamingBondingId = nil
            }
            if let id = renamingBondingId, mobileKitModel.nickname(for: id) != nil {
                Button("Clear name", role: .destructive) {
                    mobileKitModel.setNickname("", for: id)
                    renamingBondingId = nil
                }
            }
            Button("Cancel", role: .cancel) { renamingBondingId = nil }
        } message: {
            if let id = renamingBondingId {
                Text("Pairing …\(String(id.suffix(6)))\n\nTip: Start a session first — the pair that reaches “connected” when you wear the Glasses and open the Lens is the one to name.")
            }
        }
    }

    /// Active FriendFinder mode status: streaming indicator + camera flip, and the
    /// live Glasses POV during a call (friend phone only).
    @ViewBuilder
    private var friendFinderSection: some View {
        if let control = friendFinder.control {
            FriendFinderStatusView(
                control: control,
                isStreamingVideo: friendFinder.isStreamingVideo,
                isInCall: friendFinder.isInCall,
                glassesFrame: friendFinder.glassesFrame,
                streamer: friendFinder.frameStreamer,
                audio: friendFinder.audioEngine,
                callManager: friendFinder.callManager,
                videoQualityKbps: videoQualityKbps,
                onQuit: mobileKitModel.isConnected ? { mobileKitModel.sendModeExit() } : nil,
                onEndCall: friendFinder.isInCall ? { friendFinder.endCall(local: true) } : nil,
                onCycleQuality: friendFinder.isInCall ? { cycleVideoQuality() } : nil
            )
        }
    }

    /// Mark checkpoints at the phone's location + list the session's checkpoints.
    /// Incoming "was here" visits arrive via checkpointStore.banner (see `body`).
    @ViewBuilder
    private var checkpointsSection: some View {
        Text("Checkpoints")
            .font(.footnote.weight(.semibold))
            .foregroundStyle(.secondary)
            .textCase(.uppercase)
            .padding(.top, 4)

        HStack(spacing: 10) {
            TextField("Name (e.g. Main Stage)", text: $checkpointName)
                .textFieldStyle(.roundedBorder)
                .font(.subheadline)
                .autocorrectionDisabled()

            Button {
                guard let loc = locationModel.lastLocation else { return }
                checkpointStore.mark(
                    name: checkpointName,
                    lat: loc.coordinate.latitude,
                    lon: loc.coordinate.longitude,
                    deviceName: MultipeerSession.deviceDisplayName())
                checkpointName = ""
            } label: {
                Label("Mark here", systemImage: "mappin.and.ellipse")
                    .font(.subheadline.weight(.semibold))
            }
            .buttonStyle(.borderedProminent)
            .tint(.pink)
            .disabled(locationModel.lastLocation == nil)
        }

        if checkpointStore.checkpoints.isEmpty {
            Text("No checkpoints yet — tap “Mark here” to drop one at your location.")
                .font(.caption)
                .foregroundStyle(.secondary)
        } else {
            ForEach(checkpointStore.checkpoints) { cp in
                HStack(spacing: 8) {
                    Image(systemName: "mappin.circle.fill")
                        .foregroundStyle(.pink)
                    Text(cp.name)
                        .font(.caption.weight(.semibold))
                    Spacer()
                }
            }
        }

        if let err = checkpointStore.lastError {
            Text(err)
                .font(.caption2)
                .foregroundStyle(.red)
        }
    }

    private func checkpointBanner(_ text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "mappin.and.ellipse")
            Text(text)
                .font(.subheadline.weight(.semibold))
                .lineLimit(2)
            Spacer()
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.pink.opacity(0.95), in: Capsule())
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    /// Transport smoke test: sends plain text to the Lens's "test" subscription.
    /// If the text shows up on the Glasses label, the Mobile Kit link works —
    /// everything else (GPS payloads) rides the same pipe.
    private var testRow: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 10) {
                TextField("Test message to Glasses", text: $testMessage)
                    .textFieldStyle(.roundedBorder)
                    .font(.subheadline)
                    .autocorrectionDisabled()

                Button {
                    mobileKitModel.sendTestMessage(testMessage)
                } label: {
                    Image(systemName: "paperplane.fill")
                }
                .buttonStyle(.borderedProminent)
                .tint(.teal)
                .disabled(!mobileKitModel.isConnected || testMessage.isEmpty)
            }

            if let sent = mobileKitModel.lastTestSent {
                Text("Sent “\(sent)” — check the label on your Glasses")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else if !mobileKitModel.isConnected {
                Text("Send unlocks once the session connects")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }

    private var callRequestInProgress: Bool {
        switch callRequestState {
        case .calling, .ringing, .starting: return true
        default: return false
        }
    }

    private var callRequestTitle: String {
        switch callRequestState {
        case .idle, .failed: return "Video-call the Glasses wearer"
        case .calling: return "Calling…"
        case .ringing: return "Ringing — waiting for the wearer"
        case .starting: return "Starting call…"
        }
    }

    private var callRequestRow: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 10) {
                Button {
                    beginCallRequest()
                } label: {
                    Label(callRequestTitle, systemImage: "video.fill")
                        .font(.subheadline.weight(.semibold))
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .disabled(callRequestInProgress)

                // Escape hatch: a request that will never resolve (wearer
                // walked away, Glasses asleep) used to lock this row for 30 s
                // with no way out — cancel resets BOTH ends immediately.
                if callRequestInProgress {
                    Button {
                        cancelCallRequest()
                    } label: {
                        Label("Cancel", systemImage: "xmark")
                            .font(.subheadline.weight(.semibold))
                    }
                    .buttonStyle(.bordered)
                    .tint(.red)
                }

                Spacer()
            }

            if case .failed(let reason) = callRequestState {
                Text(reason)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.red)
            }
        }
        .padding(.vertical, 4)
    }

    /// Human-readable tag for an opaque bonding id: the user's nickname if set,
    /// else "Glasses …" + the shortest suffix that's unique among the pairings.
    private func bondingLabel(_ id: String) -> String {
        if let nick = mobileKitModel.nickname(for: id) { return nick }
        return "Glasses …" + uniqueSuffix(id)
    }

    /// Last 6 chars, widened to 12 if another pairing shares that suffix (so
    /// two different ids never render as the same "Glasses …xxxxxx").
    private func uniqueSuffix(_ id: String) -> String {
        let short = String(id.suffix(6))
        let collides = mobileKitModel.bondings.contains { $0.id != id && $0.id.hasSuffix(short) }
        return collides ? String(id.suffix(12)) : short
    }

    /// Picker row title with a live-state suffix so trial-and-error is fast:
    /// whichever pairing reaches "connected" when you wear the Glasses is yours.
    private func bondingRowTitle(_ id: String) -> String {
        let base = bondingLabel(id)
        if id == mobileKitModel.activeBondingId {
            return base + (mobileKitModel.isConnected ? " · connected" : " · connecting…")
        }
        if id == mobileKitModel.lastGoodBondingId { return base + " · last used" }
        return base
    }

    private func bondingRowIcon(_ id: String) -> String {
        if id == mobileKitModel.activeBondingId {
            return mobileKitModel.isConnected ? "checkmark.circle.fill" : "dot.radiowaves.left.and.right"
        }
        if id == mobileKitModel.lastGoodBondingId { return "checkmark.circle" }
        if mobileKitModel.nickname(for: id) != nil { return "eyeglasses" }
        return "circle"
    }

    private var glassesStatusText: String {
        if mobileKitModel.isConnected {
            let tag = mobileKitModel.activeBondingId.map { " (" + bondingLabel($0) + ")" } ?? ""
            return "Connected" + tag + " — streaming locations"
        }
        if mobileKitModel.sessionStarted {
            let tag = mobileKitModel.activeBondingId.map { bondingLabel($0) } ?? "Glasses"
            return "Connecting to " + tag + "… (wear them + open the Lens)"
        }
        if mobileKitModel.bondings.isEmpty { return "Not bonded — tap ⋯ to bond" }
        if mobileKitModel.preferredBonding() == nil {
            return "\(mobileKitModel.bondings.count) pairings, none verified — pick one under ⋯"
        }
        return "Bonded — tap ⋯ to start a session"
    }

    private func peerRow(_ peer: Peer) -> some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(Color.indigo.opacity(0.2))
                    .frame(width: 44, height: 44)
                Image(systemName: "person.fill")
                    .font(.title3)
                    .foregroundStyle(.indigo)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(peer.displayName)
                    .font(.subheadline.weight(.semibold))
                Text(subtitle(for: peer))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Circle()
                .fill(peer.isConnected ? Color.green : Color.secondary)
                .frame(width: 10, height: 10)
        }
        .padding(.vertical, 4)
    }

    // MARK: - Helpers

    private func subtitle(for peer: Peer) -> String {
        // UWB beats GPS whenever a fresh reading exists (~±10 cm vs ±10+ m).
        if let uwb = nearby.freshDistanceM {
            let feet = uwb * 3.28084
            var text = String(format: "%.1f ft away · UWB precise", feet)
            if let diff = heightDifferenceTo(peer) {
                let heightFeet = Int((abs(diff) * 3.28084).rounded())
                text += " · ≈\(heightFeet) ft \(diff > 0 ? "above" : "below") you"
            }
            return text
        }
        if let distance = distanceTo(peer) {
            let measurement = Measurement(value: distance, unit: UnitLength.meters)
            // Force en_US so road units stay ft/mi on any device locale —
            // the Glasses Lens shows ft everywhere and the two must match.
            var text = "\(measurement.formatted(.measurement(width: .abbreviated, usage: .road).locale(Locale(identifier: "en_US")))) away"
            if let diff = heightDifferenceTo(peer) {
                let feet = Int((abs(diff) * 3.28084).rounded())
                text += " · ≈\(feet) ft \(diff > 0 ? "above" : "below") you"
            }
            return text
        }
        return peer.isConnected ? "Connected — waiting for GPS" : "Offline"
    }

    /// Friend's height relative to me in meters (positive = friend is above me).
    /// Prefers barometer-to-barometer comparison (weather cancels between nearby
    /// phones, ~1 m relative accuracy); falls back to GPS altitude only when the
    /// difference exceeds the combined vertical uncertainty. Returns nil when the
    /// difference isn't confidently nonzero.
    private func heightDifferenceTo(_ peer: Peer) -> Double? {
        if let selfPressure = locationModel.lastPressureKPa, let friendPressure = peer.pressureKPa {
            // Hypsometric approximation with ~8435 m scale height; exact enough
            // for the <100 m differences we care about.
            let diff = log(selfPressure / friendPressure) * 8434.66
            return abs(diff) >= 3 ? diff : nil
        }
        if let selfLoc = locationModel.lastLocation, selfLoc.verticalAccuracy > 0,
           let friendAlt = peer.altitude, let friendVAcc = peer.verticalAccuracy {
            let diff = friendAlt - selfLoc.altitude
            return abs(diff) > (selfLoc.verticalAccuracy + friendVAcc) ? diff : nil
        }
        return nil
    }

    private func distanceTo(_ peer: Peer) -> CLLocationDistance? {
        guard let userLoc = locationModel.lastLocation,
              let coord = peer.coordinate else { return nil }
        let peerLoc = CLLocation(latitude: coord.latitude, longitude: coord.longitude)
        return userLoc.distance(from: peerLoc)
    }

    private func broadcastLocation() {
        multipeerSession.sendLocation(locationModel.locationJson)
        streamSelfToGlasses()
    }

    private func streamSelfToGlasses() {
        guard mobileKitModel.isConnected else { return }
        var payload = locationModel.locationJson
        guard !payload.isEmpty else { return }
        payload["name"] = MultipeerSession.deviceDisplayName()
        mobileKitModel.streamLocation(role: "self", payload: payload)
    }

    private func streamFriendToGlasses(_ peers: [Peer]) {
        guard mobileKitModel.isConnected,
              let friend = peers.first(where: { $0.coordinate != nil }),
              let coordinate = friend.coordinate else { return }
        var payload: [String: Any] = [
            "lat": coordinate.latitude,
            "lon": coordinate.longitude,
            "name": friend.displayName,
        ]
        if let accuracy = friend.horizontalAccuracy {
            payload["accuracy"] = accuracy
        }
        // Fresh UWB reading: phone-to-phone distance ≈ Glasses-to-friend
        // distance (the bonded phone rides in the wearer's pocket).
        if let uwb = nearby.freshDistanceM {
            payload["uwbDist"] = uwb
        }
        if let altitude = friend.altitude {
            payload["alt"] = altitude
            payload["vAcc"] = friend.verticalAccuracy
        }
        if let pressure = friend.pressureKPa {
            payload["pressure"] = pressure
        }
        mobileKitModel.streamLocation(role: "friend", payload: payload)
    }
}

// MARK: - FriendFinder Mode Status

/// Observes the streamer/audio engines directly so counters update live
/// (nested ObservableObjects don't publish through FriendFinderModeModel).
private struct FriendFinderStatusView: View {
    let control: FriendFinderControl
    let isStreamingVideo: Bool
    let isInCall: Bool
    let glassesFrame: UIImage?
    @ObservedObject var streamer: FrameStreamer
    @ObservedObject var audio: AudioChunkEngine
    @ObservedObject var callManager: WebRTCCallManager
    /// Call-wide video quality preset (kbps) — mirrors the lens' applied value.
    let videoQualityKbps: Int
    /// Non-nil on the phone that can end the mode (bonded/wearer phone). Sends the
    /// "leave mode" request to the Glasses, which tears down + tells the phones to stop.
    let onQuit: (() -> Void)?
    /// Non-nil on the friend phone during a call — ends the call on ALL devices by
    /// posting a cloud "bye" to the Glasses (reaches it on any network).
    let onEndCall: (() -> Void)?
    /// Non-nil on the friend phone during a call — requests the next quality
    /// preset from the lens (1K → 2K → MAX), applied to BOTH video directions.
    let onCycleQuality: (() -> Void)?

    private var qualityLabel: String {
        videoQualityKbps >= 3000 ? "MAX" : videoQualityKbps >= 1500 ? "2K" : "1K"
    }

    /// What THIS phone is doing right now, in one plain sentence.
    private var roleExplanation: String? {
        if isStreamingVideo {
            return control.call
                ? "You're in a call: this phone's camera streams to your friend's Glasses, and you see their POV below."
                : "Watch Your Back: this phone's REAR camera streams to a panel in YOUR Glasses over WebRTC."
        }
        if control.wyb {
            return "Watch Your Back runs on the Glasses wearer's own phone — nothing needed from this phone."
        }
        if control.call {
            return "The call runs between the Glasses and the friend's phone — this phone only relays the connection."
        }
        return nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                if control.find { modeBadge("Find Your Friend", "location.north.fill", .indigo) }
                if control.call { modeBadge("Call Friend", "video.fill", .green) }
                if control.wyb { modeBadge("Watch Your Back", "eye.fill", .orange) }
                Spacer()
            }

            if let explanation = roleExplanation {
                Text(explanation)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if isStreamingVideo {
                HStack(spacing: 10) {
                    Circle()
                        .fill(callManager.mediaLive ? .red : .orange)
                        .frame(width: 9, height: 9)
                    Text(callManager.mediaLive
                        ? "LIVE · \(callManager.usingFrontCamera ? "front" : "rear") camera → Glasses"
                        : "Connecting camera to your Glasses…")
                        .font(.caption.weight(.semibold))
                    Spacer()
                    Button {
                        callManager.setMicMuted(!callManager.micMuted)
                    } label: {
                        Image(systemName: callManager.micMuted ? "mic.slash.fill" : "mic.fill")
                            .font(.caption.weight(.semibold))
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                    .tint(callManager.micMuted ? .gray : .green)
                    Button {
                        callManager.flipCamera()
                    } label: {
                        Label("Flip", systemImage: "arrow.triangle.2.circlepath.camera")
                            .font(.caption.weight(.semibold))
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                    .tint(.orange)
                    if let onCycleQuality {
                        Button {
                            onCycleQuality()
                        } label: {
                            Label(qualityLabel, systemImage: "dial.medium")
                                .font(.caption.weight(.semibold))
                        }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.small)
                        .tint(.indigo)
                    }
                }
            }

            if isInCall {
                RemotePovView(
                    image: glassesFrame,
                    videoView: callManager.remoteVideoView,
                    videoLive: callManager.povVideoLive,
                    status: callManager.mediaLive
                        ? "Connected — waiting for Glasses video…"
                        : "Connecting call…\nsignaling over cloud (takes a few seconds)"
                )
                HStack(spacing: 8) {
                    Image(systemName: "waveform")
                        .foregroundStyle(.green)
                    Text(callManager.mediaLive
                        ? "Voice link · WebRTC (echo-cancelled)\(callManager.povVideoLive ? " · POV video live" : "")"
                        : "Voice link · sent \(audio.chunksSent) · recv \(audio.chunksReceived) · heard \(audio.chunksPlayed)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                // End the call from the friend's phone — posts a cloud "bye" so
                // the Glasses (and any device) tears down too, on any network.
                if let onEndCall {
                    Button(role: .destructive) {
                        onEndCall()
                    } label: {
                        Label("End call", systemImage: "phone.down.fill")
                            .font(.caption.weight(.semibold))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.red)
                    .padding(.top, 2)
                }
            }

            if let onQuit {
                Button(role: .destructive) {
                    onQuit()
                } label: {
                    Label("Quit mode", systemImage: "xmark.circle.fill")
                        .font(.caption.weight(.semibold))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(.red)
                .padding(.top, 2)
            }

            if let err = streamer.lastError ?? audio.lastError {
                Text(err)
                    .font(.caption2)
                    .foregroundStyle(.red)
            }
        }
        .padding(.vertical, 4)
    }

    private func modeBadge(_ label: String, _ icon: String, _ color: Color) -> some View {
        HStack(spacing: 5) {
            Image(systemName: icon)
                .font(.caption2.weight(.semibold))
            Text(label)
                .font(.caption.weight(.semibold))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(color.opacity(0.18), in: Capsule())
        .foregroundStyle(color)
    }
}

// MARK: - Map Annotation Model

struct PeerAnnotation: Identifiable {
    let id: String
    let name: String
    let coordinate: CLLocationCoordinate2D
}

// MARK: - User Dot

/// Custom replacement for the system location puck: always visible (the default
/// puck can vanish in heading-follow mode) and shows a heading cone.
struct UserDot: View {
    /// Degrees clockwise from screen-up; nil hides the cone.
    var heading: Double?

    var body: some View {
        ZStack {
            if let heading {
                HeadingCone()
                    .fill(
                        LinearGradient(
                            colors: [Color.blue.opacity(0.45), Color.blue.opacity(0.0)],
                            startPoint: .center,
                            endPoint: .top
                        )
                    )
                    .frame(width: 52, height: 52)
                    .rotationEffect(.degrees(heading))
            }
            Circle()
                .fill(.white)
                .frame(width: 22, height: 22)
                .shadow(color: .black.opacity(0.25), radius: 3)
            Circle()
                .fill(.blue)
                .frame(width: 16, height: 16)
        }
        .frame(width: 52, height: 52)
    }
}

/// Wedge fanning upward from the center, like the Apple Maps heading beam.
struct HeadingCone: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let center = CGPoint(x: rect.midX, y: rect.midY)
        path.move(to: center)
        path.addArc(
            center: center,
            radius: rect.width / 2,
            startAngle: .degrees(-115),
            endAngle: .degrees(-65),
            clockwise: false
        )
        path.closeSubpath()
        return path
    }
}

// MARK: - Peer Dot

struct PeerDot: View {
    var body: some View {
        ZStack {
            Circle()
                .fill(Color.indigo.opacity(0.25))
                .frame(width: 32, height: 32)
            Circle()
                .fill(Color.indigo)
                .frame(width: 14, height: 14)
                .shadow(color: Color.indigo.opacity(0.5), radius: 4)
            Circle()
                .stroke(Color.white, lineWidth: 2)
                .frame(width: 14, height: 14)
        }
    }
}
