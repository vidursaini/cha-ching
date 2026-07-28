import { describe, expect, it } from "vitest";
import { listProviderConfigs, upsertProviderConfig } from "../src/storage";
import type { ProviderName } from "../src/types";

describe("provider config storage", () => {
  it("stores multiple app configs per provider without overwriting other apps", async () => {
    const db = new FakeD1();

    const nimbusDraft = await upsertProviderConfig(db as unknown as D1Database, {
      licenseKey: "cc_live_test",
      provider: "superwall",
      displayName: "Nimbus Notes",
      enabled: false,
      encryptedConfig: "encrypted-draft"
    });
    const nimbusSaved = await upsertProviderConfig(db as unknown as D1Database, {
      licenseKey: "cc_live_test",
      provider: "superwall",
      configId: nimbusDraft.id,
      displayName: "Nimbus Notes",
      enabled: true,
      encryptedConfig: "encrypted-saved",
      keyHint: "...cret"
    });
    const orbitTasks = await upsertProviderConfig(db as unknown as D1Database, {
      licenseKey: "cc_live_test",
      provider: "superwall",
      displayName: "Orbit Tasks",
      enabled: true,
      encryptedConfig: "encrypted-orbit-tasks",
      keyHint: "...asks"
    });

    expect(nimbusSaved.id).toBe(nimbusDraft.id);
    expect(orbitTasks.id).not.toBe(nimbusSaved.id);

    const configs = await listProviderConfigs(db as unknown as D1Database, "cc_live_test");

    expect(configs).toHaveLength(2);
    expect(configs.map((config) => config.displayName).sort()).toEqual(["Nimbus Notes", "Orbit Tasks"]);
    expect(configs.find((config) => config.id === orbitTasks.id)).toMatchObject({
      id: orbitTasks.id,
      provider: "superwall",
      enabled: true,
      keyHint: "...asks"
    });
  });

  it("updates an existing named config for older clients that do not send configId", async () => {
    const db = new FakeD1();

    const first = await upsertProviderConfig(db as unknown as D1Database, {
      licenseKey: "cc_live_test",
      provider: "revenuecat",
      displayName: "Nimbus Notes",
      enabled: false,
      encryptedConfig: "encrypted-draft"
    });
    const second = await upsertProviderConfig(db as unknown as D1Database, {
      licenseKey: "cc_live_test",
      provider: "revenuecat",
      displayName: "Nimbus Notes",
      enabled: true,
      encryptedConfig: "encrypted-saved",
      keyHint: "...auth"
    });

    expect(second.id).toBe(first.id);
    expect(await listProviderConfigs(db as unknown as D1Database, "cc_live_test")).toHaveLength(1);
  });
});

type ProviderConfigRow = {
  license_key: string;
  provider: ProviderName;
  display_name: string | null;
  enabled: number;
  encrypted_config: string;
  key_hint: string | null;
  webhook_path_token: string;
  created_at: string;
  updated_at: string;
};

class FakeD1 {
  providerConfigs: ProviderConfigRow[] = [];

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
    if (this.sql.includes("webhook_path_token = ?")) {
      const [licenseKey, provider, token] = this.params.map(String);
      return (this.db.providerConfigs.find(
        (row) => row.license_key === licenseKey && row.provider === provider && row.webhook_path_token === token
      ) ?? null) as T | null;
    }

    if (this.sql.includes("lower(display_name) = lower(?)")) {
      const licenseKey = String(this.params[0]);
      const provider = String(this.params[1]);
      const displayName = String(this.params[2]);
      return (this.db.providerConfigs.find(
        (row) =>
          row.license_key === licenseKey &&
          row.provider === provider &&
          (row.display_name ?? "").toLowerCase() === displayName.toLowerCase()
      ) ?? null) as T | null;
    }

    return null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    if (this.sql.includes("FROM provider_configs") && this.sql.includes("WHERE license_key = ?")) {
      const licenseKey = String(this.params[0]);
      const results = this.db.providerConfigs
        .filter((row) => row.license_key === licenseKey)
        .sort((left, right) =>
          `${left.provider}:${left.display_name ?? ""}:${left.created_at}`.localeCompare(
            `${right.provider}:${right.display_name ?? ""}:${right.created_at}`
          )
        );
      return { results: results as T[] };
    }

    return { results: [] };
  }

  async run(): Promise<{ meta: { changes: number } }> {
    if (!this.sql.includes("INSERT INTO provider_configs")) {
      return { meta: { changes: 0 } };
    }

    const [
      licenseKey,
      provider,
      displayName,
      enabled,
      encryptedConfig,
      keyHint,
      webhookPathToken,
      createdAt,
      updatedAt
    ] = this.params;
    const existing = this.db.providerConfigs.find(
      (row) => row.provider === provider && row.webhook_path_token === webhookPathToken
    );

    if (existing) {
      existing.display_name = typeof displayName === "string" ? displayName : null;
      existing.enabled = Number(enabled);
      existing.encrypted_config = String(encryptedConfig);
      existing.key_hint = typeof keyHint === "string" ? keyHint : null;
      existing.updated_at = String(updatedAt);
      return { meta: { changes: 1 } };
    }

    this.db.providerConfigs.push({
      license_key: String(licenseKey),
      provider: provider as ProviderName,
      display_name: typeof displayName === "string" ? displayName : null,
      enabled: Number(enabled),
      encrypted_config: String(encryptedConfig),
      key_hint: typeof keyHint === "string" ? keyHint : null,
      webhook_path_token: String(webhookPathToken),
      created_at: String(createdAt),
      updated_at: String(updatedAt)
    });

    return { meta: { changes: 1 } };
  }
}
