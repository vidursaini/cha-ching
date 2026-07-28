import { describe, expect, it } from "vitest";
import { migrateProviderConfigEncryption, rollbackProviderConfigEncryption } from "../src/storage";

describe("provider encryption migration storage", () => {
  it("backs up, compare-and-swaps, and rolls back ciphertext", async () => {
    const db = new FakeRotationD1("old-ciphertext");
    const input = {
      rotationId: "rotation-20260728",
      updates: [
        {
          provider: "superwall" as const,
          webhookPathToken: "cc_sw_test",
          previousEncryptedConfig: "old-ciphertext",
          migratedEncryptedConfig: "new-ciphertext"
        }
      ],
      now: "2026-07-28T00:00:00.000Z"
    };

    await expect(migrateProviderConfigEncryption(db as unknown as D1Database, input)).resolves.toEqual({
      migrated: 1,
      conflicts: 0
    });
    expect(db.ciphertext).toBe("new-ciphertext");
    expect(db.backups).toHaveLength(1);

    await expect(
      rollbackProviderConfigEncryption(db as unknown as D1Database, input.rotationId, "2026-07-28T00:01:00.000Z")
    ).resolves.toEqual({ total: 1, restored: 1, conflicts: 0 });
    expect(db.ciphertext).toBe("old-ciphertext");
  });

  it("refuses rollback when a config changed after migration", async () => {
    const db = new FakeRotationD1("old-ciphertext");
    const input = {
      rotationId: "rotation-20260728",
      updates: [
        {
          provider: "superwall" as const,
          webhookPathToken: "cc_sw_test",
          previousEncryptedConfig: "old-ciphertext",
          migratedEncryptedConfig: "new-ciphertext"
        }
      ]
    };
    await migrateProviderConfigEncryption(db as unknown as D1Database, input);
    db.ciphertext = "user-updated-ciphertext";

    await expect(rollbackProviderConfigEncryption(db as unknown as D1Database, input.rotationId)).resolves.toEqual({
      total: 1,
      restored: 0,
      conflicts: 1
    });
    expect(db.ciphertext).toBe("user-updated-ciphertext");
  });
});

type BackupRow = {
  rotation_id: string;
  provider: string;
  webhook_path_token: string;
  previous_encrypted_config: string;
  migrated_encrypted_config: string;
};

class FakeRotationD1 {
  ciphertext: string;
  backups: BackupRow[] = [];

  constructor(ciphertext: string) {
    this.ciphertext = ciphertext;
  }

  prepare(sql: string): FakeRotationStatement {
    return new FakeRotationStatement(this, sql);
  }

  async batch(statements: FakeRotationStatement[]) {
    return Promise.all(statements.map(statement => statement.run()));
  }
}

class FakeRotationStatement {
  private params: unknown[] = [];

  constructor(
    private readonly db: FakeRotationD1,
    private readonly sql: string
  ) {}

  bind(...params: unknown[]): FakeRotationStatement {
    this.params = params;
    return this;
  }

  async all<T>(): Promise<{ results: T[] }> {
    if (!this.sql.includes("FROM provider_config_encryption_backups")) return { results: [] };
    const rotationId = String(this.params[0]);
    return { results: this.db.backups.filter(row => row.rotation_id === rotationId) as T[] };
  }

  async run(): Promise<{ meta: { changes: number } }> {
    if (this.sql.includes("INSERT OR IGNORE INTO provider_config_encryption_backups")) {
      const [rotationId, provider, token, previous, migrated] = this.params.map(String);
      if (!this.db.backups.some(row => row.rotation_id === rotationId && row.provider === provider && row.webhook_path_token === token)) {
        this.db.backups.push({
          rotation_id: rotationId!,
          provider: provider!,
          webhook_path_token: token!,
          previous_encrypted_config: previous!,
          migrated_encrypted_config: migrated!
        });
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    }

    if (this.sql.includes("UPDATE provider_configs")) {
      const [replacement, , , , expected] = this.params.map(String);
      if (this.db.ciphertext !== expected) return { meta: { changes: 0 } };
      this.db.ciphertext = replacement!;
      return { meta: { changes: 1 } };
    }

    return { meta: { changes: 0 } };
  }
}
