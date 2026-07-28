import { describe, expect, it } from "vitest";
import { scopedProviderEventId } from "../src/index";

describe("scopedProviderEventId", () => {
  it("keeps global webhook event ids unchanged for backward compatibility", () => {
    expect(scopedProviderEventId(undefined, "event_123")).toBe("event_123");
  });

  it("scopes app-specific webhook event ids by provider config", () => {
    expect(scopedProviderEventId("cc_sw_nimbus", "event_123")).toBe("cc_sw_nimbus:event_123");
    expect(scopedProviderEventId("cc_sw_orbit_tasks", "event_123")).toBe("cc_sw_orbit_tasks:event_123");
  });
});
