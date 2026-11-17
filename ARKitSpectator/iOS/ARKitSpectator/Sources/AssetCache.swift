import CryptoKit
import Foundation
import GLTFKit2
import SceneKit

/// Bounded on-disk cache for streamed glTF/GLB models: two concurrent downloads, 50 MB per file,
/// 250 MB total (least recently used files are evicted). Only https URLs on allowed hosts load.
actor AssetCache {
    static let shared = AssetCache()
    static let maxFileBytes = 50_000_000
    static let maxCacheBytes = 250_000_000

    private var pending: [URL: Task<URL, Error>] = [:]
    private var active = 0
    private var waiters: [CheckedContinuation<Void, Never>] = []

    private func acquire() async {
        if active < 2 { active += 1; return }
        await withCheckedContinuation { waiters.append($0) }
    }

    private func release() {
        if waiters.isEmpty { active -= 1 } else { waiters.removeFirst().resume() }
    }

    private static var directory: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("ARKitSpectatorAssets", isDirectory: true)
    }

    /// Cache file name: hash of the full URL, keeping the extension GLTFKit2 uses to pick a parser.
    static func fileName(for url: URL) -> String {
        let digest = SHA256.hash(data: Data(url.absoluteString.utf8)).map { String(format: "%02x", $0) }.joined()
        let ext = url.pathExtension.lowercased()
        return String(digest.prefix(32)) + "." + (["glb", "gltf"].contains(ext) ? ext : "glb")
    }

    func file(for url: URL, config: SpectatorConfig) async throws -> URL {
        guard config.allowsAsset(url) else { throw SpectatorError("Model host not allowed: \(url.host ?? "?") — add it in Settings") }
        if let task = pending[url] { return try await task.value }
        let task = Task<URL, Error> {
            await acquire()
            defer { release() }
            let directory = Self.directory
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let target = directory.appendingPathComponent(Self.fileName(for: url))
            if FileManager.default.fileExists(atPath: target.path) {
                try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: target.path)
                return target
            }
            let (temporary, response) = try await URLSession.shared.download(from: url)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            let size = (try FileManager.default.attributesOfItem(atPath: temporary.path)[.size] as? NSNumber)?.intValue ?? 0
            guard size > 0, size < Self.maxFileBytes else { throw URLError(.dataLengthExceedsMaximum) }
            try? FileManager.default.removeItem(at: target)
            try FileManager.default.moveItem(at: temporary, to: target)
            Self.evict(keeping: target)
            return target
        }
        pending[url] = task
        defer { pending[url] = nil }
        return try await task.value
    }

    private static func evict(keeping keep: URL) {
        let keys: [URLResourceKey] = [.fileSizeKey, .contentModificationDateKey]
        guard let files = try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: keys) else { return }
        let sorted = files.sorted {
            let a = (try? $0.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
            let b = (try? $1.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
            return a < b
        }
        var total = sorted.reduce(0) { $0 + ((try? $1.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0) }
        for file in sorted where total > maxCacheBytes && file != keep {
            total -= (try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
            try? FileManager.default.removeItem(at: file)
        }
    }

    static func clear() {
        try? FileManager.default.removeItem(at: directory)
    }
}

/// A loaded glTF scene with its skins and animation clips.
@MainActor final class LoadedModel {
    let source: GLTFSCNSceneSource
    let root = SCNNode()
    private var current: SCNAnimationPlayer?
    private(set) var clipNames: [String] = []

    init(asset: GLTFAsset) {
        source = GLTFSCNSceneSource(asset: asset)
        for child in source.defaultScene?.rootNode.childNodes ?? [] { root.addChildNode(child) }
        clipNames = source.animations.map(\.name)
    }

    /// Plays a clip by name (nil = the first clip, looping). Returns false if the clip doesn't exist.
    @discardableResult func play(_ name: String?, loop: Bool) -> Bool {
        guard let animation = name.flatMap({ n in source.animations.first { $0.name == n } }) ?? (name == nil ? source.animations.first : nil) else { return false }
        current?.stop(withBlendOutDuration: 0.15)
        let player = animation.animationPlayer
        player.animation.repeatCount = loop ? .infinity : 1
        player.animation.blendInDuration = 0.15
        player.animation.blendOutDuration = 0.2
        player.animation.isRemovedOnCompletion = !loop
        root.addAnimationPlayer(player, forKey: "clip")
        player.play()
        current = player
        return true
    }

    func stop() { current?.stop(withBlendOutDuration: 0.15); current = nil }

    static func load(_ url: URL, config: SpectatorConfig) async throws -> LoadedModel {
        let local = try await AssetCache.shared.file(for: url, config: config)
        let asset: GLTFAsset = try await withCheckedThrowingContinuation { continuation in
            var finished = false
            GLTFAsset.load(with: local, options: [:]) { _, status, asset, error, _ in
                guard !finished else { return }
                if let error { finished = true; continuation.resume(throwing: error) }
                else if status == .complete, let asset { finished = true; continuation.resume(returning: asset) }
            }
        }
        return LoadedModel(asset: asset)
    }
}
