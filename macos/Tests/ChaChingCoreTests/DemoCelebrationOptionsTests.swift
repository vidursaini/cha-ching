import XCTest
@testable import ChaChingCore

final class DemoCelebrationOptionsTests: XCTestCase {
    func testScreenRecordingDemoDoesNotExposeRealAppName() {
        XCTAssertEqual(DemoCelebrationOptions.screenRecordingAppName, "Nimbus Notes")
    }

    func testDelayedOptionsGiveScreenRecorderTimeToStart() {
        XCTAssertEqual(DemoCelebrationOptions.delayedOptions.map(\.title), [
            "Test Celebration in 3 Seconds",
            "Test Celebration in 5 Seconds"
        ])
        XCTAssertEqual(DemoCelebrationOptions.delayedOptions.map(\.delay), [3, 5])
    }
}
