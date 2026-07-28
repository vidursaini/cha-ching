import { describe, expect, it } from "vitest";
import { licenseKeyForDevice } from "../src/storage";

describe("device heartbeat", () => {
  it("does not write last_seen_at for every authenticated request", async () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    const db = new FakeD1("2026-07-10T06:00:00.000Z");

    await expect(licenseKeyForDevice(db as unknown as D1Database, "device", now)).resolves.toBe("license");
    expect(db.heartbeatWrites).toBe(0);
  });

  it("updates last_seen_at after one day", async () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    const db = new FakeD1("2026-07-08T12:00:00.000Z");

    await expect(licenseKeyForDevice(db as unknown as D1Database, "device", now)).resolves.toBe("license");
    expect(db.heartbeatWrites).toBe(1);
    expect(db.lastSeenAt).toBe(now.toISOString());
  });
});

class FakeD1 {
  heartbeatWrites = 0;

  constructor(public lastSeenAt: string) {}

  prepare(sql: string): FakeStatement {
    return new FakeStatement(this, sql);
  }
}

class FakeStatement {
  private params: unknown[] = [];

  constructor(private readonly db: FakeD1, private readonly sql: string) {}

  bind(...params: unknown[]): FakeStatement {
    this.params = params;
    return this;
  }

  async first<T>(): Promise<T | null> {
    return { license_key: "license", last_seen_at: this.db.lastSeenAt } as T;
  }

  async run(): Promise<{ meta: { changes: number } }> {
    if (this.sql.startsWith("UPDATE devices SET last_seen_at")) {
      this.db.heartbeatWrites += 1;
      this.db.lastSeenAt = String(this.params[0]);
    }
    return { meta: { changes: 1 } };
  }
}
