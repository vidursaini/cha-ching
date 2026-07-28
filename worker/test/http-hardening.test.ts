import { describe, expect, it } from "vitest";
import worker, { allowedCorsOrigin } from "../src/index";

describe("HTTP hardening", () => {
  it("reports hosted capabilities by default for backward compatibility", async () => {
    const response = await worker.fetch(
      new Request("https://api.example.com/api/meta"),
      { DB: new FakeD1() as unknown as D1Database } as Parameters<typeof worker.fetch>[1],
      {} as ExecutionContext
    );

    await expect(response.json()).resolves.toMatchObject({
      apiVersion: 1,
      deploymentMode: "hosted",
      capabilities: { dodoLicensing: true, selfHostActivation: false, combinedSync: true }
    });
  });

  it("isolates hosted payment routes from self-hosted deployments", async () => {
    const env = {
      DB: new FakeD1() as unknown as D1Database,
      DEPLOYMENT_MODE: "self_hosted"
    } as Parameters<typeof worker.fetch>[1];

    const metadata = await worker.fetch(new Request("https://example.workers.dev/api/meta"), env, {} as ExecutionContext);
    const checkout = await worker.fetch(
      new Request("https://example.workers.dev/api/checkout", { method: "POST" }),
      env,
      {} as ExecutionContext
    );
    const hostedActivation = await worker.fetch(
      new Request("https://example.workers.dev/api/licenses/activate", { method: "POST" }),
      env,
      {} as ExecutionContext
    );

    await expect(metadata.json()).resolves.toMatchObject({ deploymentMode: "self_hosted" });
    expect(checkout.status).toBe(404);
    expect(hostedActivation.status).toBe(404);
  });

  it("allows only configured browser origins", () => {
    expect(allowedCorsOrigin("https://app.example.com", "https://app.example.com")).toBe(true);
    expect(allowedCorsOrigin("https://app.example.com")).toBe(false);
    expect(allowedCorsOrigin("https://evil.example")).toBe(false);
    expect(allowedCorsOrigin("http://localhost:5173", "http://localhost:5173")).toBe(true);
  });

  it("rejects disallowed CORS preflights", async () => {
    const response = await worker.fetch(
      new Request("https://api.example.com/api/checkout", {
        method: "OPTIONS",
        headers: { origin: "https://evil.example" }
      }),
      { DB: new FakeD1() as unknown as D1Database } as Parameters<typeof worker.fetch>[1],
      {} as ExecutionContext
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("keeps the legacy global Superwall webhook disabled by default", async () => {
    const response = await worker.fetch(
      new Request("https://api.example.com/api/webhooks/superwall", {
        method: "POST",
        body: "{}"
      }),
      { DB: new FakeD1() as unknown as D1Database } as Parameters<typeof worker.fetch>[1],
      {} as ExecutionContext
    );

    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("Legacy Superwall webhook endpoint is disabled")
    });
    expect(response.status).toBe(410);
  });
});

class FakeD1 {
  prepare(): never {
    throw new Error("FakeD1 should not be queried by this test");
  }
}
