ALTER TABLE licenses ADD COLUMN license_sent_at TEXT;
ALTER TABLE licenses ADD COLUMN license_email_last_error TEXT;
ALTER TABLE licenses ADD COLUMN license_email_resend_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses(email);
CREATE INDEX IF NOT EXISTS idx_licenses_source_payment ON licenses(source_provider, source_payment_id);
