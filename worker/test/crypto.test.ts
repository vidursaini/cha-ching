import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  decryptJSON,
  encryptJSON,
  timingSafeSecretEqual,
  timingSafeStringEqual,
  verifyDodoStandardWebhookSignature,
  verifyDodoStandardWebhookSignatures,
  verifySuperwallSvixSignatures
} from "../src/crypto";

describe("provider config crypto", () => {
  it("round-trips encrypted provider config without deterministic ciphertext", async () => {
    const secret = "test-provider-config-secret";
    const config = {
      webhookSecret: "whsec_superwall_test",
      displayName: "Nimbus Notes"
    };

    const first = await encryptJSON(config, secret);
    const second = await encryptJSON(config, secret);

    expect(first).not.toEqual(second);
    await expect(decryptJSON(first, secret)).resolves.toEqual(config);
    await expect(decryptJSON(second, secret)).resolves.toEqual(config);
  });

  it("rejects decrypting with the wrong secret", async () => {
    const encrypted = await encryptJSON({ authorizationHeader: "Bearer rc_test" }, "right-secret");

    await expect(decryptJSON(encrypted, "wrong-secret")).rejects.toThrow();
  });

  it("compares webhook authorization values exactly", () => {
    expect(timingSafeStringEqual("Bearer token", "Bearer token")).toBe(true);
    expect(timingSafeStringEqual("Bearer token", "Bearer other")).toBe(false);
  });

  it("compares setup secrets after hashing them to a fixed length", async () => {
    await expect(timingSafeSecretEqual("short", "a much longer value")).resolves.toBe(false);
    await expect(timingSafeSecretEqual("same-secret", "same-secret")).resolves.toBe(true);
  });

  it("rejects stale Dodo webhook signatures to prevent replay", async () => {
    const payload = JSON.stringify({ type: "payment.succeeded" });
    const secret = "dodo-webhook-secret";
    const id = "msg_test";
    const timestamp = "1000";
    const signature = createHmac("sha256", secret).update(`${id}.${timestamp}.${payload}`).digest("base64");
    const headers = new Headers({
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": signature
    });

    await expect(verifyDodoStandardWebhookSignature(payload, headers, secret, 1000)).resolves.toBe(true);
    await expect(verifyDodoStandardWebhookSignature(payload, headers, secret, 1301)).resolves.toBe(false);
  });

  it("verifies Dodo whsec secrets using their base64-encoded key material", async () => {
    const payload = JSON.stringify({ type: "payment.succeeded" });
    const key = "dodo-webhook-secret";
    const secret = `whsec_${Buffer.from(key).toString("base64")}`;
    const id = "msg_prefixed_test";
    const timestamp = "1000";
    const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64");
    const headers = new Headers({
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${signature}`
    });

    await expect(verifyDodoStandardWebhookSignature(payload, headers, secret, 1000)).resolves.toBe(true);
  });

  it("accepts either Dodo webhook secret during a zero-downtime rotation", async () => {
    const payload = JSON.stringify({ type: "payment.succeeded" });
    const previousSecret = "previous-dodo-secret";
    const id = "msg_rotation_test";
    const timestamp = "1000";
    const signature = createHmac("sha256", previousSecret).update(`${id}.${timestamp}.${payload}`).digest("base64");
    const headers = new Headers({
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": signature
    });

    await expect(
      verifyDodoStandardWebhookSignatures(payload, headers, ["new-dodo-secret", previousSecret], 1000)
    ).resolves.toBe(true);
    await expect(
      verifyDodoStandardWebhookSignatures(payload, headers, ["new-dodo-secret", "other-secret"], 1000)
    ).resolves.toBe(false);
  });

  it("accepts either Superwall webhook secret during a zero-downtime rotation", async () => {
    const payload = JSON.stringify({ type: "transaction" });
    const previousKey = "previous-superwall-secret";
    const previousSecret = `whsec_${Buffer.from(previousKey).toString("base64")}`;
    const id = "msg_superwall_rotation";
    const timestamp = "1000";
    const signature = createHmac("sha256", previousKey).update(`${id}.${timestamp}.${payload}`).digest("base64");
    const headers = new Headers({
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": `v1,${signature}`
    });

    await expect(
      verifySuperwallSvixSignatures(payload, headers, ["whsec_bmV3LXN1cGVyd2FsbC1zZWNyZXQ=", previousSecret], 1000)
    ).resolves.toBe(true);
    await expect(
      verifySuperwallSvixSignatures(payload, headers, ["whsec_bmV3LXN1cGVyd2FsbC1zZWNyZXQ="], 1000)
    ).resolves.toBe(false);
  });
});
