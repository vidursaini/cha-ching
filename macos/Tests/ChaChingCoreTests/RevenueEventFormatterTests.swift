import XCTest
@testable import ChaChingCore

final class RevenueEventFormatterTests: XCTestCase {
    func testFormatsRenewalNotificationWithoutFullTransactionID() {
        let event = DemoEventFactory.events().first!
        let formatter = RevenueEventFormatter(locale: Locale(identifier: "en_US"))

        XCTAssertEqual(formatter.title(for: event), "Nimbus Notes renewed")
        XCTAssertTrue(formatter.notificationBody(for: event).contains("$13.99"))
        XCTAssertTrue(formatter.notificationBody(for: event).contains("nimbusnotes.pro.yearly"))
        XCTAssertTrue(formatter.notificationBody(for: event).contains("App Store - United States"))
        XCTAssertTrue(formatter.notificationBody(for: event).contains("txn ...157982"))
        XCTAssertFalse(formatter.notificationBody(for: event).contains("700002054157982"))
    }

    func testCelebratoryEventsOnlyIncludePositiveRevenuePurchases() {
        let renewal = DemoEventFactory.events().first!
        let cancellation = RevenueEvent(
            id: 10,
            sourceProvider: "superwall",
            sourceEventId: "cancel",
            eventType: .cancellation,
            appName: "Nimbus Notes",
            store: "APP_STORE",
            environment: "PRODUCTION",
            productId: nil,
            transactionId: nil,
            transactionIdSuffix: nil,
            amount: 0,
            proceeds: 0,
            currency: "USD",
            countryCode: nil,
            purchasedAt: nil,
            receivedAt: Date()
        )

        XCTAssertTrue(renewal.isCelebratory)
        XCTAssertFalse(cancellation.isCelebratory)
    }

    func testDemoEventsUseScreenRecordingSafeName() {
        let events = DemoEventFactory.events()

        XCTAssertEqual(events.first?.appName, "Nimbus Notes")
        XCTAssertEqual(events.first?.productId, "nimbusnotes.pro.yearly")
    }
}
