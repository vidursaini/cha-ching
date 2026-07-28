import { describe, expect, it } from "vitest";
import { decryptJSON, encryptJSON } from "../src/crypto";
import {
  ProviderConfigDecryptionError,
  decryptProviderConfig,
  planProviderEncryptionMigration,
  providerEncryptionKeyring
} from "../src/providerEncryption";
import type { ProviderConfigRecord } from "../src/storage";

describe("provider encryption key rotation", () => {
  it("uses the next key for writes while retaining the current key for reads", () => {
    expect(providerEncryptionKeyring({ current: "old-key", next: "new-key" })).toEqual({
      primary: "new-key",
      previous: "old-key"
    });
    expect(providerEncryptionKeyring({ current: "same-key", next: "same-key" })).toEqual({ primary: "same-key" });
    expect(providerEncryptionKeyring({ current: "current-key" })).toEqual({ primary: "current-key" });
  });

  it("migrates legacy ciphertext to the primary key without exposing plaintext", async () => {
    const oldKey = "old-provider-key";
    const newKey = "new-provider-key";
    const secretConfig = { webhookSecret: "whsec_private_value", displayName: "Nimbus Notes" };
    const record = providerRecord(await encryptJSON(secretConfig, oldKey));
    const keyring = { primary: newKey, previous: oldKey };

    const plan = await planProviderEncryptionMigration([record], keyring);

    expect(plan).toMatchObject({ total: 1, alreadyPrimary: 0 });
    expect(plan.updates).toHaveLength(1);
    await expect(decryptJSON(plan.updates[0]!.migratedEncryptedConfig, newKey)).resolves.toEqual(secretConfig);
    await expect(decryptJSON(plan.updates[0]!.migratedEncryptedConfig, oldKey)).rejects.toThrow();
    expect(JSON.stringify(plan)).not.toContain(secretConfig.webhookSecret);
  });

  it("is idempotent after records have already moved to the primary key", async () => {
    const keyring = { primary: "new-provider-key", previous: "old-provider-key" };
    const original = providerRecord(await encryptJSON({ webhookSecret: "whsec_test" }, keyring.previous));
    const first = await planProviderEncryptionMigration([original], keyring);
    const migrated = providerRecord(first.updates[0]!.migratedEncryptedConfig);

    const second = await planProviderEncryptionMigration([migrated], keyring);

    expect(second).toEqual({ total: 1, alreadyPrimary: 1, updates: [] });
  });

  it("supports current-key-only legacy deployments", async () => {
    const ciphertext = await encryptJSON({ authorizationHeader: "Bearer rc_test" }, "current-key");
    const result = await decryptProviderConfig(ciphertext, { primary: "current-key" });

    expect(result.key).toBe("primary");
    expect(result.value).toEqual({ authorizationHeader: "Bearer rc_test" });
  });

  it("returns a fixed error for corrupted or unknown ciphertext", async () => {
    const ciphertext = "v1.sensitive-ciphertext-fragment.corrupted";
    const promise = decryptProviderConfig(ciphertext, { primary: "new-secret", previous: "old-secret" });

    await expect(promise).rejects.toBeInstanceOf(ProviderConfigDecryptionError);
    await expect(promise).rejects.not.toThrow(/sensitive|new-secret|old-secret/);
  });
});

function providerRecord(encryptedConfig: string): ProviderConfigRecord {
  return {
    id: "cc_sw_test",
    licenseKey: "cc_live_test",
    provider: "superwall",
    displayName: "Nimbus Notes",
    enabled: true,
    encryptedConfig,
    keyHint: "...alue",
    webhookPathToken: "cc_sw_test",
    updatedAt: "2026-07-28T00:00:00.000Z"
  };
}
