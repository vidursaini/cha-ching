import { describe, expect, it } from "vitest";
import { operationalCleanupCutoffs } from "../src/index";

describe("operational cleanup", () => {
  const now = new Date("2026-07-10T12:00:00.000Z");

  it("uses the configured retention period and keeps rate-limit data for two days", () => {
    expect(operationalCleanupCutoffs("30", now)).toEqual({
      retentionDays: 30,
      rawWebhookBefore: "2026-06-10T12:00:00.000Z",
      rateLimitBefore: "2026-07-08T12:00:00.000Z"
    });
  });

  it("bounds invalid retention settings", () => {
    expect(operationalCleanupCutoffs("0", now).retentionDays).toBe(1);
    expect(operationalCleanupCutoffs("999", now).retentionDays).toBe(365);
    expect(operationalCleanupCutoffs("invalid", now).retentionDays).toBe(30);
  });
});
