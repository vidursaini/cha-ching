import XCTest
@testable import ChaChingCore

final class PollingModeResolverTests: XCTestCase {
    func testDemoModeWithoutActivatedDeviceUsesDemoOnly() {
        XCTAssertTrue(PollingModeResolver.shouldUseDemoOnly(demoMode: true, hasDeviceToken: false))
    }

    func testActivatedDevicePollsLiveEvenIfDemoModeWasLeftOn() {
        XCTAssertFalse(PollingModeResolver.shouldUseDemoOnly(demoMode: true, hasDeviceToken: true))
    }

    func testNonDemoModeNeverUsesDemoOnly() {
        XCTAssertFalse(PollingModeResolver.shouldUseDemoOnly(demoMode: false, hasDeviceToken: false))
        XCTAssertFalse(PollingModeResolver.shouldUseDemoOnly(demoMode: false, hasDeviceToken: true))
    }
}
