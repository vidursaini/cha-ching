import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

describe("provider encryption backup migration", () => {
  it("adds rollback storage without changing existing provider configs", () => {
    const db = new DatabaseSync(":memory:");
    for (let index = 1; index <= 7; index += 1) {
      const filename = migrationFilename(index);
      db.exec(readFileSync(new URL(`../migrations/${filename}`, import.meta.url), "utf8"));
    }
    db.prepare("INSERT INTO licenses (license_key, status, created_at) VALUES (?, ?, ?)").run(
      "cc_live_test",
      "active",
      "now"
    );
    db.prepare(
      `INSERT INTO provider_configs
       (license_key, provider, display_name, enabled, encrypted_config, key_hint, webhook_path_token, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run("cc_live_test", "superwall", "Nimbus Notes", 1, "v1.legacy.ciphertext", "...hint", "cc_sw_test", "now", "now");

    db.exec(readFileSync(new URL("../migrations/0008_provider_config_encryption_rotation.sql", import.meta.url), "utf8"));

    expect(db.prepare("SELECT COUNT(*) AS count FROM provider_configs").get()).toEqual({ count: 1 });
    expect(db.prepare("SELECT encrypted_config FROM provider_configs").get()).toEqual({
      encrypted_config: "v1.legacy.ciphertext"
    });
    expect(db.prepare("SELECT COUNT(*) AS count FROM provider_config_encryption_backups").get()).toEqual({ count: 0 });
    db.close();
  });
});

function migrationFilename(index: number): string {
  const filenames = [
    "0001_initial.sql",
    "0002_provider_configs.sql",
    "0003_license_email_fulfillment.sql",
    "0004_multiple_provider_configs.sql",
    "0005_dodo_license_mirror.sql",
    "0006_rate_limits.sql",
    "0007_self_hosted_and_retention.sql"
  ];
  return filenames[index - 1]!;
}
