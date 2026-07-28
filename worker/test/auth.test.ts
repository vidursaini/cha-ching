import { describe, expect, it } from "vitest";
import { deviceTokenFromRequest } from "../src/auth";

describe("deviceTokenFromRequest", () => {
  it("extracts bearer tokens from standard authorization headers", () => {
    const request = new Request("https://example.com/api/events", {
      headers: { authorization: "Bearer cc_device_live_123" }
    });

    expect(deviceTokenFromRequest(request)).toBe("cc_device_live_123");
  });

  it("does not accept query tokens because URLs leak through logs and history", () => {
    const request = new Request("https://example.com/api/events?deviceToken=cc_device_query_123");

    expect(deviceTokenFromRequest(request)).toBeUndefined();
  });

  it("ignores query tokens when a bearer token is present", () => {
    const request = new Request("https://example.com/api/events?deviceToken=cc_device_query_123", {
      headers: { authorization: "Bearer cc_device_header_123" }
    });

    expect(deviceTokenFromRequest(request)).toBe("cc_device_header_123");
  });
});
