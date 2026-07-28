import XCTest
@testable import ChaChingCore

final class RevenueJSONDecoderTests: XCTestCase {
    func testDecodesEventsWithFractionalSecondISODates() throws {
        let data = """
        {
          "events": [
            {
              "id": 4,
              "sourceProvider": "superwall",
              "sourceEventId": "95709fdd-d996-4af3-aea5-dea35405a529:renewal",
              "eventType": "renewal",
              "appName": "Nimbus Notes",
              "store": "APP_STORE",
              "environment": "PRODUCTION",
              "productId": "wk_premium",
              "transactionId": "540002613767107",
              "transactionIdSuffix": "767107",
              "amount": 4.99,
              "proceeds": 4.24,
              "currency": "USD",
              "countryCode": "US",
              "purchasedAt": "2026-06-18T16:50:19.000Z",
              "receivedAt": "2026-06-18T08:50:51.478Z"
            }
          ]
        }
        """.data(using: .utf8)!

        let response = try RevenueJSONDecoder.make().decode(EventsResponse.self, from: data)

        XCTAssertEqual(response.events.first?.id, 4)
        XCTAssertEqual(response.events.first?.appName, "Nimbus Notes")
        XCTAssertEqual(response.events.first?.transactionIdSuffix, "767107")
    }

    func testDecodesRevenueSummaryBreakdowns() throws {
        let data = """
        {
          "todayRevenue": 8.85,
          "todayEvents": 3,
          "appBreakdown": [
            { "appName": "Nimbus Notes", "revenue": 8.85, "events": 3 }
          ],
          "platformBreakdown": [
            { "platform": "iOS", "revenue": 8.48, "events": 2 },
            { "platform": "Android", "revenue": 0.37, "events": 1 }
          ],
          "productBreakdown": [
            { "productId": "wk_premium", "store": "APP_STORE", "revenue": 8.48, "events": 2 },
            { "productId": "weekly:weekly", "store": "PLAY_STORE", "revenue": 0.37, "events": 1 }
          ]
        }
        """.data(using: .utf8)!

        let summary = try RevenueJSONDecoder.make().decode(RevenueSummary.self, from: data)

        XCTAssertEqual(summary.platformBreakdown.first?.platform, "iOS")
        XCTAssertEqual(summary.productBreakdown.first?.productId, "wk_premium")
        XCTAssertEqual(summary.productBreakdown.last?.store, "PLAY_STORE")
    }

    func testDecodesCombinedSyncResponse() throws {
        let data = """
        {
          "events": [],
          "summary": {
            "todayRevenue": 0,
            "todayEvents": 0,
            "appBreakdown": [],
            "platformBreakdown": [],
            "productBreakdown": []
          },
          "serverTime": "2026-07-10T12:00:00.000Z",
          "pollAfterSeconds": 60
        }
        """.data(using: .utf8)!

        let response = try RevenueJSONDecoder.make().decode(SyncResponse.self, from: data)

        XCTAssertTrue(response.events.isEmpty)
        XCTAssertEqual(response.summary.todayRevenue, 0)
        XCTAssertEqual(response.pollAfterSeconds, 60)
    }
}
