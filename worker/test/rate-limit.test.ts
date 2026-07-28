import { describe, expect, it } from "vitest";
import { recordRateLimitHit } from "../src/storage";

describe("recordRateLimitHit", () => {
  it("blocks requests after the limit until the window resets", async () => {
    const db = new FakeD1();

    await expect(
      recordRateLimitHit(db as unknown as D1Database, {
        bucket: "license-activation:203.0.113.10",
        limit: 2,
        windowSeconds: 60,
        nowSeconds: 1_000
      })
    ).resolves.toEqual({ allowed: true, retryAfterSeconds: 60 });

    await expect(
      recordRateLimitHit(db as unknown as D1Database, {
        bucket: "license-activation:203.0.113.10",
        limit: 2,
        windowSeconds: 60,
        nowSeconds: 1_010
      })
    ).resolves.toMatchObject({ allowed: true });

    await expect(
      recordRateLimitHit(db as unknown as D1Database, {
        bucket: "license-activation:203.0.113.10",
        limit: 2,
        windowSeconds: 60,
        nowSeconds: 1_020
      })
    ).resolves.toEqual({ allowed: false, retryAfterSeconds: 40 });

    await expect(
      recordRateLimitHit(db as unknown as D1Database, {
        bucket: "license-activation:203.0.113.10",
        limit: 2,
        windowSeconds: 60,
        nowSeconds: 1_061
      })
    ).resolves.toEqual({ allowed: true, retryAfterSeconds: 60 });
  });
});

type RateLimitRow = {
  bucket: string;
  window_start: number;
  request_count: number;
  updated_at: string;
};

class FakeD1 {
  rows = new Map<string, RateLimitRow>();

  prepare(sql: string): FakeD1Statement {
    return new FakeD1Statement(this, sql);
  }
}

class FakeD1Statement {
  private params: unknown[] = [];

  constructor(
    private readonly db: FakeD1,
    private readonly sql: string
  ) {}

  bind(...params: unknown[]): FakeD1Statement {
    this.params = params;
    return this;
  }

  async first<T>(): Promise<T | null> {
    if (this.sql.includes("FROM rate_limits")) {
      return (this.db.rows.get(String(this.params[0])) ?? null) as T | null;
    }

    return null;
  }

  async run(): Promise<{ meta: { changes: number } }> {
    if (this.sql.includes("INSERT INTO rate_limits")) {
      const [bucket, windowStart, updatedAt] = this.params;
      this.db.rows.set(String(bucket), {
        bucket: String(bucket),
        window_start: Number(windowStart),
        request_count: 1,
        updated_at: String(updatedAt)
      });
      return { meta: { changes: 1 } };
    }

    if (this.sql.includes("UPDATE rate_limits SET request_count = request_count + 1")) {
      const [updatedAt, bucket] = this.params;
      const row = this.db.rows.get(String(bucket));
      if (!row) return { meta: { changes: 0 } };
      row.request_count += 1;
      row.updated_at = String(updatedAt);
      return { meta: { changes: 1 } };
    }

    return { meta: { changes: 0 } };
  }
}
