import Foundation

public enum AppDistribution: String, Equatable, Sendable {
    case hosted
    case community
}

public struct DistributionConfiguration: Equatable, Sendable {
    public let distribution: AppDistribution

    public init(distribution: AppDistribution) {
        self.distribution = distribution
    }

    public var requiresLicense: Bool { distribution == .hosted }
    public var allowsCustomBackend: Bool { distribution == .community }
    public var supportsOfficialUpdates: Bool { distribution == .hosted }
}
