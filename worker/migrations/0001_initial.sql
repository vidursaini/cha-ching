CREATE TABLE IF NOT EXISTS raw_webhooks (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT,
  event_type TEXT,
  received_at TEXT NOT NULL,
  signature_valid INTEGER NOT NULL DEFAULT 0,
  processing_status TEXT NOT NULL,
  error_message TEXT,
  raw_payload TEXT NOT NULL,
  headers_json TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_webhooks_provider_event
ON raw_webhooks(provider, provider_event_id)
WHERE provider_event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS revenue_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_provider TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  app_name TEXT NOT NULL,
  project_id TEXT,
  application_id TEXT,
  store TEXT,
  environment TEXT,
  product_id TEXT,
  transaction_id TEXT,
  original_transaction_id TEXT,
  amount REAL NOT NULL DEFAULT 0,
  proceeds REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  country_code TEXT,
  purchased_at TEXT,
  received_at TEXT NOT NULL,
  raw_webhook_id TEXT NOT NULL,
  FOREIGN KEY(raw_webhook_id) REFERENCES raw_webhooks(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_revenue_events_source
ON revenue_events(source_provider, source_event_id);

CREATE INDEX IF NOT EXISTS idx_revenue_events_received
ON revenue_events(received_at);

CREATE TABLE IF NOT EXISTS licenses (
  license_key TEXT PRIMARY KEY,
  email TEXT,
  status TEXT NOT NULL,
  source_provider TEXT,
  source_payment_id TEXT,
  created_at TEXT NOT NULL,
  activated_at TEXT,
  device_id TEXT,
  device_name TEXT
);

CREATE TABLE IF NOT EXISTS devices (
  device_token TEXT PRIMARY KEY,
  license_key TEXT NOT NULL,
  device_name TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  FOREIGN KEY(license_key) REFERENCES licenses(license_key)
);
