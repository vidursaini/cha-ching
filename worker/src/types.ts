export type RevenueEventType =
  | "initial_purchase"
  | "renewal"
  | "non_renewing_purchase"
  | "refund"
  | "cancellation"
  | "uncancellation"
  | "expiration"
  | "billing_issue"
  | "product_change"
  | "subscription_paused"
  | "unknown";

export type ProviderName = "superwall" | "revenuecat";

export type NormalizedRevenueEvent = {
  sourceProvider: "superwall" | "revenuecat" | "dodo" | "demo";
  sourceEventId: string;
  eventType: RevenueEventType;
  appName: string;
  projectId?: string | undefined;
  applicationId?: string | undefined;
  store?: string | undefined;
  environment?: string | undefined;
  productId?: string | undefined;
  transactionId?: string | undefined;
  originalTransactionId?: string | undefined;
  amount: number;
  proceeds: number;
  currency: string;
  countryCode?: string | undefined;
  purchasedAt?: string | undefined;
  receivedAt: string;
};

export type PublicRevenueEvent = NormalizedRevenueEvent & {
  id: number;
  transactionIdSuffix?: string | undefined;
};

export type RevenueSummary = {
  todayRevenue: number;
  todayEvents: number;
  biggestEvent?: PublicRevenueEvent | undefined;
  latestEvent?: PublicRevenueEvent | undefined;
  appBreakdown: Array<{ appName: string; revenue: number; events: number }>;
  platformBreakdown: Array<{ platform: string; revenue: number; events: number }>;
  productBreakdown: Array<{ productId: string; store?: string | undefined; revenue: number; events: number }>;
};

export type SuperwallWebhookPayload = {
  object?: string;
  type?: string;
  projectId?: number | string;
  applicationId?: number | string;
  timestamp?: number;
  data?: Record<string, unknown>;
};

export type RevenueCatWebhookPayload = {
  api_version?: string;
  event?: Record<string, unknown>;
};

export type ProviderConfigSummary = {
  id: string;
  provider: ProviderName;
  displayName?: string | undefined;
  enabled: boolean;
  keyHint?: string | undefined;
  webhookUrl: string;
  updatedAt: string;
};
