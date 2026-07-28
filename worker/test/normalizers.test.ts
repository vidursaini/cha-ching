import { describe, expect, it } from "vitest";
import { normalizeDemoEvent, normalizeRevenueCatEvent, normalizeSuperwallEvent } from "../src/normalizers";

describe("normalizeSuperwallEvent", () => {
  it("maps renewal payloads into public revenue events without sensitive user text", () => {
    const event = normalizeSuperwallEvent({
      type: "renewal",
      projectId: 3827,
      applicationId: 1,
      timestamp: 1754067715103,
      data: {
        id: "event_123:renewal",
        name: "renewal",
        transactionId: "700002054157982",
        originalTransactionId: "700002050981465",
        store: "APP_STORE",
        environment: "PRODUCTION",
        productId: "com.example.nimbus.yearly",
        bundleId: "com.example.nimbus",
        price: 19.99,
        proceeds: 13.99,
        currencyCode: "USD",
        countryCode: "US",
        purchasedAt: 1754067704000,
        originalAppUserId: "private-user-id"
      }
    });

    expect(event.sourceProvider).toBe("superwall");
    expect(event.sourceEventId).toBe("event_123:renewal");
    expect(event.eventType).toBe("renewal");
    expect(event.appName).toBe("Nimbus");
    expect(event.proceeds).toBe(13.99);
    expect(JSON.stringify(event)).not.toContain("private-user-id");
  });

  it("keeps unknown event payloads instead of pretending they are purchases", () => {
    const event = normalizeSuperwallEvent({
      type: "some_new_event",
      data: { id: "event_456", name: "some_new_event", price: 0 }
    });

    expect(event.eventType).toBe("unknown");
    expect(event.amount).toBe(0);
  });

  it("derives a fallback app name when no configured display name is available", () => {
    const event = normalizeSuperwallEvent({
      type: "renewal",
      timestamp: 1754067715103,
      data: {
        id: "event_nimbus:renewal",
        name: "renewal",
        bundleId: "com.example.nimbus-notes",
        productId: "weekly:weekly",
        price: 4.99,
        proceeds: 3.49
      }
    });

    expect(event.appName).toBe("Nimbus Notes");
  });
});

describe("normalizeRevenueCatEvent", () => {
  it("maps a renewal without retaining subscriber identity", () => {
    const event = normalizeRevenueCatEvent({
      api_version: "1.0",
      event: {
        id: "rc_event_123",
        type: "RENEWAL",
        app_id: "app_nimbus",
        app_user_id: "private-user-id",
        country_code: "US",
        currency: "USD",
        environment: "PRODUCTION",
        price_in_purchased_currency: 9.99,
        product_id: "nimbus.pro.yearly",
        purchased_at_ms: 1754067704000,
        store: "APP_STORE",
        takehome_percentage: 0.7,
        transaction_id: "170000869511114",
        original_transaction_id: "170000869500000"
      }
    });

    expect(event.sourceProvider).toBe("revenuecat");
    expect(event.eventType).toBe("renewal");
    expect(event.amount).toBe(9.99);
    expect(event.proceeds).toBeCloseTo(6.993);
    expect(JSON.stringify(event)).not.toContain("private-user-id");
  });

  it("maps customer-support cancellations to negative refunds", () => {
    const event = normalizeRevenueCatEvent({
      event: {
        id: "rc_refund_123",
        type: "CANCELLATION",
        cancel_reason: "CUSTOMER_SUPPORT",
        price: 4.99,
        currency: "USD"
      }
    });

    expect(event.eventType).toBe("refund");
    expect(event.amount).toBe(-4.99);
    expect(event.proceeds).toBe(-4.99);
  });
});

describe("normalizeDemoEvent", () => {
  it("creates screenshot-safe demo events", () => {
    const event = normalizeDemoEvent({ amount: 59.99, proceeds: 59.99 });
    expect(event.sourceProvider).toBe("demo");
    expect(event.appName).toBe("Nimbus Notes");
    expect(event.currency).toBe("USD");
    expect(event.sourceEventId.length).toBeGreaterThan(0);
  });
});
