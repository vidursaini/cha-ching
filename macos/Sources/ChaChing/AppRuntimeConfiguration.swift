import ChaChingCore
import Foundation

struct AppRuntimeConfiguration {
    static let hostedBaseURL = "https://chaching-api.vidursaini.com"

    static var current: AppRuntimeConfiguration {
        let rawValue = Bundle.main.object(forInfoDictionaryKey: "ChaChingDistribution") as? String
        let distribution = AppDistribution(rawValue: rawValue ?? "hosted") ?? .hosted
        return AppRuntimeConfiguration(distribution: distribution)
    }

    let distribution: AppDistribution

    var capabilities: DistributionConfiguration {
        DistributionConfiguration(distribution: distribution)
    }

    var keychainService: String {
        distribution == .hosted ? "com.vidur.chaching" : "com.vidur.chaching.community"
    }
}
