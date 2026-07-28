import type { NormalizedRevenueEvent, ProviderName, PublicRevenueEvent, RevenueSummary } from "./types";
import { randomToken } from "./crypto";

type RawWebhookInput = {
  id: string;
  provider: string;
  providerEventId?: string | undefined;
  eventType?: string | undefined;
  licenseKey?: string | undefined;
  receivedAt: string;
  signatureValid: boolean;
  processingStatus: "received" | "processed" | "duplicate" | "failed";
  errorMessage?: string | undefined;
  rawPayload: string;
  headersJson: string;
};

export const MAX_RAW_WEBHOOK_PAYLOAD_CHARS = 32_768;

const MAX_RAW_WEBHOOK_STRING_CHARS = 2_048;
const RAW_WEBHOOK_PREVIEW_CHARS = 512;
const MAX_RAW_WEBHOOK_REDACTION_DEPTH = 10;
const REDACTED_VALUE = "[redacted]";

const sensitiveRawWebhookKeyPattern =
  /authorization|auth[_-]?header|secret|token|api[_-]?key|password|bearer|email|phone|address|ip[_-]?address|receipt|customer|subscriber|app[_-]?user[_-]?id|original[_-]?app[_-]?user[_-]?id|transaction[_-]?id|original[_-]?transaction[_-]?id|purchase[_-]?token|idfa|idfv|advertising/i;

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;

export type LicenseRecord = {
  licenseKey: string;
  email?: string | undefined;
  status: string;
  sourceProvider?: string | undefined;
  sourcePaymentId?: string | undefined;
  createdAt: string;
  dodoLicenseKeyId?: string | undefined;
  dodoLicenseKeyInstanceId?: string | undefined;
  dodoCustomerId?: string | undefined;
  dodoCustomerName?: string | undefined;
  dodoProductId?: string | undefined;
  dodoProductName?: string | undefined;
  dodoBusinessId?: string | undefined;
  dodoLicenseValidatedAt?: string | undefined;
  licenseSentAt?: string | undefined;
  licenseEmailLastError?: string | undefined;
  licenseEmailResendCount: number;
};

export type CreateLicenseResult = {
  license: LicenseRecord;
  created: boolean;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

const licenseSelectColumns = `license_key, email, status, source_provider, source_payment_id, created_at,
  license_sent_at, license_email_last_error, license_email_resend_count, dodo_license_key_id,
  dodo_license_key_instance_id, dodo_customer_id, dodo_customer_name, dodo_product_id, dodo_product_name,
  dodo_business_id, dodo_license_validated_at`;

export async function insertRawWebhook(db: D1Database, input: RawWebhookInput): Promise<void> {
  const rawPayload = redactRawWebhookPayload(input.rawPayload);

  await db
    .prepare(
      `INSERT OR IGNORE INTO raw_webhooks
      (id, provider, provider_event_id, event_type, license_key, received_at, signature_valid, processing_status, error_message, raw_payload, headers_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      input.id,
      input.provider,
      input.providerEventId ?? null,
      input.eventType ?? null,
      input.licenseKey ?? null,
      input.receivedAt,
      input.signatureValid ? 1 : 0,
      input.processingStatus,
      input.errorMessage ?? null,
      rawPayload,
      input.headersJson
    )
    .run();
}

export function redactRawWebhookPayload(rawPayload: string): string {
  try {
    const parsed = JSON.parse(rawPayload) as unknown;
    const redacted = redactRawWebhookValue(parsed, 0, undefined);
    return capRawWebhookText(JSON.stringify(redacted));
  } catch {
    return capRawWebhookText(redactRawWebhookString(rawPayload));
  }
}

function redactRawWebhookValue(value: unknown, depth: number, key: string | undefined): unknown {
  if (key && sensitiveRawWebhookKeyPattern.test(key)) {
    return REDACTED_VALUE;
  }

  if (typeof value === "string") {
    return redactRawWebhookString(value);
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (depth >= MAX_RAW_WEBHOOK_REDACTION_DEPTH) {
    return "[redacted:max-depth]";
  }

  if (Array.isArray(value)) {
    return value.map(item => redactRawWebhookValue(item, depth + 1, undefined));
  }

  const output: Record<string, unknown> = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    output[childKey] = redactRawWebhookValue(childValue, depth + 1, childKey);
  }
  return output;
}

function redactRawWebhookString(value: string): string {
  const redacted = value.replace(emailPattern, "[redacted-email]").replace(bearerPattern, "Bearer [redacted]");
  if (redacted.length <= MAX_RAW_WEBHOOK_STRING_CHARS) {
    return redacted;
  }

  return `${redacted.slice(0, RAW_WEBHOOK_PREVIEW_CHARS)}...[truncated ${redacted.length - RAW_WEBHOOK_PREVIEW_CHARS} chars]`;
}

function capRawWebhookText(value: string): string {
  if (value.length <= MAX_RAW_WEBHOOK_PAYLOAD_CHARS) {
    return value;
  }

  const suffix = `...[truncated ${value.length - MAX_RAW_WEBHOOK_PAYLOAD_CHARS} chars]`;
  return `${value.slice(0, MAX_RAW_WEBHOOK_PAYLOAD_CHARS - suffix.length)}${suffix}`;
}

export async function insertRevenueEvent(
  db: D1Database,
  event: NormalizedRevenueEvent,
  rawWebhookId: string,
  licenseKey?: string
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO revenue_events
      (source_provider, source_event_id, event_type, app_name, project_id, application_id, store, environment, product_id,
       transaction_id, original_transaction_id, amount, proceeds, currency, country_code, purchased_at, received_at, raw_webhook_id, license_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      event.sourceProvider,
      event.sourceEventId,
      event.eventType,
      event.appName,
      event.projectId ?? null,
      event.applicationId ?? null,
      event.store ?? null,
      event.environment ?? null,
      event.productId ?? null,
      event.transactionId ?? null,
      event.originalTransactionId ?? null,
      event.amount,
      event.proceeds,
      event.currency,
      event.countryCode ?? null,
      event.purchasedAt ?? null,
      event.receivedAt,
      rawWebhookId,
      licenseKey ?? null
    )
    .run();

  return result.meta.changes > 0;
}

export async function recordRateLimitHit(
  db: D1Database,
  input: {
    bucket: string;
    limit: number;
    windowSeconds: number;
    nowSeconds?: number | undefined;
  }
): Promise<RateLimitResult> {
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const row = await db
    .prepare("SELECT window_start, request_count FROM rate_limits WHERE bucket = ?")
    .bind(input.bucket)
    .first<{ window_start: number; request_count: number }>();

  if (!row || nowSeconds - Number(row.window_start) >= input.windowSeconds) {
    await db
      .prepare(
        `INSERT INTO rate_limits (bucket, window_start, request_count, updated_at)
         VALUES (?, ?, 1, ?)
         ON CONFLICT(bucket) DO UPDATE SET
           window_start = excluded.window_start,
           request_count = excluded.request_count,
           updated_at = excluded.updated_at`
      )
      .bind(input.bucket, nowSeconds, new Date(nowSeconds * 1000).toISOString())
      .run();
    return { allowed: true, retryAfterSeconds: input.windowSeconds };
  }

  const requestCount = Number(row.request_count);
  const retryAfterSeconds = Math.max(1, input.windowSeconds - (nowSeconds - Number(row.window_start)));
  if (requestCount >= input.limit) {
    return { allowed: false, retryAfterSeconds };
  }

  await db
    .prepare("UPDATE rate_limits SET request_count = request_count + 1, updated_at = ? WHERE bucket = ?")
    .bind(new Date(nowSeconds * 1000).toISOString(), input.bucket)
    .run();
  return { allowed: true, retryAfterSeconds };
}

export async function fetchEvents(
  db: D1Database,
  licenseKey: string,
  afterId: number,
  limit: number,
  includeDemo = false
): Promise<PublicRevenueEvent[]> {
  const { results } = await db
    .prepare(
      `SELECT id, source_provider, source_event_id, event_type, app_name, project_id, application_id, store, environment,
       product_id, transaction_id, original_transaction_id, amount, proceeds, currency, country_code, purchased_at, received_at
       FROM revenue_events
       WHERE license_key = ? AND id > ? AND (? = 1 OR source_provider != 'demo')
       ORDER BY id ASC
       LIMIT ?`
    )
    .bind(licenseKey, afterId, includeDemo ? 1 : 0, Math.min(Math.max(limit, 1), 100))
    .all<Record<string, unknown>>();

  return (results ?? []).map(rowToPublicEvent);
}

export async function revenueSummary(db: D1Database, licenseKey: string): Promise<RevenueSummary> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const startIso = start.toISOString();
  const events = await fetchEventsSince(db, licenseKey, startIso);
  return summarizeRevenueEvents(events);
}

export function summarizeRevenueEvents(events: PublicRevenueEvent[]): RevenueSummary {
  const appMap = new Map<string, { appName: string; revenue: number; events: number }>();
  const platformMap = new Map<string, { platform: string; revenue: number; events: number }>();
  const productMap = new Map<string, { productId: string; store?: string | undefined; revenue: number; events: number }>();
  let biggestEvent: PublicRevenueEvent | undefined;

  for (const event of events) {
    const current = appMap.get(event.appName) ?? { appName: event.appName, revenue: 0, events: 0 };
    current.revenue += event.proceeds;
    current.events += 1;
    appMap.set(event.appName, current);

    const platform = platformFromStore(event.store);
    const platformCurrent = platformMap.get(platform) ?? { platform, revenue: 0, events: 0 };
    platformCurrent.revenue += event.proceeds;
    platformCurrent.events += 1;
    platformMap.set(platform, platformCurrent);

    const productId = event.productId ?? "unknown product";
    const productKey = `${event.store ?? "UNKNOWN"}:${productId}`;
    const productCurrent = productMap.get(productKey) ?? { productId, store: event.store, revenue: 0, events: 0 };
    productCurrent.revenue += event.proceeds;
    productCurrent.events += 1;
    productMap.set(productKey, productCurrent);

    if (!biggestEvent || event.proceeds > biggestEvent.proceeds) biggestEvent = event;
  }

  return {
    todayRevenue: events.reduce((sum, event) => sum + event.proceeds, 0),
    todayEvents: events.length,
    biggestEvent,
    latestEvent: events.at(-1),
    appBreakdown: [...appMap.values()].sort((left, right) => right.revenue - left.revenue),
    platformBreakdown: [...platformMap.values()].sort((left, right) => right.revenue - left.revenue),
    productBreakdown: [...productMap.values()].sort((left, right) => right.revenue - left.revenue)
  };
}

export async function createLicense(db: D1Database, email?: string, sourcePaymentId?: string): Promise<string> {
  const result = await createOrGetLicense(db, email, sourcePaymentId);
  return result.license.licenseKey;
}

export async function createOrGetLicense(
  db: D1Database,
  email?: string,
  sourcePaymentId?: string
): Promise<CreateLicenseResult> {
  if (sourcePaymentId) {
    const existing = await db
      .prepare(
        `SELECT ${licenseSelectColumns}
         FROM licenses
         WHERE source_provider = 'dodo' AND source_payment_id = ?
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .bind(sourcePaymentId)
      .first<Record<string, unknown>>();
    if (existing) return { license: rowToLicenseRecord(existing), created: false };
  }

  const licenseKey = randomToken("cc_live");
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO licenses (license_key, email, status, source_provider, source_payment_id, created_at)
       VALUES (?, ?, 'active', 'dodo', ?, ?)`
    )
    .bind(licenseKey, email ?? null, sourcePaymentId ?? null, now)
    .run();

  return {
    created: true,
    license: {
      licenseKey,
      email,
      status: "active",
      sourceProvider: "dodo",
      sourcePaymentId,
      createdAt: now,
      licenseEmailResendCount: 0
    }
  };
}

export async function findLatestLicenseByEmail(db: D1Database, email: string): Promise<LicenseRecord | undefined> {
  const row = await db
    .prepare(
      `SELECT ${licenseSelectColumns}
       FROM licenses
       WHERE status = 'active' AND lower(email) = lower(?)
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .bind(email)
    .first<Record<string, unknown>>();

  return row ? rowToLicenseRecord(row) : undefined;
}

export async function findLicenseByKey(db: D1Database, licenseKey: string): Promise<LicenseRecord | undefined> {
  const row = await db
    .prepare(`SELECT ${licenseSelectColumns} FROM licenses WHERE license_key = ? LIMIT 1`)
    .bind(licenseKey)
    .first<Record<string, unknown>>();

  return row ? rowToLicenseRecord(row) : undefined;
}

export async function upsertDodoLicenseMirror(
  db: D1Database,
  input: {
    licenseKey: string;
    licenseKeyId: string;
    licenseKeyInstanceId: string;
    customerId: string | undefined;
    customerEmail: string | undefined;
    customerName: string | undefined;
    productId: string | undefined;
    productName: string | undefined;
    businessId: string | undefined;
  }
): Promise<LicenseRecord> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO licenses
       (license_key, email, status, source_provider, source_payment_id, created_at, dodo_license_key_id,
        dodo_license_key_instance_id, dodo_customer_id, dodo_customer_name, dodo_product_id, dodo_product_name,
        dodo_business_id, dodo_license_validated_at)
       VALUES (?, ?, 'active', 'dodo_license', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(license_key) DO UPDATE SET
         email = COALESCE(excluded.email, licenses.email),
         status = 'active',
         source_provider = 'dodo_license',
         source_payment_id = COALESCE(excluded.source_payment_id, licenses.source_payment_id),
         dodo_license_key_id = excluded.dodo_license_key_id,
         dodo_license_key_instance_id = excluded.dodo_license_key_instance_id,
         dodo_customer_id = COALESCE(excluded.dodo_customer_id, licenses.dodo_customer_id),
         dodo_customer_name = COALESCE(excluded.dodo_customer_name, licenses.dodo_customer_name),
         dodo_product_id = COALESCE(excluded.dodo_product_id, licenses.dodo_product_id),
         dodo_product_name = COALESCE(excluded.dodo_product_name, licenses.dodo_product_name),
         dodo_business_id = COALESCE(excluded.dodo_business_id, licenses.dodo_business_id),
         dodo_license_validated_at = excluded.dodo_license_validated_at`
    )
    .bind(
      input.licenseKey,
      input.customerEmail ?? null,
      input.licenseKeyId,
      now,
      input.licenseKeyId,
      input.licenseKeyInstanceId,
      input.customerId ?? null,
      input.customerName ?? null,
      input.productId ?? null,
      input.productName ?? null,
      input.businessId ?? null,
      now
    )
    .run();

  const license = await findLicenseByKey(db, input.licenseKey);
  if (!license) throw new Error("Dodo license mirror was not persisted");
  return license;
}

export async function markDodoLicenseValidated(db: D1Database, licenseKey: string): Promise<void> {
  await db
    .prepare("UPDATE licenses SET dodo_license_validated_at = ? WHERE license_key = ?")
    .bind(new Date().toISOString(), licenseKey)
    .run();
}

export async function markLicenseEmailSent(db: D1Database, licenseKey: string, incrementResendCount = false): Promise<void> {
  await db
    .prepare(
      `UPDATE licenses
       SET license_sent_at = ?, license_email_last_error = NULL,
           license_email_resend_count = COALESCE(license_email_resend_count, 0) + ?
       WHERE license_key = ?`
    )
    .bind(new Date().toISOString(), incrementResendCount ? 1 : 0, licenseKey)
    .run();
}

export async function markLicenseEmailFailed(db: D1Database, licenseKey: string, errorMessage: string): Promise<void> {
  await db
    .prepare(
      `UPDATE licenses
       SET license_email_last_error = ?
       WHERE license_key = ?`
    )
    .bind(errorMessage.slice(0, 500), licenseKey)
    .run();
}

export async function activateDevice(
  db: D1Database,
  licenseKey: string,
  deviceName?: string
): Promise<{ deviceToken: string } | undefined> {
  const license = await db
    .prepare("SELECT license_key FROM licenses WHERE license_key = ? AND status = 'active'")
    .bind(licenseKey)
    .first();
  if (!license) return undefined;

  const deviceToken = randomToken("cc_device");
  const now = new Date().toISOString();
  await db
    .prepare("INSERT INTO devices (device_token, license_key, device_name, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)")
    .bind(deviceToken, licenseKey, deviceName ?? null, now, now)
    .run();
  await db
    .prepare("UPDATE licenses SET activated_at = COALESCE(activated_at, ?), device_id = ?, device_name = ? WHERE license_key = ?")
    .bind(now, deviceToken, deviceName ?? null, licenseKey)
    .run();
  return { deviceToken };
}

const selfHostedOwnerLicenseKey = "__self_hosted_owner__";

export async function activateSelfHostedOwner(
  db: D1Database,
  deviceName?: string
): Promise<{ deviceToken: string }> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO licenses (license_key, status, source_provider, created_at)
       VALUES (?, 'active', 'self_hosted', ?)
       ON CONFLICT(license_key) DO UPDATE SET status = 'active'`
    )
    .bind(selfHostedOwnerLicenseKey, now)
    .run();

  const activation = await activateDevice(db, selfHostedOwnerLicenseKey, deviceName);
  if (!activation) throw new Error("Self-hosted owner activation failed");
  return activation;
}

export async function isValidDevice(db: D1Database, deviceToken: string): Promise<boolean> {
  const row = await db.prepare("SELECT device_token FROM devices WHERE device_token = ?").bind(deviceToken).first();
  if (!row) return false;
  await db.prepare("UPDATE devices SET last_seen_at = ? WHERE device_token = ?").bind(new Date().toISOString(), deviceToken).run();
  return true;
}

export async function licenseKeyForDevice(
  db: D1Database,
  deviceToken: string,
  now = new Date()
): Promise<string | undefined> {
  const row = await db
    .prepare("SELECT license_key, last_seen_at FROM devices WHERE device_token = ?")
    .bind(deviceToken)
    .first<{ license_key: string; last_seen_at: string }>();
  if (!row?.license_key) return undefined;

  const lastSeen = Date.parse(row.last_seen_at);
  if (!Number.isFinite(lastSeen) || now.getTime() - lastSeen >= 24 * 60 * 60 * 1000) {
    await db.prepare("UPDATE devices SET last_seen_at = ? WHERE device_token = ?").bind(now.toISOString(), deviceToken).run();
  }
  return row.license_key;
}

export async function cleanExpiredOperationalData(
  db: D1Database,
  input: { rawWebhookBefore: string; rateLimitBefore: string }
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `UPDATE raw_webhooks
         SET raw_payload = '[expired]', headers_json = '{}'
         WHERE received_at < ? AND raw_payload != '[expired]'`
      )
      .bind(input.rawWebhookBefore),
    db.prepare("DELETE FROM rate_limits WHERE updated_at < ?").bind(input.rateLimitBefore)
  ]);
}

export type ProviderConfigRecord = {
  id: string;
  licenseKey: string;
  provider: ProviderName;
  displayName?: string | undefined;
  enabled: boolean;
  encryptedConfig: string;
  keyHint?: string | undefined;
  webhookPathToken: string;
  updatedAt: string;
};

export async function upsertProviderConfig(
  db: D1Database,
  input: {
    licenseKey: string;
    provider: ProviderName;
    configId?: string | undefined;
    displayName?: string | undefined;
    enabled: boolean;
    encryptedConfig: string;
    keyHint?: string | undefined;
  }
): Promise<ProviderConfigRecord> {
  const now = new Date().toISOString();
  const existing = await findExistingProviderConfigForUpsert(db, input.licenseKey, input.provider, input.configId, input.displayName);
  const webhookPathToken = existing?.webhook_path_token ?? randomToken(input.provider === "superwall" ? "cc_sw" : "cc_rc");

  await db
    .prepare(
      `INSERT INTO provider_configs
       (license_key, provider, display_name, enabled, encrypted_config, key_hint, webhook_path_token, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider, webhook_path_token) DO UPDATE SET
         display_name = excluded.display_name,
         enabled = excluded.enabled,
         encrypted_config = excluded.encrypted_config,
         key_hint = excluded.key_hint,
         updated_at = excluded.updated_at`
    )
    .bind(
      input.licenseKey,
      input.provider,
      input.displayName ?? null,
      input.enabled ? 1 : 0,
      input.encryptedConfig,
      input.keyHint ?? null,
      webhookPathToken,
      now,
      now
    )
    .run();

  return {
    id: webhookPathToken,
    licenseKey: input.licenseKey,
    provider: input.provider,
    displayName: input.displayName,
    enabled: input.enabled,
    encryptedConfig: input.encryptedConfig,
    keyHint: input.keyHint,
    webhookPathToken,
    updatedAt: now
  };
}

export async function listProviderConfigs(db: D1Database, licenseKey: string): Promise<ProviderConfigRecord[]> {
  const { results } = await db
    .prepare(
      `SELECT license_key, provider, display_name, enabled, encrypted_config, key_hint, webhook_path_token, updated_at
       FROM provider_configs
       WHERE license_key = ?
       ORDER BY provider, display_name COLLATE NOCASE, created_at`
    )
    .bind(licenseKey)
    .all<Record<string, unknown>>();

  return (results ?? []).map(rowToProviderConfigRecord);
}

export async function findProviderConfigByToken(
  db: D1Database,
  provider: ProviderName,
  webhookPathToken: string
): Promise<ProviderConfigRecord | undefined> {
  const row = await db
    .prepare(
      `SELECT license_key, provider, display_name, enabled, encrypted_config, key_hint, webhook_path_token, updated_at
       FROM provider_configs
       WHERE provider = ? AND webhook_path_token = ? AND enabled = 1`
    )
    .bind(provider, webhookPathToken)
    .first<Record<string, unknown>>();

  return row ? rowToProviderConfigRecord(row) : undefined;
}

export async function listAllProviderConfigs(db: D1Database): Promise<ProviderConfigRecord[]> {
  const { results } = await db
    .prepare(
      `SELECT license_key, provider, display_name, enabled, encrypted_config, key_hint, webhook_path_token, updated_at
       FROM provider_configs
       ORDER BY provider, webhook_path_token`
    )
    .all<Record<string, unknown>>();

  return (results ?? []).map(rowToProviderConfigRecord);
}

export async function migrateProviderConfigEncryption(
  db: D1Database,
  input: {
    rotationId: string;
    updates: Array<{
      provider: ProviderName;
      webhookPathToken: string;
      previousEncryptedConfig: string;
      migratedEncryptedConfig: string;
    }>;
    now?: string | undefined;
  }
): Promise<{ migrated: number; conflicts: number }> {
  if (input.updates.length === 0) return { migrated: 0, conflicts: 0 };
  const now = input.now ?? new Date().toISOString();
  const statements = input.updates.flatMap(update => [
    db
      .prepare(
        `INSERT OR IGNORE INTO provider_config_encryption_backups
         (rotation_id, provider, webhook_path_token, previous_encrypted_config, migrated_encrypted_config, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        input.rotationId,
        update.provider,
        update.webhookPathToken,
        update.previousEncryptedConfig,
        update.migratedEncryptedConfig,
        now
      ),
    db
      .prepare(
        `UPDATE provider_configs
         SET encrypted_config = ?, updated_at = ?
         WHERE provider = ? AND webhook_path_token = ? AND encrypted_config = ?`
      )
      .bind(
        update.migratedEncryptedConfig,
        now,
        update.provider,
        update.webhookPathToken,
        update.previousEncryptedConfig
      )
  ]);
  const results = await db.batch(statements);
  const updateResults = results.filter((_, index) => index % 2 === 1);
  const migrated = updateResults.reduce((sum, result) => sum + Number(result.meta.changes ?? 0), 0);
  return { migrated, conflicts: input.updates.length - migrated };
}

export async function rollbackProviderConfigEncryption(
  db: D1Database,
  rotationId: string,
  now = new Date().toISOString()
): Promise<{ total: number; restored: number; conflicts: number }> {
  const { results } = await db
    .prepare(
      `SELECT provider, webhook_path_token, previous_encrypted_config, migrated_encrypted_config
       FROM provider_config_encryption_backups
       WHERE rotation_id = ?
       ORDER BY provider, webhook_path_token`
    )
    .bind(rotationId)
    .all<Record<string, unknown>>();
  const backups = results ?? [];
  if (backups.length === 0) return { total: 0, restored: 0, conflicts: 0 };

  const statements = backups.map(row =>
    db
      .prepare(
        `UPDATE provider_configs
         SET encrypted_config = ?, updated_at = ?
         WHERE provider = ? AND webhook_path_token = ? AND encrypted_config = ?`
      )
      .bind(
        stringField(row.previous_encrypted_config),
        now,
        stringField(row.provider),
        stringField(row.webhook_path_token),
        stringField(row.migrated_encrypted_config)
      )
  );
  const updateResults = await db.batch(statements);
  const restored = updateResults.reduce((sum, result) => sum + Number(result.meta.changes ?? 0), 0);
  return { total: backups.length, restored, conflicts: backups.length - restored };
}

async function fetchEventsSince(db: D1Database, licenseKey: string, sinceIso: string): Promise<PublicRevenueEvent[]> {
  const { results } = await db
    .prepare(
      `SELECT id, source_provider, source_event_id, event_type, app_name, project_id, application_id, store, environment,
       product_id, transaction_id, original_transaction_id, amount, proceeds, currency, country_code, purchased_at, received_at
       FROM revenue_events
       WHERE license_key = ? AND received_at >= ? AND source_provider != 'demo'
       ORDER BY id ASC`
    )
    .bind(licenseKey, sinceIso)
    .all<Record<string, unknown>>();

  return (results ?? []).map(rowToPublicEvent);
}

function rowToProviderConfigRecord(row: Record<string, unknown>): ProviderConfigRecord {
  const webhookPathToken = stringField(row.webhook_path_token);
  return {
    id: webhookPathToken,
    licenseKey: stringField(row.license_key),
    provider: stringField(row.provider) as ProviderName,
    displayName: optionalStringField(row.display_name),
    enabled: Number(row.enabled ?? 0) === 1,
    encryptedConfig: stringField(row.encrypted_config),
    keyHint: optionalStringField(row.key_hint),
    webhookPathToken,
    updatedAt: stringField(row.updated_at)
  };
}

async function findExistingProviderConfigForUpsert(
  db: D1Database,
  licenseKey: string,
  provider: ProviderName,
  configId?: string,
  displayName?: string
): Promise<{ webhook_path_token: string } | null> {
  if (configId) {
    return db
      .prepare("SELECT webhook_path_token FROM provider_configs WHERE license_key = ? AND provider = ? AND webhook_path_token = ?")
      .bind(licenseKey, provider, configId)
      .first<{ webhook_path_token: string }>();
  }

  if (displayName) {
    const existingNamed = await db
      .prepare(
        `SELECT webhook_path_token
         FROM provider_configs
         WHERE license_key = ? AND provider = ? AND lower(display_name) = lower(?)
         ORDER BY updated_at DESC
         LIMIT 1`
      )
      .bind(licenseKey, provider, displayName)
      .first<{ webhook_path_token: string }>();
    if (existingNamed) return existingNamed;
  }

  return null;
}

function rowToLicenseRecord(row: Record<string, unknown>): LicenseRecord {
  return {
    licenseKey: stringField(row.license_key),
    email: optionalStringField(row.email),
    status: stringField(row.status),
    sourceProvider: optionalStringField(row.source_provider),
    sourcePaymentId: optionalStringField(row.source_payment_id),
    createdAt: stringField(row.created_at),
    dodoLicenseKeyId: optionalStringField(row.dodo_license_key_id),
    dodoLicenseKeyInstanceId: optionalStringField(row.dodo_license_key_instance_id),
    dodoCustomerId: optionalStringField(row.dodo_customer_id),
    dodoCustomerName: optionalStringField(row.dodo_customer_name),
    dodoProductId: optionalStringField(row.dodo_product_id),
    dodoProductName: optionalStringField(row.dodo_product_name),
    dodoBusinessId: optionalStringField(row.dodo_business_id),
    dodoLicenseValidatedAt: optionalStringField(row.dodo_license_validated_at),
    licenseSentAt: optionalStringField(row.license_sent_at),
    licenseEmailLastError: optionalStringField(row.license_email_last_error),
    licenseEmailResendCount: Number(row.license_email_resend_count ?? 0)
  };
}

function rowToPublicEvent(row: Record<string, unknown>): PublicRevenueEvent {
  const transactionId = stringField(row.transaction_id);
  return {
    id: Number(row.id),
    sourceProvider: stringField(row.source_provider) as PublicRevenueEvent["sourceProvider"],
    sourceEventId: stringField(row.source_event_id),
    eventType: stringField(row.event_type) as PublicRevenueEvent["eventType"],
    appName: stringField(row.app_name),
    projectId: optionalStringField(row.project_id),
    applicationId: optionalStringField(row.application_id),
    store: optionalStringField(row.store),
    environment: optionalStringField(row.environment),
    productId: optionalStringField(row.product_id),
    transactionId,
    transactionIdSuffix: transactionId ? transactionId.slice(-6) : undefined,
    originalTransactionId: optionalStringField(row.original_transaction_id),
    amount: Number(row.amount ?? 0),
    proceeds: Number(row.proceeds ?? 0),
    currency: stringField(row.currency),
    countryCode: optionalStringField(row.country_code),
    purchasedAt: optionalStringField(row.purchased_at),
    receivedAt: stringField(row.received_at)
  };
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function optionalStringField(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function platformFromStore(store?: string): string {
  switch (store) {
    case "APP_STORE":
      return "iOS";
    case "PLAY_STORE":
      return "Android";
    case "STRIPE":
      return "Web";
    case undefined:
      return "Unknown";
    default:
      return store;
  }
}
