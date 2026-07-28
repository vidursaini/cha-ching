CREATE TABLE IF NOT EXISTS provider_config_encryption_backups (
  rotation_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('superwall', 'revenuecat')),
  webhook_path_token TEXT NOT NULL,
  previous_encrypted_config TEXT NOT NULL,
  migrated_encrypted_config TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (rotation_id, provider, webhook_path_token)
);

CREATE INDEX IF NOT EXISTS idx_provider_config_encryption_backups_rotation
ON provider_config_encryption_backups(rotation_id);
