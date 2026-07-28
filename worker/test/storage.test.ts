import { describe, expect, it } from "vitest";
import { summarizeRevenueEvents } from "../src/storage";
import type { PublicRevenueEvent } from "../src/types";

describe("summarizeRevenueEvents", () => {
  it("summarizes only the events it is given", () => {
    const summary = summarizeRevenueEvents([
      event({ id: 2, proceeds: 4.24, sourceEventId: "ios-1" }),
      event({
        id: 3,
        proceeds: 0.37,
        sourceEventId: "android-1",
        store: "PLAY_STORE",
        productId: "weekly:weekly",
        transactionId: "GPA.123"
      }),
      event({ id: 4, proceeds: 4.24, sourceEventId: "ios-2" })
    ]);

    expect(summary.todayEvents).toBe(3);
    expect(summary.todayRevenue).toBeCloseTo(8.85);
    expect(summary.biggestEvent?.proceeds).toBe(4.24);
    expect(summary.latestEvent?.id).toBe(4);
    expect(summary.appBreakdown).toEqual([
      { appName: "Nimbus Notes", revenue: 8.850000000000001, events: 3 }
    ]);
    expect(summary.platformBreakdown).toEqual([
      { platform: "iOS", revenue: 8.48, events: 2 },
      { platform: "Android", revenue: 0.37, events: 1 }
    ]);
    expect(summary.productBreakdown).toEqual([
      { productId: "wk_premium", store: "APP_STORE", revenue: 8.48, events: 2 },
      { productId: "weekly:weekly", store: "PLAY_STORE", revenue: 0.37, events: 1 }
    ]);
  });
});

function event(overrides: Partial<PublicRevenueEvent>): PublicRevenueEvent {
  return {
    id: 1,
    sourceProvider: "superwall",
    sourceEventId: "event",
    eventType: "renewal",
    appName: "Nimbus Notes",
    store: "APP_STORE",
    environment: "PRODUCTION",
    productId: "wk_premium",
    transactionId: "540002613767107",
    transactionIdSuffix: "767107",
    amount: 4.99,
    proceeds: 4.24,
    currency: "USD",
    countryCode: "US",
    purchasedAt: "2026-06-18T16:50:19.000Z",
    receivedAt: "2026-06-18T08:50:51.478Z",
    ...overrides
  };
}
