import type { NormalizedRevenueEvent, RevenueCatWebhookPayload, RevenueEventType, SuperwallWebhookPayload } from "./types";

const superwallRevenueEvents = new Set([
  "initial_purchase",
  "renewal",
  "non_renewing_purchase",
  "cancellation",
  "uncancellation",
  "expiration",
  "billing_issue",
  "product_change",
  "subscription_paused"
]);

export function normalizeSuperwallEvent(
  payload: SuperwallWebhookPayload,
  receivedAt = new Date().toISOString()
): NormalizedRevenueEvent {
  const data = payload.data ?? {};
  const eventName = stringValue(data.name) ?? payload.type ?? "unknown";
  const sourceEventId =
    stringValue(data.id) ??
    [payload.projectId, payload.applicationId, eventName, stringValue(data.transactionId), payload.timestamp]
      .filter(Boolean)
      .join(":");

  if (!sourceEventId) {
    throw new Error("Superwall webhook is missing a stable event id");
  }

  const purchasedAtMs = numberValue(data.purchasedAt) ?? numberValue(data.ts) ?? payload.timestamp;
  const bundleId = stringValue(data.bundleId);

  return {
    sourceProvider: "superwall",
    sourceEventId,
    eventType: toRevenueEventType(eventName),
    appName: appNameFromBundle(bundleId),
    projectId: optionalString(payload.projectId),
    applicationId: optionalString(payload.applicationId),
    store: stringValue(data.store),
    environment: stringValue(data.environment),
    productId: stringValue(data.productId),
    transactionId: stringValue(data.transactionId),
    originalTransactionId: stringValue(data.originalTransactionId),
    amount: numberValue(data.price) ?? 0,
    proceeds: numberValue(data.proceeds) ?? numberValue(data.price) ?? 0,
    currency: stringValue(data.currencyCode) ?? "USD",
    countryCode: stringValue(data.countryCode),
    purchasedAt: purchasedAtMs ? new Date(purchasedAtMs).toISOString() : undefined,
    receivedAt
  };
}

export function normalizeRevenueCatEvent(
  payload: RevenueCatWebhookPayload,
  receivedAt = new Date().toISOString()
): NormalizedRevenueEvent {
  const event = payload.event ?? {};
  const sourceEventId = stringValue(event.id);
  if (!sourceEventId) throw new Error("RevenueCat webhook is missing an event id");

  const rawType = stringValue(event.type) ?? "unknown";
  const eventType = revenueCatEventType(rawType, stringValue(event.cancel_reason));
  const purchaseAmount = numberValue(event.price_in_purchased_currency) ?? numberValue(event.price) ?? 0;
  const takehomePercentage = numberValue(event.takehome_percentage);
  const isPurchase = eventType === "initial_purchase" || eventType === "renewal" || eventType === "non_renewing_purchase";
  const isRefund = eventType === "refund";
  const amount = isPurchase ? purchaseAmount : isRefund ? -Math.abs(purchaseAmount) : 0;
  const proceedsAmount = takehomePercentage === undefined ? purchaseAmount : purchaseAmount * takehomePercentage;
  const proceeds = isPurchase ? proceedsAmount : isRefund ? -Math.abs(proceedsAmount) : 0;
  const purchasedAtMs = numberValue(event.purchased_at_ms);

  return {
    sourceProvider: "revenuecat",
    sourceEventId,
    eventType,
    appName: appNameFromBundle(stringValue(event.app_id)),
    applicationId: stringValue(event.app_id),
    store: stringValue(event.store),
    environment: stringValue(event.environment),
    productId: stringValue(event.product_id),
    transactionId: stringValue(event.transaction_id),
    originalTransactionId: stringValue(event.original_transaction_id),
    amount,
    proceeds,
    currency: stringValue(event.currency) ?? "USD",
    countryCode: stringValue(event.country_code),
    purchasedAt: purchasedAtMs === undefined ? undefined : new Date(purchasedAtMs).toISOString(),
    receivedAt
  };
}

export function normalizeDemoEvent(input: Partial<NormalizedRevenueEvent> = {}): NormalizedRevenueEvent {
  const now = new Date().toISOString();
  return {
    sourceProvider: "demo",
    sourceEventId: input.sourceEventId ?? crypto.randomUUID(),
    eventType: input.eventType ?? "renewal",
    appName: input.appName ?? "Nimbus Notes",
    store: input.store ?? "APP_STORE",
    environment: input.environment ?? "DEMO",
    productId: input.productId ?? "nimbusnotes.pro.yearly",
    transactionId: input.transactionId ?? `demo_${Date.now()}`,
    originalTransactionId: input.originalTransactionId ?? `demo_original_${Date.now()}`,
    amount: input.amount ?? 19.99,
    proceeds: input.proceeds ?? input.amount ?? 19.99,
    currency: input.currency ?? "USD",
    countryCode: input.countryCode ?? "US",
    purchasedAt: input.purchasedAt ?? now,
    receivedAt: input.receivedAt ?? now
  };
}

export function isRevenuePositive(event: NormalizedRevenueEvent): boolean {
  return event.proceeds > 0 || event.amount > 0;
}

function toRevenueEventType(value: string): RevenueEventType {
  if (superwallRevenueEvents.has(value)) {
    return value as RevenueEventType;
  }
  if (value.includes("refund")) {
    return "refund";
  }
  return "unknown";
}

function revenueCatEventType(value: string, cancellationReason?: string): RevenueEventType {
  if (value === "CANCELLATION" && cancellationReason === "CUSTOMER_SUPPORT") return "refund";

  const normalized = value.toLowerCase();
  if (superwallRevenueEvents.has(normalized)) return normalized as RevenueEventType;
  return "unknown";
}

function appNameFromBundle(bundleId?: string): string {
  if (!bundleId) return "Unknown App";
  const last = bundleId.split(".").filter(Boolean).at(-1);
  if (!last) return bundleId;
  return last
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value);
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}
