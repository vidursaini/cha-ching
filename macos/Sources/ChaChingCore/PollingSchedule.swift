import Foundation

public enum PollingResult: Equatable, Sendable {
    case eventsReceived(serverSuggestion: TimeInterval?)
    case idle(serverSuggestion: TimeInterval?)
    case failure(consecutiveFailures: Int)
    case notConfigured
}

public enum PollingSchedule {
    public static func interval(after result: PollingResult) -> TimeInterval {
        switch result {
        case let .eventsReceived(serverSuggestion):
            return clamp(serverSuggestion ?? 10, minimum: 5, maximum: 30)
        case let .idle(serverSuggestion):
            return clamp(serverSuggestion ?? 60, minimum: 30, maximum: 300)
        case let .failure(consecutiveFailures):
            let exponent = min(max(consecutiveFailures - 1, 0), 3)
            return min(60 * pow(2, Double(exponent)), 300)
        case .notConfigured:
            return 60
        }
    }

    private static func clamp(_ value: TimeInterval, minimum: TimeInterval, maximum: TimeInterval) -> TimeInterval {
        min(max(value, minimum), maximum)
    }
}
