import XCTest
@testable import ChaChingCore

final class AppDistributionTests: XCTestCase {
    func testHostedCapabilitiesRequireLicenseAndOfficialBackend() {
        let configuration = DistributionConfiguration(distribution: .hosted)

        XCTAssertTrue(configuration.requiresLicense)
        XCTAssertFalse(configuration.allowsCustomBackend)
        XCTAssertTrue(configuration.supportsOfficialUpdates)
    }

    func testCommunityCapabilitiesUseCustomBackendWithoutLicense() {
        let configuration = DistributionConfiguration(distribution: .community)

        XCTAssertFalse(configuration.requiresLicense)
        XCTAssertTrue(configuration.allowsCustomBackend)
        XCTAssertFalse(configuration.supportsOfficialUpdates)
    }
}
