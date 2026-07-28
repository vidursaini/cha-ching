import {
  encryptJSON,
  timingSafeSecretEqual,
  verifyDodoStandardWebhookSignatures,
  verifySuperwallSvixSignatures
} from "./crypto";
import { deviceTokenFromRequest } from "./auth";
import { normalizeDemoEvent, normalizeRevenueCatEvent, normalizeSuperwallEvent } from "./normalizers";
import {
  activateDevice,
  activateSelfHostedOwner,
  cleanExpiredOperationalData,
  findLicenseByKey,
  findLatestLicenseByEmail,
  findProviderConfigByToken,
  fetchEvents,
  insertRawWebhook,
  insertRevenueEvent,
  licenseKeyForDevice,
  listAllProviderConfigs,
  listProviderConfigs,
  markDodoLicenseValidated,
  type LicenseRecord,
  markLicenseEmailFailed,
  markLicenseEmailSent,
  type ProviderConfigRecord,
  recordRateLimitHit,
  migrateProviderConfigEncryption,
  rollbackProviderConfigEncryption,
  upsertProviderConfig,
  upsertDodoLicenseMirror,
  revenueSummary
} from "./storage";
import {
  decryptProviderConfig,
  planProviderEncryptionMigration,
  providerEncryptionKeyring
} from "./providerEncryption";
import { buildLicenseEmail, sendResendEmail } from "./email";
import { activateDodoLicense, DodoLicenseError, validateDodoLicense } from "./dodoLicense";
import type { ProviderConfigSummary, ProviderName, RevenueCatWebhookPayload, SuperwallWebhookPayload } from "./types";

type WorkerEnv = Pick<Cloudflare.Env, "DB"> & {
  ENVIRONMENT?: string;
  ADMIN_TOKEN?: string;
  SUPERWALL_WEBHOOK_SECRET?: string;
  PROVIDER_CONFIG_ENCRYPTION_KEY?: string;
  PROVIDER_CONFIG_ENCRYPTION_KEY_NEXT?: string;
  PROVIDER_CONFIG_MIGRATION_TOKEN?: string;
  DEFAULT_LICENSE_KEY?: string;
  DODO_PAYMENTS_API_KEY?: string;
  DODO_PAYMENTS_WEBHOOK_KEY?: string;
  DODO_PAYMENTS_WEBHOOK_KEY_PREVIOUS?: string;
  DODO_PRODUCT_ID?: string;
  DODO_ENVIRONMENT?: "test" | "live";
  CHECKOUT_SUCCESS_URL?: string;
  CHECKOUT_CANCEL_URL?: string;
  RESEND_API_KEY?: string;
  LICENSE_EMAIL_FROM?: string;
  SUPPORT_EMAIL?: string;
  MAC_DOWNLOAD_URL?: string;
  LEGACY_SUPERWALL_WEBHOOK_ENABLED?: string;
  ALLOWED_CORS_ORIGINS?: string;
  DEPLOYMENT_MODE?: "hosted" | "self_hosted";
  SELF_HOST_SETUP_TOKEN?: string;
  RAW_WEBHOOK_RETENTION_DAYS?: string;
};

const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;
const MAX_API_JSON_BODY_BYTES = 32 * 1024;
const CLEANUP_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
let nextCleanupCheckAt = 0;

const rateLimitPolicies = {
  checkout: { name: "checkout", limit: 20, windowSeconds: 60 },
  licenseActivation: { name: "license-activation", limit: 10, windowSeconds: 60 },
  selfHostActivation: { name: "self-host-activation", limit: 5, windowSeconds: 300 },
  licenseResend: { name: "license-resend", limit: 3, windowSeconds: 300 },
  providerConfigWrite: { name: "provider-config-write", limit: 30, windowSeconds: 60 },
  testEvent: { name: "test-event", limit: 20, windowSeconds: 60 }
} as const;

type RateLimitPolicy = (typeof rateLimitPolicies)[keyof typeof rateLimitPolicies];

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    scheduleOperationalCleanup(env, ctx);

    try {
      const response = request.method === "OPTIONS" ? corsPreflight(request, env) : await routeRequest(request, env, url);
      return withResponseHeaders(response, request, env);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return withResponseHeaders(json({ error: error.message }, 413), request, env);
      }
      console.error(JSON.stringify({ level: "error", message: error instanceof Error ? error.message : String(error) }));
      return withResponseHeaders(json({ error: "Internal server error" }, 500), request, env);
    }
  },

  async scheduled(_controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(cleanupOperationalData(env));
  }
} satisfies ExportedHandler<WorkerEnv>;

async function routeRequest(request: Request, env: WorkerEnv, url: URL): Promise<Response> {
  const tokenizedSuperwallWebhook = url.pathname.match(/^\/api\/webhooks\/superwall\/([^/]+)$/);
  const tokenizedRevenueCatWebhook = url.pathname.match(/^\/api\/webhooks\/revenuecat\/([^/]+)$/);

  if (request.method === "GET" && url.pathname === "/health") return json({ ok: true });
  if (request.method === "GET" && url.pathname === "/api/meta") return handleMetadata(env);
  if (request.method === "POST" && tokenizedSuperwallWebhook?.[1]) {
    return handleSuperwallWebhook(request, env, tokenizedSuperwallWebhook[1]);
  }
  if (request.method === "POST" && tokenizedRevenueCatWebhook?.[1]) {
    return handleRevenueCatWebhook(request, env, tokenizedRevenueCatWebhook[1]);
  }
  if (request.method === "POST" && url.pathname === "/api/webhooks/superwall") return handleSuperwallWebhook(request, env);
  if (request.method === "POST" && url.pathname === "/api/webhooks/dodo" && isHosted(env)) return handleDodoWebhook(request, env);
  if (request.method === "POST" && url.pathname === "/api/licenses/activate" && isHosted(env)) return handleLicenseActivation(request, env);
  if (request.method === "POST" && url.pathname === "/api/self-host/activate" && !isHosted(env)) return handleSelfHostedActivation(request, env);
  if (request.method === "POST" && url.pathname === "/api/licenses/resend" && isHosted(env)) return handleLicenseResend(request, env);
  if (url.pathname === "/api/provider-configs") return handleProviderConfigs(request, env, url);
  if (request.method === "GET" && url.pathname === "/api/events") return handleEvents(request, env, url);
  if (request.method === "GET" && url.pathname === "/api/revenue-card") return handleRevenueCard(request, env, url);
  if (request.method === "GET" && url.pathname === "/api/sync") return handleSync(request, env, url);
  if (request.method === "POST" && url.pathname === "/api/dev/test-event") return handleTestEvent(request, env);
  if (request.method === "POST" && url.pathname === "/api/admin/provider-configs/encryption") {
    return handleProviderEncryptionMigration(request, env);
  }
  if (request.method === "POST" && url.pathname === "/api/checkout" && isHosted(env)) return handleCheckout(request, env);
  return json({ error: "Not found" }, 404);
}

function handleMetadata(env: WorkerEnv): Response {
  const deploymentMode = isHosted(env) ? "hosted" : "self_hosted";
  return json({
    apiVersion: 1,
    deploymentMode,
    capabilities: {
      dodoLicensing: deploymentMode === "hosted",
      selfHostActivation: deploymentMode === "self_hosted",
      providers: ["superwall", "revenuecat"],
      combinedSync: true
    }
  });
}

type SuperwallProviderConfig = {
  webhookSecret?: string | undefined;
  webhookSecretPrevious?: string | undefined;
  displayName?: string | undefined;
};

type RevenueCatProviderConfig = {
  authorizationHeader?: string | undefined;
  displayName?: string | undefined;
};

async function handleSuperwallWebhook(request: Request, env: WorkerEnv, webhookPathToken?: string): Promise<Response> {
  if (!webhookPathToken && env.LEGACY_SUPERWALL_WEBHOOK_ENABLED !== "1") {
    return json({ error: "Legacy Superwall webhook endpoint is disabled. Use a per-app webhook URL." }, 410);
  }

  if (webhookPathToken && !providerConfigKeyring(env)) {
    return json({ error: "Provider config encryption key is not configured" }, 503);
  }

  const resolvedConfig = webhookPathToken
    ? await resolveProviderConfig<SuperwallProviderConfig>(env, "superwall", webhookPathToken)
    : undefined;
  if (webhookPathToken && !resolvedConfig) {
    return json({ error: "Unknown Superwall webhook endpoint" }, 404);
  }

  const webhookSecrets = resolvedConfig
    ? [resolvedConfig.config.webhookSecret, resolvedConfig.config.webhookSecretPrevious]
    : [env.SUPERWALL_WEBHOOK_SECRET];
  const licenseKey = resolvedConfig?.record.licenseKey ?? env.DEFAULT_LICENSE_KEY ?? "__global__";

  if (!webhookSecrets.some(Boolean)) {
    return json({ error: "Superwall webhook secret is not configured" }, 503);
  }

  const rawPayload = await readLimitedText(request, MAX_WEBHOOK_BODY_BYTES);
  const receivedAt = new Date().toISOString();
  const payload = parseJSONRecord(rawPayload);
  const payloadData = recordValue(payload.data);
  const providerEventId = stringValue(payloadData.id) ?? request.headers.get("svix-id") ?? undefined;
  const dedupeScope = resolvedConfig?.record.id ?? "global";
  const rawId = `superwall_${dedupeScope}_${providerEventId ?? crypto.randomUUID()}`;
  const signatureValid = await verifySuperwallSvixSignatures(rawPayload, request.headers, webhookSecrets);

  await insertRawWebhook(env.DB, {
    id: rawId,
    provider: "superwall",
    providerEventId,
    eventType: stringValue(payload.type),
    licenseKey,
    receivedAt,
    signatureValid,
    processingStatus: signatureValid ? "received" : "failed",
    errorMessage: signatureValid ? undefined : "Invalid Superwall signature",
    rawPayload,
    headersJson: headersJson(request.headers)
  });

  if (!signatureValid) {
    return json({ error: "Invalid Superwall signature" }, 400);
  }

  try {
    const event = normalizeSuperwallEvent(payload as SuperwallWebhookPayload, receivedAt);
    const scopedEvent = { ...event, sourceEventId: scopedProviderEventId(resolvedConfig?.record.id, event.sourceEventId) };
    const namedEvent = resolvedConfig?.config.displayName ? { ...scopedEvent, appName: resolvedConfig.config.displayName } : scopedEvent;
    const inserted = await insertRevenueEvent(env.DB, namedEvent, rawId, licenseKey);
    return json({ received: true, inserted });
  } catch (error) {
    await insertRawWebhook(env.DB, {
      id: `superwall_failed_${crypto.randomUUID()}`,
      provider: "superwall",
      providerEventId,
      eventType: stringValue(payload.type),
      licenseKey,
      receivedAt,
      signatureValid,
      processingStatus: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
      rawPayload,
      headersJson: headersJson(request.headers)
    });
    return json({ received: true, inserted: false, warning: "Stored raw webhook but normalization failed" });
  }
}

async function handleRevenueCatWebhook(request: Request, env: WorkerEnv, webhookPathToken: string): Promise<Response> {
  if (!providerConfigKeyring(env)) {
    return json({ error: "Provider config encryption key is not configured" }, 503);
  }

  const resolvedConfig = await resolveProviderConfig<RevenueCatProviderConfig>(env, "revenuecat", webhookPathToken);
  if (!resolvedConfig) return json({ error: "Unknown RevenueCat webhook endpoint" }, 404);

  const rawPayload = await readLimitedText(request, MAX_WEBHOOK_BODY_BYTES);
  const receivedAt = new Date().toISOString();
  const payload = parseJSONRecord(rawPayload);
  const providerEventId = nestedString(payload, ["event", "id"]) ?? stringValue(payload.id) ?? crypto.randomUUID();
  const authorization = request.headers.get("authorization") ?? "";
  const expected = resolvedConfig.config.authorizationHeader;
  if (!expected) return json({ error: "RevenueCat authorization header is not configured" }, 503);
  const signatureValid = await timingSafeSecretEqual(authorization, expected);

  const rawId = `revenuecat_${resolvedConfig.record.id}_${providerEventId}`;
  await insertRawWebhook(env.DB, {
    id: rawId,
    provider: "revenuecat",
    providerEventId,
    eventType: nestedString(payload, ["event", "type"]) ?? stringValue(payload.type),
    licenseKey: resolvedConfig.record.licenseKey,
    receivedAt,
    signatureValid,
    processingStatus: signatureValid ? "received" : "failed",
    errorMessage: signatureValid ? undefined : "Invalid RevenueCat authorization header",
    rawPayload,
    headersJson: headersJson(request.headers)
  });

  if (!signatureValid) return json({ error: "Invalid RevenueCat authorization header" }, 401);

  try {
    const event = normalizeRevenueCatEvent(payload as RevenueCatWebhookPayload, receivedAt);
    const scopedEvent = { ...event, sourceEventId: scopedProviderEventId(resolvedConfig.record.id, event.sourceEventId) };
    const namedEvent = resolvedConfig.config.displayName ? { ...scopedEvent, appName: resolvedConfig.config.displayName } : scopedEvent;
    const inserted = await insertRevenueEvent(env.DB, namedEvent, rawId, resolvedConfig.record.licenseKey);
    return json({ received: true, inserted });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      provider: "revenuecat",
      message: error instanceof Error ? error.message : String(error)
    }));
    return json({ received: true, inserted: false, warning: "Stored raw webhook but normalization failed" });
  }
}

async function handleDodoWebhook(request: Request, env: WorkerEnv): Promise<Response> {
  if (!env.DODO_PAYMENTS_WEBHOOK_KEY) {
    return json({ error: "Dodo webhook key is not configured" }, 503);
  }

  const rawPayload = await readLimitedText(request, MAX_WEBHOOK_BODY_BYTES);
  const receivedAt = new Date().toISOString();
  const signatureValid = await verifyDodoStandardWebhookSignatures(rawPayload, request.headers, [
    env.DODO_PAYMENTS_WEBHOOK_KEY,
    env.DODO_PAYMENTS_WEBHOOK_KEY_PREVIOUS
  ]);

  if (!signatureValid) {
    return json({ error: "Invalid Dodo signature" }, 401);
  }

  const payload = parseJSONRecord(rawPayload);
  const providerEventId = request.headers.get("webhook-id") ?? stringValue(payload.id) ?? crypto.randomUUID();
  await insertRawWebhook(env.DB, {
    id: `dodo_${providerEventId}`,
    provider: "dodo",
    providerEventId,
    eventType: stringValue(payload.type),
    receivedAt,
    signatureValid,
    processingStatus: "received",
    rawPayload,
    headersJson: headersJson(request.headers)
  });

  return json({ received: true, licenseCreated: false });
}

async function handleLicenseResend(request: Request, env: WorkerEnv): Promise<Response> {
  const rateLimitResponse = await enforceRateLimit(env, request, rateLimitPolicies.licenseResend);
  if (rateLimitResponse) return rateLimitResponse;

  const body = await readJSONRecord(request, MAX_API_JSON_BODY_BYTES);
  const email = stringValue(body.email);
  if (!email) return json({ error: "email is required" }, 400);

  const license = await findLatestLicenseByEmail(env.DB, email);
  if (!license) {
    return json({ sent: true, message: "If a license exists for this email, a fresh copy has been sent." });
  }

  if (!license.email) {
    return json({ error: "This license does not have an email address on file" }, 409);
  }

  try {
    await deliverLicenseEmail(env, license, true);
    return json({ sent: true });
  } catch {
    return json({ error: "Email delivery failed" }, 502);
  }
}

async function handleLicenseActivation(request: Request, env: WorkerEnv): Promise<Response> {
  const rateLimitResponse = await enforceRateLimit(env, request, rateLimitPolicies.licenseActivation);
  if (rateLimitResponse) return rateLimitResponse;

  const body = await readJSONRecord(request, MAX_API_JSON_BODY_BYTES);
  const licenseKey = stringValue(body.licenseKey);
  const deviceName = stringValue(body.deviceName);
  if (!licenseKey) return json({ error: "licenseKey is required" }, 400);

  const existingLicense = await findLicenseByKey(env.DB, licenseKey);
  if (existingLicense && existingLicense.sourceProvider !== "dodo_license") {
    const legacyActivation = await activateDevice(env.DB, licenseKey, deviceName);
    if (!legacyActivation) return json({ error: "Invalid license" }, 403);
    return json(legacyActivation);
  }

  const dodoResult = await verifyOrActivateDodoLicense(env, licenseKey, deviceName, existingLicense);
  if (!dodoResult.ok) return json({ error: dodoResult.error }, dodoResult.status);

  const activation = await activateDevice(env.DB, licenseKey, deviceName);
  if (!activation) return json({ error: "Invalid license" }, 403);
  return json(activation);
}

async function handleSelfHostedActivation(request: Request, env: WorkerEnv): Promise<Response> {
  const rateLimitResponse = await enforceRateLimit(env, request, rateLimitPolicies.selfHostActivation);
  if (rateLimitResponse) return rateLimitResponse;

  if (!env.SELF_HOST_SETUP_TOKEN || env.SELF_HOST_SETUP_TOKEN.length < 24) {
    return json({ error: "Self-host setup token is not configured securely" }, 503);
  }

  const body = await readJSONRecord(request, MAX_API_JSON_BODY_BYTES);
  const setupToken = stringValue(body.setupToken);
  const deviceName = stringValue(body.deviceName);
  if (!setupToken) return json({ error: "setupToken is required" }, 400);

  if (!(await timingSafeSecretEqual(setupToken, env.SELF_HOST_SETUP_TOKEN))) {
    return json({ error: "Invalid setup token" }, 403);
  }

  return json(await activateSelfHostedOwner(env.DB, deviceName));
}

async function verifyOrActivateDodoLicense(
  env: WorkerEnv,
  licenseKey: string,
  deviceName: string | undefined,
  existingLicense: LicenseRecord | undefined
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  try {
    if (existingLicense?.dodoLicenseKeyInstanceId) {
      const validation = await validateDodoLicense({
        licenseKey,
        licenseKeyInstanceId: existingLicense.dodoLicenseKeyInstanceId,
        environment: env.DODO_ENVIRONMENT
      });
      if (!validation.valid) return { ok: false, status: 403, error: "Invalid license" };
      await markDodoLicenseValidated(env.DB, licenseKey);
      return { ok: true };
    }

    const activation = await activateDodoLicense({
      licenseKey,
      name: deviceName?.trim() || "Mac",
      environment: env.DODO_ENVIRONMENT
    });
    await upsertDodoLicenseMirror(env.DB, {
      licenseKey,
      licenseKeyId: activation.licenseKeyId,
      licenseKeyInstanceId: activation.id,
      customerId: activation.customer.customerId,
      customerEmail: activation.customer.email,
      customerName: activation.customer.name,
      productId: activation.product.productId,
      productName: activation.product.name,
      businessId: activation.businessId
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof DodoLicenseError && error.status >= 400 && error.status < 500) {
      return { ok: false, status: 403, error: "Invalid license" };
    }
    console.error(JSON.stringify({
      level: "error",
      message: "Dodo license verification failed",
      error: error instanceof Error ? error.message : String(error)
    }));
    return { ok: false, status: 502, error: "License verification is temporarily unavailable" };
  }
}

async function handleProviderConfigs(request: Request, env: WorkerEnv, url: URL): Promise<Response> {
  const deviceToken = deviceTokenFromRequest(request);
  if (!deviceToken) return json({ error: "Unauthorized" }, 401);

  const licenseKey = await licenseKeyForDevice(env.DB, deviceToken);
  if (!licenseKey) return json({ error: "Unauthorized" }, 401);

  if (request.method === "GET") {
    const configs = await listProviderConfigs(env.DB, licenseKey);
    return json({ configs: configs.map((config) => publicProviderConfig(url, config)) });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const encryptionKeyring = providerConfigKeyring(env);
  if (!encryptionKeyring) {
    return json({ error: "Provider config encryption key is not configured" }, 503);
  }

  const rateLimitResponse = await enforceRateLimit(env, request, rateLimitPolicies.providerConfigWrite);
  if (rateLimitResponse) return rateLimitResponse;

  const body = await readJSONRecord(request, MAX_API_JSON_BODY_BYTES);
  const provider = stringValue(body.provider) as ProviderName | undefined;
  if (provider !== "superwall" && provider !== "revenuecat") {
    return json({ error: "provider must be superwall or revenuecat" }, 400);
  }

  const requestedEnabled = body.enabled !== false;
  const displayName = stringValue(body.displayName);
  let providerConfig: SuperwallProviderConfig | RevenueCatProviderConfig;
  try {
    providerConfig =
      provider === "superwall" ? superwallConfigFromBody(body, displayName) : revenueCatConfigFromBody(body, displayName);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }

  const encryptedConfig = await encryptJSON(providerConfig, encryptionKeyring.primary);
  const hasRequiredCredential =
    provider === "superwall"
      ? Boolean((providerConfig as SuperwallProviderConfig).webhookSecret)
      : Boolean((providerConfig as RevenueCatProviderConfig).authorizationHeader);
  if (requestedEnabled && !hasRequiredCredential) {
    return json({
      error: provider === "superwall" ? "Superwall webhookSecret is required" : "RevenueCat authorizationHeader is required"
    }, 400);
  }

  const keyHint = provider === "superwall" ? secretHint(stringValue(body.webhookSecret)) : secretHint(stringValue(body.authorizationHeader));

  const config = await upsertProviderConfig(env.DB, {
    licenseKey,
    provider,
    configId: stringValue(body.configId) ?? stringValue(body.id),
    displayName,
    enabled: requestedEnabled && hasRequiredCredential,
    encryptedConfig,
    keyHint
  });

  return json({ config: publicProviderConfig(url, config) });
}

async function handleEvents(request: Request, env: WorkerEnv, url: URL): Promise<Response> {
  const deviceToken = deviceTokenFromRequest(request);
  if (!deviceToken) return json({ error: "Unauthorized" }, 401);
  const licenseKey = await licenseKeyForDevice(env.DB, deviceToken);
  if (!licenseKey) return json({ error: "Unauthorized" }, 401);
  const after = Number(url.searchParams.get("after") ?? 0);
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const includeDemo = url.searchParams.get("includeDemo") === "1";
  return json({
    events: await fetchEvents(
      env.DB,
      licenseKey,
      Number.isFinite(after) ? after : 0,
      Number.isFinite(limit) ? limit : 50,
      includeDemo
    )
  });
}

async function handleRevenueCard(request: Request, env: WorkerEnv, url: URL): Promise<Response> {
  const deviceToken = deviceTokenFromRequest(request);
  if (!deviceToken) return json({ error: "Unauthorized" }, 401);
  const licenseKey = await licenseKeyForDevice(env.DB, deviceToken);
  if (!licenseKey) return json({ error: "Unauthorized" }, 401);
  return json(await revenueSummary(env.DB, licenseKey));
}

async function handleSync(request: Request, env: WorkerEnv, url: URL): Promise<Response> {
  const deviceToken = deviceTokenFromRequest(request);
  if (!deviceToken) return json({ error: "Unauthorized" }, 401);
  const licenseKey = await licenseKeyForDevice(env.DB, deviceToken);
  if (!licenseKey) return json({ error: "Unauthorized" }, 401);

  const after = Number(url.searchParams.get("after") ?? 0);
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const includeDemo = url.searchParams.get("includeDemo") === "1";
  const [events, summary] = await Promise.all([
    fetchEvents(
      env.DB,
      licenseKey,
      Number.isFinite(after) ? after : 0,
      Number.isFinite(limit) ? limit : 50,
      includeDemo
    ),
    revenueSummary(env.DB, licenseKey)
  ]);

  return json({
    events,
    summary,
    serverTime: new Date().toISOString(),
    pollAfterSeconds: events.length > 0 ? 10 : 60
  });
}

async function handleTestEvent(request: Request, env: WorkerEnv): Promise<Response> {
  const rateLimitResponse = await enforceRateLimit(env, request, rateLimitPolicies.testEvent);
  if (rateLimitResponse) return rateLimitResponse;

  const token = request.headers.get("x-admin-token") ?? request.headers.get("authorization")?.replace(/^Bearer\\s+/i, "");
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return json({ error: "Unauthorized" }, 401);
  const body = await readJSONRecord(request, MAX_API_JSON_BODY_BYTES);
  const event = normalizeDemoEvent(body);
  const rawId = `demo_${event.sourceEventId}`;
  await insertRawWebhook(env.DB, {
    id: rawId,
    provider: "demo",
    providerEventId: event.sourceEventId,
    eventType: event.eventType,
    licenseKey: typeof body.licenseKey === "string" ? body.licenseKey : "__demo__",
    receivedAt: event.receivedAt,
    signatureValid: true,
    processingStatus: "processed",
    rawPayload: JSON.stringify(body),
    headersJson: "{}"
  });
  const inserted = await insertRevenueEvent(
    env.DB,
    event,
    rawId,
    typeof body.licenseKey === "string" ? body.licenseKey : "__demo__"
  );
  return json({ inserted, event });
}

async function handleCheckout(request: Request, env: WorkerEnv): Promise<Response> {
  const rateLimitResponse = await enforceRateLimit(env, request, rateLimitPolicies.checkout);
  if (rateLimitResponse) return rateLimitResponse;

  if (!env.DODO_PAYMENTS_API_KEY || !env.DODO_PRODUCT_ID) {
    return json({ error: "Dodo checkout is not configured" }, 503);
  }

  const host = env.DODO_ENVIRONMENT === "live" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";
  const response = await fetch(`${host}/checkouts`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.DODO_PAYMENTS_API_KEY}`
    },
    body: JSON.stringify({
      product_cart: [{ product_id: env.DODO_PRODUCT_ID, quantity: 1 }],
      return_url: env.CHECKOUT_SUCCESS_URL,
      cancel_url: env.CHECKOUT_CANCEL_URL,
      metadata: { product: "Cha-Ching", license: "lifetime" }
    })
  });

  const payload: Record<string, unknown> = await response.json<Record<string, unknown>>().catch(() => ({}));
  if (!response.ok) return json({ error: "Dodo checkout failed", details: payload }, response.status);
  return json({
    checkout: payload,
    checkoutUrl: payload.checkout_url ?? payload.session_url ?? payload.payment_link ?? payload.url ?? null
  });
}

async function resolveProviderConfig<T>(
  env: WorkerEnv,
  provider: ProviderName,
  webhookPathToken: string
): Promise<{ record: ProviderConfigRecord; config: T } | undefined> {
  const keyring = providerConfigKeyring(env);
  if (!keyring) return undefined;

  const record = await findProviderConfigByToken(env.DB, provider, webhookPathToken);
  if (!record) return undefined;

  return {
    record,
    config: (await decryptProviderConfig<T>(record.encryptedConfig, keyring)).value
  };
}

async function handleProviderEncryptionMigration(request: Request, env: WorkerEnv): Promise<Response> {
  if (!isHosted(env)) return json({ error: "Not found" }, 404);
  if (!env.PROVIDER_CONFIG_MIGRATION_TOKEN) return json({ error: "Migration is not enabled" }, 503);

  const authorization = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!authorization || !(await timingSafeSecretEqual(authorization, env.PROVIDER_CONFIG_MIGRATION_TOKEN))) {
    return json({ error: "Unauthorized" }, 401);
  }

  const body = await readJSONRecord(request, MAX_API_JSON_BODY_BYTES);
  const action = stringValue(body.action) ?? "verify";
  const rotationId = stringValue(body.rotationId);
  if (action !== "verify" && (!rotationId || !/^[A-Za-z0-9_-]{8,64}$/.test(rotationId))) {
    return json({ error: "A valid rotationId is required" }, 400);
  }

  if (action === "rollback") {
    const result = await rollbackProviderConfigEncryption(env.DB, rotationId!);
    return json({ action, rotationId, ...result });
  }

  const keyring = providerConfigKeyring(env);
  if (!keyring) return json({ error: "Provider encryption keyring is not configured" }, 503);
  const records = await listAllProviderConfigs(env.DB);

  let plan;
  try {
    plan = await planProviderEncryptionMigration(records, keyring);
  } catch {
    return json({ error: "Provider configuration verification failed", total: records.length }, 409);
  }

  if (action === "verify" || body.dryRun === true) {
    return json({
      action: "verify",
      total: plan.total,
      primary: plan.alreadyPrimary,
      previous: plan.updates.length
    });
  }
  if (action !== "migrate") return json({ error: "Unsupported migration action" }, 400);

  const migration = await migrateProviderConfigEncryption(env.DB, {
    rotationId: rotationId!,
    updates: plan.updates
  });
  if (migration.conflicts > 0) {
    const rollback = await rollbackProviderConfigEncryption(env.DB, rotationId!);
    return json(
      {
        error: "Provider configuration changed during migration; migrated records were rolled back",
        total: plan.total,
        conflicts: migration.conflicts,
        restored: rollback.restored
      },
      409
    );
  }

  return json({
    action,
    rotationId,
    total: plan.total,
    alreadyPrimary: plan.alreadyPrimary,
    migrated: migration.migrated,
    conflicts: 0
  });
}

function providerConfigKeyring(env: WorkerEnv) {
  return providerEncryptionKeyring({
    current: env.PROVIDER_CONFIG_ENCRYPTION_KEY,
    next: env.PROVIDER_CONFIG_ENCRYPTION_KEY_NEXT
  });
}

function superwallConfigFromBody(body: Record<string, unknown>, displayName?: string): SuperwallProviderConfig {
  return {
    webhookSecret: stringValue(body.webhookSecret),
    webhookSecretPrevious: stringValue(body.webhookSecretPrevious),
    displayName
  };
}

function revenueCatConfigFromBody(body: Record<string, unknown>, displayName?: string): RevenueCatProviderConfig {
  return {
    authorizationHeader: stringValue(body.authorizationHeader),
    displayName
  };
}

async function deliverLicenseEmail(env: WorkerEnv, license: LicenseRecord, incrementResendCount: boolean): Promise<void> {
  if (!license.email) return;

  const settings = licenseEmailSettings(env);
  if (!env.RESEND_API_KEY) {
    await markLicenseEmailFailed(env.DB, license.licenseKey, "RESEND_API_KEY is not configured");
    throw new Error("RESEND_API_KEY is not configured");
  }

  const email = buildLicenseEmail({
    licenseKey: license.licenseKey,
    downloadUrl: settings.downloadUrl,
    supportEmail: settings.supportEmail
  });

  try {
    await sendResendEmail({
      apiKey: env.RESEND_API_KEY,
      from: settings.from,
      to: license.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      idempotencyKey: incrementResendCount ? undefined : `license-${license.licenseKey}`
    });
    await markLicenseEmailSent(env.DB, license.licenseKey, incrementResendCount);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markLicenseEmailFailed(env.DB, license.licenseKey, message);
    throw error;
  }
}

function licenseEmailSettings(env: WorkerEnv): { from: string; supportEmail: string; downloadUrl: string } {
  const supportEmail = requiredSetting(env.SUPPORT_EMAIL, "SUPPORT_EMAIL");
  return {
    supportEmail,
    from: requiredSetting(env.LICENSE_EMAIL_FROM, "LICENSE_EMAIL_FROM"),
    downloadUrl: requiredSetting(env.MAC_DOWNLOAD_URL, "MAC_DOWNLOAD_URL")
  };
}

function requiredSetting(value: string | undefined, name: string): string {
  const configured = value?.trim();
  if (!configured) throw new Error(`${name} is not configured`);
  return configured;
}

function publicProviderConfig(url: URL, config: ProviderConfigRecord): ProviderConfigSummary {
  return {
    id: config.id,
    provider: config.provider,
    displayName: config.displayName,
    enabled: config.enabled,
    keyHint: config.keyHint,
    webhookUrl: `${url.origin}/api/webhooks/${config.provider}/${config.webhookPathToken}`,
    updatedAt: config.updatedAt
  };
}

export function scopedProviderEventId(configId: string | undefined, providerEventId: string): string {
  return configId ? `${configId}:${providerEventId}` : providerEventId;
}

function parseJSONRecord(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function nestedString(value: Record<string, unknown>, path: string[]): string | undefined {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return stringValue(current);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function secretHint(value?: string): string | undefined {
  if (!value) return undefined;
  return value.length <= 4 ? "configured" : `...${value.slice(-4)}`;
}

function headersJson(headers: Headers): string {
  const safeHeaders: Record<string, string> = {};
  headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!lowerKey.includes("signature") && lowerKey !== "authorization") {
      safeHeaders[key] = value;
    }
  });
  return JSON.stringify(safeHeaders);
}

async function enforceRateLimit(env: WorkerEnv, request: Request, policy: RateLimitPolicy): Promise<Response | undefined> {
  const result = await recordRateLimitHit(env.DB, {
    bucket: `${policy.name}:${clientAddress(request)}`,
    limit: policy.limit,
    windowSeconds: policy.windowSeconds
  });

  if (result.allowed) return undefined;
  return json(
    { error: "Too many requests" },
    429,
    {
      "retry-after": String(result.retryAfterSeconds)
    }
  );
}

function clientAddress(request: Request): string {
  const cfAddress = request.headers.get("cf-connecting-ip");
  if (cfAddress) return cfAddress;

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || "unknown";
}

function isHosted(env: WorkerEnv): boolean {
  return env.DEPLOYMENT_MODE !== "self_hosted";
}

async function cleanupOperationalData(env: WorkerEnv): Promise<void> {
  const { retentionDays, rawWebhookBefore, rateLimitBefore } = operationalCleanupCutoffs(
    env.RAW_WEBHOOK_RETENTION_DAYS
  );
  await cleanExpiredOperationalData(env.DB, {
    rawWebhookBefore,
    rateLimitBefore
  });
  console.log(JSON.stringify({ level: "info", job: "operational-data-cleanup", retentionDays }));
}

function scheduleOperationalCleanup(env: WorkerEnv, ctx: ExecutionContext): void {
  if (typeof ctx.waitUntil !== "function") return;

  const now = Date.now();
  if (now < nextCleanupCheckAt) return;
  nextCleanupCheckAt = now + CLEANUP_CHECK_INTERVAL_MS;
  ctx.waitUntil(
    cleanupOperationalData(env).catch(error => {
      console.error(JSON.stringify({
        level: "error",
        job: "operational-data-cleanup",
        message: error instanceof Error ? error.message : String(error)
      }));
    })
  );
}

export function operationalCleanupCutoffs(
  rawWebhookRetentionDays: string | undefined,
  now = new Date()
): { retentionDays: number; rawWebhookBefore: string; rateLimitBefore: string } {
  const configuredRetention = Number(rawWebhookRetentionDays ?? 30);
  const retentionDays = Number.isFinite(configuredRetention)
    ? Math.min(Math.max(Math.floor(configuredRetention), 1), 365)
    : 30;
  const nowMilliseconds = now.getTime();
  return {
    retentionDays,
    rawWebhookBefore: new Date(nowMilliseconds - retentionDays * 24 * 60 * 60 * 1000).toISOString(),
    rateLimitBefore: new Date(nowMilliseconds - 2 * 24 * 60 * 60 * 1000).toISOString()
  };
}

async function readJSONRecord(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const rawBody = await readLimitedText(request, maxBytes);
  try {
    const parsed: unknown = JSON.parse(rawBody);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function readLimitedText(request: Request, maxBytes: number): Promise<string> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new PayloadTooLargeError(maxBytes);
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maxBytes) {
    throw new PayloadTooLargeError(maxBytes);
  }
  return body;
}

class PayloadTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Request body exceeds ${maxBytes} bytes`);
    this.name = "PayloadTooLargeError";
  }
}

function corsPreflight(request: Request, env: WorkerEnv): Response {
  if (!allowedCorsOrigin(request.headers.get("origin"), env.ALLOWED_CORS_ORIGINS)) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request, env),
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "authorization,content-type,x-admin-token",
      "access-control-max-age": "600"
    }
  });
}

function withResponseHeaders(response: Response, request: Request, env: WorkerEnv): Response {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  headers.set("cache-control", "no-store");

  for (const [key, value] of Object.entries(corsHeaders(request, env))) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function corsHeaders(request: Request, env: WorkerEnv): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!allowedCorsOrigin(origin, env.ALLOWED_CORS_ORIGINS)) return {};

  return {
    "access-control-allow-origin": origin!,
    vary: "Origin"
  };
}

export function allowedCorsOrigin(origin: string | null, configuredOrigins?: string): boolean {
  if (!origin) return false;

  const allowedOrigins = (configuredOrigins ?? "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

  return allowedOrigins.includes(origin);
}

function json(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(headers ?? {})
    }
  });
}
