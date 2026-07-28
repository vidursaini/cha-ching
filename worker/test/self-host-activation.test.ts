import { describe, expect, it } from "vitest";
import worker from "../src/index";

describe("self-host activation", () => {
  it("rejects the wrong setup token without creating an owner", async () => {
    const db = new FakeD1();
    const response = await activate(db, "wrong-token");

    expect(response.status).toBe(403);
    expect(db.ownerCreated).toBe(false);
  });

  it("creates the internal owner and returns a device token", async () => {
    const db = new FakeD1();
    const response = await activate(db, setupToken);
    const body = await response.json<{ deviceToken: string }>();

    expect(response.status).toBe(200);
    expect(body.deviceToken).toMatch(/^cc_device_/);
    expect(db.ownerCreated).toBe(true);
    expect(db.deviceCreated).toBe(true);
  });
});

const setupToken = "self-host-test-token-that-is-long-enough";

async function activate(db: FakeD1, token: string): Promise<Response> {
  return worker.fetch(
    new Request("https://example.workers.dev/api/self-host/activate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ setupToken: token, deviceName: "Test Mac" })
    }),
    {
      DB: db as unknown as D1Database,
      DEPLOYMENT_MODE: "self_hosted",
      SELF_HOST_SETUP_TOKEN: setupToken
    } as Parameters<typeof worker.fetch>[1],
    {} as ExecutionContext
  );
}

class FakeD1 {
  ownerCreated = false;
  deviceCreated = false;

  prepare(sql: string): FakeStatement {
    return new FakeStatement(this, sql);
  }
}

class FakeStatement {
  constructor(private readonly db: FakeD1, private readonly sql: string) {}

  bind(): FakeStatement {
    return this;
  }

  async first<T>(): Promise<T | null> {
    if (this.sql.includes("FROM rate_limits")) return null;
    if (this.sql.includes("SELECT license_key FROM licenses")) {
      return (this.db.ownerCreated ? { license_key: "__self_hosted_owner__" } : null) as T | null;
    }
    return null;
  }

  async run(): Promise<{ meta: { changes: number } }> {
    if (this.sql.includes("INSERT INTO licenses")) this.db.ownerCreated = true;
    if (this.sql.includes("INSERT INTO devices")) this.db.deviceCreated = true;
    return { meta: { changes: 1 } };
  }
}
