import Foundation

public struct DemoCelebrationDelayOption: Equatable, Sendable {
    public let title: String
    public let delay: TimeInterval

    public init(title: String, delay: TimeInterval) {
        self.title = title
        self.delay = delay
    }
}

public enum DemoCelebrationOptions {
    public static let screenRecordingAppName = "Nimbus Notes"
    public static let screenRecordingProductId = "nimbusnotes.pro.yearly"

    public static let delayedOptions: [DemoCelebrationDelayOption] = [
        DemoCelebrationDelayOption(title: "Test Celebration in 3 Seconds", delay: 3),
        DemoCelebrationDelayOption(title: "Test Celebration in 5 Seconds", delay: 5)
    ]
}
