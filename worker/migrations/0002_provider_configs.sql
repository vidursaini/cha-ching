ALTER TABLE raw_webhooks ADD COLUMN license_key TEXT;
ALTER TABLE revenue_events ADD COLUMN license_key TEXT;

DROP INDEX IF EXISTS idx_raw_webhooks_provider_event;
DROP INDEX IF EXISTS idx_revenue_events_source;

CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_webhooks_provider_event_license
ON raw_webhooks(provider, provider_event_id, license_key)
WHERE provider_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_revenue_events_source_license
ON revenue_events(source_provider, source_event_id, license_key);

CREATE INDEX IF NOT EXISTS idx_revenue_events_license_id
ON revenue_events(license_key, id);

CREATE INDEX IF NOT EXISTS idx_revenue_events_license_received
ON revenue_events(license_key, received_at);

CREATE TABLE IF NOT EXISTS provider_configs (
  license_key TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('superwall', 'revenuecat')),
  enabled INTEGER NOT NULL DEFAULT 1,
  encrypted_config TEXT NOT NULL,
  key_hint TEXT,
  webhook_path_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (license_key, provider),
  FOREIGN KEY(license_key) REFERENCES licenses(license_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_configs_webhook_token
ON provider_configs(provider, webhook_path_token);
