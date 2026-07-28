export type DodoEnvironment = "test" | "live";

export type DodoLicenseActivation = {
  id: string;
  licenseKeyId: string;
  businessId: string | undefined;
  customer: {
    customerId: string | undefined;
    email: string | undefined;
    name: string | undefined;
  };
  product: {
    productId: string | undefined;
    name: string | undefined;
  };
};

export type DodoLicenseValidation = {
  valid: boolean;
};

export class DodoLicenseError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: unknown
  ) {
    super(message);
    this.name = "DodoLicenseError";
  }
}

type DodoFetch = typeof fetch;

export async function activateDodoLicense(
  input: {
    licenseKey: string;
    name: string;
    environment?: DodoEnvironment | undefined;
  },
  dodoFetch: DodoFetch = fetch
): Promise<DodoLicenseActivation> {
  const payload = await postDodoLicenseEndpoint(
    "/licenses/activate",
    {
      license_key: input.licenseKey,
      name: input.name
    },
    input.environment,
    dodoFetch
  );
  return dodoActivationFromPayload(payload);
}

export async function validateDodoLicense(
  input: {
    licenseKey: string;
    licenseKeyInstanceId?: string | undefined;
    environment?: DodoEnvironment | undefined;
  },
  dodoFetch: DodoFetch = fetch
): Promise<DodoLicenseValidation> {
  const payload = await postDodoLicenseEndpoint(
    "/licenses/validate",
    {
      license_key: input.licenseKey,
      license_key_instance_id: input.licenseKeyInstanceId ?? null
    },
    input.environment,
    dodoFetch
  );
  return { valid: Boolean(recordValue(payload).valid) };
}

function dodoBaseUrl(environment?: DodoEnvironment): string {
  return environment === "live" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";
}

async function postDodoLicenseEndpoint(
  pathname: string,
  body: Record<string, unknown>,
  environment: DodoEnvironment | undefined,
  dodoFetch: DodoFetch
): Promise<unknown> {
  const response = await dodoFetch(`${dodoBaseUrl(environment)}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new DodoLicenseError("Dodo license request failed", response.status, payload);
  }
  return payload;
}

function dodoActivationFromPayload(payload: unknown): DodoLicenseActivation {
  const record = recordValue(payload);
  const id = stringValue(record.id);
  const licenseKeyId = stringValue(record.license_key_id);
  if (!id || !licenseKeyId) {
    throw new DodoLicenseError("Dodo license activation response was missing required ids", 502, payload);
  }

  const customer = recordValue(record.customer);
  const product = recordValue(record.product);
  return {
    id,
    licenseKeyId,
    businessId: stringValue(record.business_id),
    customer: {
      customerId: stringValue(customer.customer_id),
      email: stringValue(customer.email),
      name: stringValue(customer.name)
    },
    product: {
      productId: stringValue(product.product_id),
      name: stringValue(product.name)
    }
  };
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
