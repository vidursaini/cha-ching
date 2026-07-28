ALTER TABLE licenses ADD COLUMN dodo_license_key_id TEXT;
ALTER TABLE licenses ADD COLUMN dodo_license_key_instance_id TEXT;
ALTER TABLE licenses ADD COLUMN dodo_customer_id TEXT;
ALTER TABLE licenses ADD COLUMN dodo_customer_name TEXT;
ALTER TABLE licenses ADD COLUMN dodo_product_id TEXT;
ALTER TABLE licenses ADD COLUMN dodo_product_name TEXT;
ALTER TABLE licenses ADD COLUMN dodo_business_id TEXT;
ALTER TABLE licenses ADD COLUMN dodo_license_validated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_licenses_dodo_license_key_id
ON licenses(dodo_license_key_id);

CREATE INDEX IF NOT EXISTS idx_licenses_dodo_customer
ON licenses(dodo_customer_id);
