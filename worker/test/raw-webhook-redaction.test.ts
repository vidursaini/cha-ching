import { describe, expect, it } from "vitest";
import { MAX_RAW_WEBHOOK_PAYLOAD_CHARS, redactRawWebhookPayload } from "../src/storage";

describe("redactRawWebhookPayload", () => {
  it("redacts sensitive fields while preserving debuggable event context", () => {
    const redacted = JSON.parse(
      redactRawWebhookPayload(
        JSON.stringify({
          id: "evt_123",
          type: "subscription.renewed",
          app_name: "Screen Recording Demo",
          amount: 4.99,
          currency: "USD",
          authorization_header: "Bearer sw_secret",
          api_key: "sk_live_secret",
          receipt: "full-store-receipt",
          transaction_id: "540002613767107",
          metadata: {
            user_email: "customer@example.com",
            note: "Sent to customer@example.com with Bearer abc.def"
          },
          events: [
            {
              subscriber_id: "sub_123",
              event_type: "renewal"
            }
          ]
        })
      )
    );

    expect(redacted).toMatchObject({
      id: "evt_123",
      type: "subscription.renewed",
      app_name: "Screen Recording Demo",
      amount: 4.99,
      currency: "USD",
      authorization_header: "[redacted]",
      api_key: "[redacted]",
      receipt: "[redacted]",
      transaction_id: "[redacted]",
      metadata: {
        user_email: "[redacted]",
        note: "Sent to [redacted-email] with Bearer [redacted]"
      },
      events: [
        {
          subscriber_id: "[redacted]",
          event_type: "renewal"
        }
      ]
    });
  });

  it("redacts and caps non-json payloads", () => {
    const redacted = redactRawWebhookPayload(`raw webhook from customer@example.com with Bearer abc.def`);

    expect(redacted).toBe("raw webhook from [redacted-email] with Bearer [redacted]");
  });

  it("caps oversized raw webhook payloads before storage", () => {
    const redacted = redactRawWebhookPayload(
      JSON.stringify({
        events: Array.from({ length: 2_000 }, (_, index) => ({
          event_type: "renewal",
          app_name: `Demo App ${index}`,
          amount: 4.99
        }))
      })
    );

    expect(redacted.length).toBeLessThanOrEqual(MAX_RAW_WEBHOOK_PAYLOAD_CHARS);
    expect(redacted).toContain("[truncated");
  });
});
