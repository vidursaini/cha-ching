import XCTest
@testable import ChaChingCore

final class FirstRunActivationPolicyTests: XCTestCase {
    func testFreshInstallOpensConnectWindow() {
        XCTAssertTrue(
            FirstRunActivationPolicy.shouldOpenConnectWindow(
                hasDeviceToken: false,
                isAutoDemoRequested: false
            )
        )
    }

    func testActivatedInstallDoesNotOpenConnectWindow() {
        XCTAssertFalse(
            FirstRunActivationPolicy.shouldOpenConnectWindow(
                hasDeviceToken: true,
                isAutoDemoRequested: false
            )
        )
    }

    func testAutoDemoLaunchDoesNotOpenConnectWindow() {
        XCTAssertFalse(
            FirstRunActivationPolicy.shouldOpenConnectWindow(
                hasDeviceToken: false,
                isAutoDemoRequested: true
            )
        )
    }
}
