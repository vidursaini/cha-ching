import Foundation

public struct CursorStore {
    private let key: String
    private let defaults: UserDefaults

    public init(key: String = "ChaChing.lastSeenEventID", defaults: UserDefaults = .standard) {
        self.key = key
        self.defaults = defaults
    }

    public func load() -> Int {
        defaults.integer(forKey: key)
    }

    public func saveAfterProcessing(_ events: [RevenueEvent]) {
        guard let latest = events.map(\.id).max() else { return }
        defaults.set(latest, forKey: key)
    }
}
