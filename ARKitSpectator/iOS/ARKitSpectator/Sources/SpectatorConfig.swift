import Foundation

/// Snap Cloud connection settings. Defaults come from the bundled SpectatorConfig.plist (empty in the
/// package); values entered in Settings are stored in UserDefaults and take precedence.
/// Only the project's public (publishable / anon) key belongs here — never a service-role key.
struct SpectatorConfig: Codable, Equatable {
    var supabaseURL: String = ""
    var publishableKey: String = ""
    /// Extra hosts glTF models may be downloaded from (the project host is always allowed).
    var allowedAssetHosts: [String] = []

    private static let storageKey = "arkitSpectator.config"

    static func bundled(_ bundle: Bundle = .main) -> SpectatorConfig {
        guard let url = bundle.url(forResource: "SpectatorConfig", withExtension: "plist"),
              let dict = NSDictionary(contentsOf: url) as? [String: Any] else { return SpectatorConfig() }
        return SpectatorConfig(
            supabaseURL: (dict["SupabaseURL"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines),
            publishableKey: (dict["SupabasePublishableKey"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines),
            allowedAssetHosts: dict["AllowedAssetHosts"] as? [String] ?? [])
    }

    static func load(_ defaults: UserDefaults = .standard) -> SpectatorConfig {
        if let data = defaults.data(forKey: storageKey),
           let stored = try? JSONDecoder().decode(SpectatorConfig.self, from: data), stored.isComplete {
            return stored
        }
        return bundled()
    }

    func save(_ defaults: UserDefaults = .standard) {
        if let data = try? JSONEncoder().encode(self) { defaults.set(data, forKey: Self.storageKey) }
    }

    static func reset(_ defaults: UserDefaults = .standard) { defaults.removeObject(forKey: storageKey) }

    /// The project URL when it is a valid https URL.
    var url: URL? {
        guard let url = URL(string: supabaseURL.trimmingCharacters(in: .whitespacesAndNewlines)),
              url.scheme == "https", url.host?.isEmpty == false else { return nil }
        return url
    }

    var isComplete: Bool { url != nil && !publishableKey.trimmingCharacters(in: .whitespaces).isEmpty }

    /// Whether a model URL may be downloaded: https on the project host or an allowed host.
    func allowsAsset(_ asset: URL) -> Bool {
        guard asset.scheme == "https", let host = asset.host?.lowercased() else { return false }
        var patterns = allowedAssetHosts.map { $0.trimmingCharacters(in: .whitespaces).lowercased() }.filter { !$0.isEmpty }
        if let projectHost = url?.host?.lowercased() { patterns.append(projectHost) }
        return patterns.contains { pattern in
            if pattern.hasPrefix("*.") { return host.hasSuffix(String(pattern.dropFirst(1))) }
            return host == pattern
        }
    }
}
