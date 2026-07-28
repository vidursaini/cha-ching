import XCTest
@testable import ChaChingCore

final class DemoControlsPolicyTests: XCTestCase {
    func testDemoControlsAreHiddenByDefault() {
        XCTAssertFalse(
            DemoControlsPolicy.shouldShowDemoControls(
                environment: [:],
                arguments: ["ChaChing"],
                userDefaultsEnabled: false
            )
        )
    }

    func testDemoControlsCanBeEnabledForDeveloperBuildsWithEnvironment() {
        XCTAssertTrue(
            DemoControlsPolicy.shouldShowDemoControls(
                environment: ["CHACHING_DEMO_CONTROLS": "1"],
                arguments: ["ChaChing"],
                userDefaultsEnabled: false
            )
        )
    }

    func testDemoControlsCanBeEnabledForLocalCopiesWithArgument() {
        XCTAssertTrue(
            DemoControlsPolicy.shouldShowDemoControls(
                environment: [:],
                arguments: ["ChaChing", "--chaching-demo-controls"],
                userDefaultsEnabled: false
            )
        )
    }

    func testDemoControlsCanBeEnabledForADeveloperMachineWithDefaultsFlag() {
        XCTAssertTrue(
            DemoControlsPolicy.shouldShowDemoControls(
                environment: [:],
                arguments: ["ChaChing"],
                userDefaultsEnabled: true
            )
        )
    }
}
