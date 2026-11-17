import AVKit
import SwiftUI

@main struct ARKitSpectatorApp: App {
    var body: some Scene { WindowGroup { SpectatorView() } }
}

struct SpectatorView: View {
    @StateObject private var session = SpectatorSession()
    @StateObject private var scene = SpectatorScene()
    @StateObject private var recorder = ScreenRecorder()
    @State private var config = SpectatorConfig.load()
    @State private var code = ""
    @State private var expanded = true
    @State private var showingSettings = false
    @State private var reviewing = false
    @FocusState private var editingCode: Bool
    @Environment(\.scenePhase) private var appPhase

    var body: some View {
        GeometryReader { geometry in
            let landscape = geometry.size.width > geometry.size.height
            ZStack(alignment: .bottomTrailing) {
                ARSpectatorView(controller: scene).ignoresSafeArea()
                if session.room != nil && !scene.placed {
                    VStack {
                        Text("Scan a surface, then tap it").font(.subheadline.weight(.semibold))
                            .padding(12).background(.ultraThinMaterial, in: Capsule())
                        Spacer()
                    }
                    .frame(maxWidth: .infinity).padding(.top, 12).allowsHitTesting(false)
                }
                if expanded { panel(landscape: landscape, size: geometry.size) } else { collapsedControls }
            }
        }
        .preferredColorScheme(.dark)
        .onAppear { scene.config = config; if !config.isComplete { showingSettings = true } }
        .onReceive(session.$room) { room in
            scene.setActive(room != nil)
            if room != nil { expanded = false; editingCode = false } else { expanded = true }
        }
        .onReceive(session.$state) { scene.update($0, interval: session.updateInterval) }
        .onChange(of: scene.placed) { _, placed in if placed { expanded = true } }
        .onChange(of: recorder.clip) { _, clip in if clip != nil { reviewing = true; expanded = true } }
        .onChange(of: appPhase) { _, phase in if phase != .active && recorder.recording { recorder.stop() } }
        .sheet(isPresented: $showingSettings) {
            SettingsView(config: $config) {
                scene.config = config
                showingSettings = false
            }
        }
        .sheet(isPresented: $reviewing) {
            if let url = recorder.clip { ClipReview(url: url, message: recorder.message) { await recorder.saveToPhotos() } }
        }
    }

    private func panel(landscape: Bool, size: CGSize) -> some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("ARKIT SPECTATOR").font(.caption.weight(.bold)).tracking(2)
                    if let room = session.room { Text("Room \(room.code)").font(.headline.monospacedDigit()) }
                }
                Spacer()
                Button { showingSettings = true } label: { Image(systemName: "gearshape").frame(width: 38, height: 38) }
                    .accessibilityLabel("Settings").disabled(session.room != nil)
                Button { withAnimation { expanded = false }; editingCode = false } label: {
                    Image(systemName: "arrow.down.right.and.arrow.up.left").frame(width: 38, height: 38)
                }
                .accessibilityLabel("Minimize menu")
            }
            .padding(.horizontal, 16).padding(.vertical, 10)
            Divider()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if session.room == nil { joinSection } else { roomSection; placementSection }
                    Text(session.status).font(.caption).foregroundStyle(.secondary)
                    if !scene.assetStatus.isEmpty { Text(scene.assetStatus).font(.caption).foregroundStyle(.orange) }
                    if !recorder.message.isEmpty { Text(recorder.message).font(.caption).foregroundStyle(.mint) }
                }
                .padding(16)
            }
            .scrollDismissesKeyboard(.interactively)
            Divider()
            Group { if session.room == nil { joinButton } else { recordButton } }.padding(12)
        }
        .frame(width: landscape ? size.width / 2 : size.width - 24, height: landscape ? size.height - 24 : size.height / 2)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(.white.opacity(0.15)))
        .padding(12)
        .accessibilityIdentifier("spectator.menu")
    }

    private var collapsedControls: some View {
        HStack(spacing: 10) {
            if recorder.recording {
                Button { recorder.stop() } label: { Label("Stop \(timeLabel)", systemImage: "stop.circle.fill").font(.subheadline.bold()) }.tint(.red)
            } else {
                Button { withAnimation { expanded = true } } label: { Label("Menu", systemImage: "slider.horizontal.3").font(.subheadline.bold()) }
                    .accessibilityLabel("Expand menu")
            }
        }
        .buttonStyle(.borderedProminent).tint(.black.opacity(0.8)).padding(16)
    }

    @ViewBuilder private var joinSection: some View {
        Caption(title: "Join a room", detail: "Enter the 4-digit code shown in the Lens")
        TextField("0000", text: $code)
            .accessibilityIdentifier("spectator.code")
            .font(.title2.monospacedDigit()).keyboardType(.numberPad).textContentType(.oneTimeCode)
            .textFieldStyle(.roundedBorder).focused($editingCode)
            .onChange(of: code) { _, value in code = String(value.filter { $0.isASCII && $0.isNumber }.prefix(4)) }
        if !config.isComplete {
            Button { showingSettings = true } label: { Caption(title: "Set up Snap Cloud", detail: "Enter your project URL and public key") }
                .buttonStyle(.bordered).tint(.orange)
        }
    }

    @ViewBuilder private var roomSection: some View {
        HStack {
            Label(session.realtimeConnected ? "Live" : "Reconnecting", systemImage: "dot.radiowaves.left.and.right")
                .foregroundStyle(session.realtimeConnected ? .mint : .orange)
            Spacer()
            Text("\(session.state.entities.count) objects").monospacedDigit()
        }
        .font(.caption.bold())
        Button(role: .destructive) { Task { await session.leave() } } label: {
            Caption(title: "Leave room", detail: "Return to the code screen")
        }
        .disabled(recorder.recording)
    }

    @ViewBuilder private var placementSection: some View {
        Divider()
        Caption(title: scene.placed ? (scene.moving ? "Align and lock" : "Scene placed") : "Place the scene", detail: scene.hint)
        if scene.placed {
            if scene.moving {
                Button { scene.setMoving(false) } label: { Caption(title: "Lock", detail: "Keep this position") }
                    .buttonStyle(.borderedProminent).tint(.mint)
                HStack {
                    Button { scene.rotate(-15) } label: { Label("15°", systemImage: "rotate.left") }
                    Button { scene.rotate(15) } label: { Label("15°", systemImage: "rotate.right") }
                    Button { scene.replace() } label: { Label("Re-place", systemImage: "scope") }
                }
                .buttonStyle(.bordered)
                VStack(alignment: .leading, spacing: 4) {
                    HStack { Text("Display scale"); Spacer(); Text(String(format: "%.2f×", scene.displayScale)).monospacedDigit().foregroundStyle(.secondary) }
                        .font(.caption)
                    Slider(value: $scene.displayScale, in: 0.05...4).tint(.mint)
                }
            } else {
                Button { scene.setMoving(true) } label: { Caption(title: "Move", detail: "Drag, rotate or scale the scene") }
                    .buttonStyle(.bordered).disabled(recorder.recording).accessibilityIdentifier("spectator.move")
            }
        }
        Toggle("People occlusion", isOn: $scene.peopleOcclusion).font(.subheadline).disabled(!scene.peopleOcclusionSupported)
        if !scene.peopleOcclusionSupported { Text("People occlusion needs a supported iPhone camera.").font(.caption).foregroundStyle(.secondary) }
    }

    private var joinButton: some View {
        Button {
            editingCode = false
            Task { await session.join(code: code, config: config) }
        } label: {
            Caption(title: session.joining ? "Joining…" : "Join", detail: "Watch read-only from your own camera angle")
        }
        .buttonStyle(.borderedProminent).tint(.mint)
        .disabled(code.count != 4 || session.joining || !config.isComplete)
        .accessibilityIdentifier("spectator.join")
    }

    private var recordButton: some View {
        Button {
            if recorder.recording { recorder.stop() } else { scene.setMoving(false); withAnimation { expanded = false }; recorder.start() }
        } label: {
            HStack {
                Image(systemName: recorder.recording ? "stop.circle.fill" : "record.circle").font(.title2)
                Caption(title: recorder.recording ? "Stop · \(timeLabel)" : "Record screen", detail: scene.placed ? "Saves a video you can review and share" : "Place the scene first")
            }
        }
        .buttonStyle(.borderedProminent).tint(recorder.recording ? .red : .indigo)
        .disabled(recorder.phase == .finishing || recorder.phase == .starting || (!recorder.recording && !scene.placed))
    }

    private var timeLabel: String { String(format: "%02d:%02d", recorder.elapsed / 60, recorder.elapsed % 60) }
}

struct Caption: View {
    let title: String
    let detail: String
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title).font(.headline)
            Text(detail).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Snap Cloud connection settings. Use the project's PUBLIC key only.
struct SettingsView: View {
    @Binding var config: SpectatorConfig
    let done: () -> Void
    @State private var draft = SpectatorConfig()
    @State private var hosts = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("https://<project>.snapcloud.dev", text: $draft.supabaseURL)
                        .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                        .accessibilityIdentifier("settings.url")
                    SecureField("Public (publishable / anon) key", text: $draft.publishableKey)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                        .accessibilityIdentifier("settings.key")
                } header: { Text("Snap Cloud project") } footer: {
                    Text("Use the same project as the Lens. Only the public key belongs here — never a service-role key. Anonymous sign-ins must be enabled on the project.")
                }
                Section {
                    TextField("cdn.example.com, *.example.org", text: $hosts)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                } header: { Text("Extra model hosts") } footer: {
                    Text("Models from the project's own Storage are always allowed. Add other https hosts that serve your glTF/GLB files.")
                }
                Section {
                    Button("Clear model cache", role: .destructive) { AssetCache.clear() }
                    Button("Reset to app defaults") { SpectatorConfig.reset(); draft = SpectatorConfig.bundled(); hosts = draft.allowedAssetHosts.joined(separator: ", ") }
                }
            }
            .navigationTitle("Settings")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        draft.supabaseURL = draft.supabaseURL.trimmingCharacters(in: .whitespacesAndNewlines)
                        draft.publishableKey = draft.publishableKey.trimmingCharacters(in: .whitespacesAndNewlines)
                        draft.allowedAssetHosts = hosts.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                        draft.save()
                        config = draft
                        done()
                    }
                    .disabled(!draftIsComplete)
                }
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { done() } }
            }
            .onAppear { draft = config; hosts = config.allowedAssetHosts.joined(separator: ", ") }
        }
    }

    private var draftIsComplete: Bool {
        var copy = draft
        copy.supabaseURL = copy.supabaseURL.trimmingCharacters(in: .whitespacesAndNewlines)
        copy.publishableKey = copy.publishableKey.trimmingCharacters(in: .whitespacesAndNewlines)
        return copy.isComplete
    }
}

private struct ClipReview: View {
    let url: URL
    let message: String
    let save: () async -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var player: AVPlayer?

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                VideoPlayer(player: player)
                Text(message).font(.caption)
                HStack {
                    Button { Task { await save() } } label: { Label("Save to Photos", systemImage: "square.and.arrow.down") }
                    ShareLink(item: url) { Label("Share", systemImage: "square.and.arrow.up") }
                }
                .buttonStyle(.borderedProminent)
            }
            .padding()
            .navigationTitle("Recording")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .onAppear { player = AVPlayer(url: url); player?.play() }
        .onDisappear { player?.pause() }
    }
}
