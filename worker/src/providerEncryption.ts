import { decryptJSON, encryptJSON } from "./crypto";
import type { ProviderConfigRecord } from "./storage";

export type ProviderEncryptionKeyring = {
  primary: string;
  previous?: string | undefined;
};

export type ProviderEncryptionMigrationUpdate = {
  provider: ProviderConfigRecord["provider"];
  webhookPathToken: string;
  previousEncryptedConfig: string;
  migratedEncryptedConfig: string;
};

export class ProviderConfigDecryptionError extends Error {
  constructor() {
    super("Provider configuration could not be decrypted with the configured keyring");
    this.name = "ProviderConfigDecryptionError";
  }
}

export function providerEncryptionKeyring(input: {
  current?: string | undefined;
  next?: string | undefined;
}): ProviderEncryptionKeyring | undefined {
  const current = normalizedKey(input.current);
  const next = normalizedKey(input.next);
  if (!next && !current) return undefined;
  if (!next) return { primary: current! };
  return current && current !== next ? { primary: next, previous: current } : { primary: next };
}

export async function decryptProviderConfig<T>(
  encryptedConfig: string,
  keyring: ProviderEncryptionKeyring
): Promise<{ value: T; key: "primary" | "previous" }> {
  try {
    return { value: await decryptJSON<T>(encryptedConfig, keyring.primary), key: "primary" };
  } catch {
    if (keyring.previous) {
      try {
        return { value: await decryptJSON<T>(encryptedConfig, keyring.previous), key: "previous" };
      } catch {
        // Return one fixed error so ciphertext and key material never reach logs or API responses.
      }
    }
  }

  throw new ProviderConfigDecryptionError();
}

export async function planProviderEncryptionMigration(
  records: ProviderConfigRecord[],
  keyring: ProviderEncryptionKeyring
): Promise<{
  total: number;
  alreadyPrimary: number;
  updates: ProviderEncryptionMigrationUpdate[];
}> {
  const decrypted = await Promise.all(
    records.map(async record => ({ record, result: await decryptProviderConfig<unknown>(record.encryptedConfig, keyring) }))
  );
  const updates: ProviderEncryptionMigrationUpdate[] = [];
  let alreadyPrimary = 0;

  for (const item of decrypted) {
    if (item.result.key === "primary") {
      alreadyPrimary += 1;
      continue;
    }

    updates.push({
      provider: item.record.provider,
      webhookPathToken: item.record.webhookPathToken,
      previousEncryptedConfig: item.record.encryptedConfig,
      migratedEncryptedConfig: await encryptJSON(item.result.value, keyring.primary)
    });
  }

  return { total: records.length, alreadyPrimary, updates };
}

function normalizedKey(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}
