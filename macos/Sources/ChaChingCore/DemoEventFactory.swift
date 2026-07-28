import Foundation

public enum DemoEventFactory {
    public static func events(now: Date = Date()) -> [RevenueEvent] {
        [
            RevenueEvent(
                id: 1,
                sourceProvider: "demo",
                sourceEventId: "demo-renewal",
                eventType: .renewal,
                appName: DemoCelebrationOptions.screenRecordingAppName,
                store: "APP_STORE",
                environment: "DEMO",
                productId: DemoCelebrationOptions.screenRecordingProductId,
                transactionId: "demo_700002054157982",
                transactionIdSuffix: "157982",
                amount: 19.99,
                proceeds: 13.99,
                currency: "USD",
                countryCode: "US",
                purchasedAt: now,
                receivedAt: now
            ),
            RevenueEvent(
                id: 2,
                sourceProvider: "demo",
                sourceEventId: "demo-yearly",
                eventType: .initialPurchase,
                appName: "Orbit Tasks",
                store: "APP_STORE",
                environment: "DEMO",
                productId: "orbit-tasks.yearly",
                transactionId: "demo_700002050981465",
                transactionIdSuffix: "981465",
                amount: 59.99,
                proceeds: 41.99,
                currency: "USD",
                countryCode: "CA",
                purchasedAt: now,
                receivedAt: now
            )
        ]
    }
}
