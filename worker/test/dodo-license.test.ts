import { describe, expect, it } from "vitest";
import { activateDodoLicense, DodoLicenseError, validateDodoLicense } from "../src/dodoLicense";

describe("Dodo license client", () => {
  it("activates a Dodo license key against the selected environment", async () => {
    const requests: Request[] = [];
    const response = {
      id: "lki_123",
      license_key_id: "lic_123",
      business_id: "bus_123",
      customer: { customer_id: "cus_123", email: "buyer@example.com", name: "Buyer" },
      product: { product_id: "pdt_123", name: "Cha-Ching" }
    };

    const activation = await activateDodoLicense(
      { licenseKey: "DODO-KEY", name: "Test Mac", environment: "live" },
      async (input, init) => {
        requests.push(new Request(input, init));
        return jsonResponse(response);
      }
    );

    expect(requests[0]?.url).toBe("https://live.dodopayments.com/licenses/activate");
    expect(await requests[0]?.json()).toEqual({ license_key: "DODO-KEY", name: "Test Mac" });
    expect(activation).toMatchObject({
      id: "lki_123",
      licenseKeyId: "lic_123",
      businessId: "bus_123",
      customer: { customerId: "cus_123", email: "buyer@example.com", name: "Buyer" },
      product: { productId: "pdt_123", name: "Cha-Ching" }
    });
  });

  it("validates an existing Dodo license instance without activating again", async () => {
    const requests: Request[] = [];

    const validation = await validateDodoLicense(
      { licenseKey: "DODO-KEY", licenseKeyInstanceId: "lki_123", environment: "test" },
      async (input, init) => {
        requests.push(new Request(input, init));
        return jsonResponse({ valid: true });
      }
    );

    expect(requests[0]?.url).toBe("https://test.dodopayments.com/licenses/validate");
    expect(await requests[0]?.json()).toEqual({ license_key: "DODO-KEY", license_key_instance_id: "lki_123" });
    expect(validation.valid).toBe(true);
  });

  it("surfaces Dodo 4xx responses as license errors", async () => {
    await expect(
      activateDodoLicense({ licenseKey: "bad-key", name: "Mac" }, async () => jsonResponse({ error: "invalid" }, 404))
    ).rejects.toMatchObject({
      name: "DodoLicenseError",
      status: 404
    } satisfies Partial<DodoLicenseError>);
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}
