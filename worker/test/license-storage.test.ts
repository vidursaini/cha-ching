import { describe, expect, it } from "vitest";
import { createOrGetLicense, findLicenseByKey, markLicenseEmailSent, upsertDodoLicenseMirror } from "../src/storage";

describe("license storage", () => {
  it("reuses an existing Dodo license for the same payment id", async () => {
    const db = new FakeD1();

    const first = await createOrGetLicense(db as unknown as D1Database, "buyer@example.com", "pay_123");
    const second = await createOrGetLicense(db as unknown as D1Database, "buyer@example.com", "pay_123");

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.license.licenseKey).toBe(first.license.licenseKey);
    expect(db.licenses).toHaveLength(1);
  });

  it("tracks license email sends and resend count", async () => {
    const db = new FakeD1();
    const { license } = await createOrGetLicense(db as unknown as D1Database, "buyer@example.com", "pay_123");

    await markLicenseEmailSent(db as unknown as D1Database, license.licenseKey);
    expect(db.licenses[0]?.license_sent_at).toBeTruthy();
    expect(db.licenses[0]?.license_email_resend_count).toBe(0);

    await markLicenseEmailSent(db as unknown as D1Database, license.licenseKey, true);
    expect(db.licenses[0]?.license_email_resend_count).toBe(1);
  });

  it("mirrors Dodo license ids against the customer-facing license key", async () => {
    const db = new FakeD1();

    const license = await upsertDodoLicenseMirror(db as unknown as D1Database, {
      licenseKey: "DODO-KEY-123",
      licenseKeyId: "lic_123",
      licenseKeyInstanceId: "lki_123",
      customerId: "cus_123",
      customerEmail: "buyer@example.com",
      customerName: "Buyer",
      productId: "pdt_123",
      productName: "Cha-Ching",
      businessId: "bus_123"
    });

    expect(license).toMatchObject({
      licenseKey: "DODO-KEY-123",
      sourceProvider: "dodo_license",
      dodoLicenseKeyId: "lic_123",
      dodoLicenseKeyInstanceId: "lki_123",
      dodoCustomerId: "cus_123",
      dodoProductId: "pdt_123"
    });
    expect(await findLicenseByKey(db as unknown as D1Database, "DODO-KEY-123")).toMatchObject({
      licenseKey: "DODO-KEY-123",
      email: "buyer@example.com"
    });
  });
});

type LicenseRow = {
  license_key: string;
  email: string | null;
  status: string;
  source_provider: string | null;
  source_payment_id: string | null;
  created_at: string;
  license_sent_at: string | null;
  license_email_last_error: string | null;
  license_email_resend_count: number;
  dodo_license_key_id: string | null;
  dodo_license_key_instance_id: string | null;
  dodo_customer_id: string | null;
  dodo_customer_name: string | null;
  dodo_product_id: string | null;
  dodo_product_name: string | null;
  dodo_business_id: string | null;
  dodo_license_validated_at: string | null;
};

class FakeD1 {
  licenses: LicenseRow[] = [];

  prepare(sql: string): FakeD1Statement {
    return new FakeD1Statement(this, sql);
  }
}

class FakeD1Statement {
  private params: unknown[] = [];

  constructor(
    private readonly db: FakeD1,
    private readonly sql: string
  ) {}

  bind(...params: unknown[]): FakeD1Statement {
    this.params = params;
    return this;
  }

  async first<T>(): Promise<T | null> {
    if (this.sql.includes("WHERE source_provider = 'dodo' AND source_payment_id = ?")) {
      const sourcePaymentId = String(this.params[0]);
      return (this.db.licenses.find((row) => row.source_provider === "dodo" && row.source_payment_id === sourcePaymentId) ??
        null) as T | null;
    }

    if (this.sql.includes("FROM licenses WHERE license_key = ?")) {
      const licenseKey = String(this.params[0]);
      return (this.db.licenses.find((row) => row.license_key === licenseKey) ?? null) as T | null;
    }

    return null;
  }

  async run(): Promise<{ meta: { changes: number } }> {
    if (this.sql.includes("source_provider = 'dodo_license'")) {
      const [
        licenseKey,
        email,
        sourcePaymentId,
        createdAt,
        licenseKeyId,
        licenseKeyInstanceId,
        customerId,
        customerName,
        productId,
        productName,
        businessId,
        validatedAt
      ] = this.params;
      const existing = this.db.licenses.find((license) => license.license_key === licenseKey);
      if (existing) {
        existing.email = typeof email === "string" ? email : existing.email;
        existing.status = "active";
        existing.source_provider = "dodo_license";
        existing.source_payment_id = typeof sourcePaymentId === "string" ? sourcePaymentId : existing.source_payment_id;
        existing.dodo_license_key_id = String(licenseKeyId);
        existing.dodo_license_key_instance_id = String(licenseKeyInstanceId);
        existing.dodo_customer_id = typeof customerId === "string" ? customerId : existing.dodo_customer_id;
        existing.dodo_customer_name = typeof customerName === "string" ? customerName : existing.dodo_customer_name;
        existing.dodo_product_id = typeof productId === "string" ? productId : existing.dodo_product_id;
        existing.dodo_product_name = typeof productName === "string" ? productName : existing.dodo_product_name;
        existing.dodo_business_id = typeof businessId === "string" ? businessId : existing.dodo_business_id;
        existing.dodo_license_validated_at = String(validatedAt);
        return { meta: { changes: 1 } };
      }

      this.db.licenses.push({
        license_key: String(licenseKey),
        email: typeof email === "string" ? email : null,
        status: "active",
        source_provider: "dodo_license",
        source_payment_id: typeof sourcePaymentId === "string" ? sourcePaymentId : null,
        created_at: String(createdAt),
        license_sent_at: null,
        license_email_last_error: null,
        license_email_resend_count: 0,
        dodo_license_key_id: String(licenseKeyId),
        dodo_license_key_instance_id: String(licenseKeyInstanceId),
        dodo_customer_id: typeof customerId === "string" ? customerId : null,
        dodo_customer_name: typeof customerName === "string" ? customerName : null,
        dodo_product_id: typeof productId === "string" ? productId : null,
        dodo_product_name: typeof productName === "string" ? productName : null,
        dodo_business_id: typeof businessId === "string" ? businessId : null,
        dodo_license_validated_at: String(validatedAt)
      });
      return { meta: { changes: 1 } };
    }

    if (this.sql.includes("INSERT INTO licenses")) {
      this.db.licenses.push({
        license_key: String(this.params[0]),
        email: typeof this.params[1] === "string" ? this.params[1] : null,
        status: "active",
        source_provider: "dodo",
        source_payment_id: typeof this.params[2] === "string" ? this.params[2] : null,
        created_at: String(this.params[3]),
        license_sent_at: null,
        license_email_last_error: null,
        license_email_resend_count: 0,
        dodo_license_key_id: null,
        dodo_license_key_instance_id: null,
        dodo_customer_id: null,
        dodo_customer_name: null,
        dodo_product_id: null,
        dodo_product_name: null,
        dodo_business_id: null,
        dodo_license_validated_at: null
      });
      return { meta: { changes: 1 } };
    }

    if (this.sql.includes("SET license_sent_at = ?")) {
      const licenseKey = String(this.params[2]);
      const row = this.db.licenses.find((license) => license.license_key === licenseKey);
      if (!row) return { meta: { changes: 0 } };
      row.license_sent_at = String(this.params[0]);
      row.license_email_last_error = null;
      row.license_email_resend_count += Number(this.params[1] ?? 0);
      return { meta: { changes: 1 } };
    }

    return { meta: { changes: 0 } };
  }
}
