CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_raw_webhooks_received_at
ON raw_webhooks(received_at);

CREATE INDEX IF NOT EXISTS idx_rate_limits_updated_at
ON rate_limits(updated_at);
