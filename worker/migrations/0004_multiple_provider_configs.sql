DROP INDEX IF EXISTS idx_provider_configs_webhook_token;

CREATE TABLE IF NOT EXISTS provider_configs_new (
  license_key TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('superwall', 'revenuecat')),
  display_name TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  encrypted_config TEXT NOT NULL,
  key_hint TEXT,
  webhook_path_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(license_key) REFERENCES licenses(license_key)
);

INSERT INTO provider_configs_new
  (license_key, provider, display_name, enabled, encrypted_config, key_hint, webhook_path_token, created_at, updated_at)
SELECT
  license_key,
  provider,
  NULL,
  enabled,
  encrypted_config,
  key_hint,
  webhook_path_token,
  created_at,
  updated_at
FROM provider_configs;

DROP TABLE provider_configs;
ALTER TABLE provider_configs_new RENAME TO provider_configs;

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_configs_webhook_token
ON provider_configs(provider, webhook_path_token);

CREATE INDEX IF NOT EXISTS idx_provider_configs_license_provider
ON provider_configs(license_key, provider);
