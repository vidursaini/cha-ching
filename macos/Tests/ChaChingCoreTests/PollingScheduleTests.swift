import XCTest
@testable import ChaChingCore

final class PollingScheduleTests: XCTestCase {
    func testIdlePollingDefaultsToOneMinute() {
        XCTAssertEqual(PollingSchedule.interval(after: .idle(serverSuggestion: nil)), 60)
    }

    func testEventPollingHonorsBoundedServerSuggestion() {
        XCTAssertEqual(PollingSchedule.interval(after: .eventsReceived(serverSuggestion: 10)), 10)
        XCTAssertEqual(PollingSchedule.interval(after: .eventsReceived(serverSuggestion: 1)), 5)
        XCTAssertEqual(PollingSchedule.interval(after: .eventsReceived(serverSuggestion: 120)), 30)
    }

    func testFailuresBackOffAndCapAtFiveMinutes() {
        XCTAssertEqual(PollingSchedule.interval(after: .failure(consecutiveFailures: 1)), 60)
        XCTAssertEqual(PollingSchedule.interval(after: .failure(consecutiveFailures: 2)), 120)
        XCTAssertEqual(PollingSchedule.interval(after: .failure(consecutiveFailures: 3)), 240)
        XCTAssertEqual(PollingSchedule.interval(after: .failure(consecutiveFailures: 10)), 300)
    }
}
