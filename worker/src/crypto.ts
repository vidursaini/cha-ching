export async function verifySuperwallSvixSignature(
  payload: string,
  headers: Headers,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<boolean> {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatureHeader = headers.get("svix-signature");
  if (!id || !timestamp || !signatureHeader) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > 300) return false;

  const secretPart = secret.includes("_") ? secret.split("_").at(-1) : secret;
  if (!secretPart) return false;

  const signedContent = `${id}.${timestamp}.${payload}`;
  const expected = await hmacBase64(secretPart, signedContent, "base64");
  const candidates = signatureHeader
    .split(" ")
    .flatMap((chunk) => chunk.split(","))
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return candidates.some((candidate) => timingSafeEqual(candidate.replace(/^v\\d+=?/, ""), expected));
}

export async function verifyDodoStandardWebhookSignature(
  payload: string,
  headers: Headers,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<boolean> {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");
  if (!id || !timestamp || !signatureHeader) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > 300) return false;

  const signedContent = `${id}.${timestamp}.${payload}`;
  const prefixedSecret = secret.match(/^whsec_(.+)$/)?.[1];
  const expected = await hmacBase64(prefixedSecret ?? secret, signedContent, prefixedSecret ? "base64" : "utf8");
  const candidates = signatureHeader
    .split(" ")
    .flatMap((chunk) => chunk.split(","))
    .map((chunk) => chunk.trim().replace(/^v\\d+=?/, ""))
    .filter(Boolean);

  return candidates.some((candidate) => timingSafeEqual(candidate, expected));
}

export function randomToken(prefix: string): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const token = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return `${prefix}_${token}`;
}

export async function encryptJSON(value: unknown, secret: string): Promise<string> {
  const key = await aesKey(secret);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return `v1.${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(encrypted))}`;
}

export async function decryptJSON<T>(value: string, secret: string): Promise<T> {
  const [version, ivValue, encryptedValue] = value.split(".");
  if (version !== "v1" || !ivValue || !encryptedValue) {
    throw new Error("Unsupported encrypted payload format");
  }

  const key = await aesKey(secret);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlDecode(ivValue) },
    key,
    base64UrlDecode(encryptedValue)
  );
  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}

export function timingSafeStringEqual(left: string, right: string): boolean {
  return timingSafeEqual(left, right);
}

export async function timingSafeSecretEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right))
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let diff = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index]! ^ rightBytes[index]!;
  }
  return diff === 0;
}

async function hmacBase64(secret: string, message: string, secretEncoding: "base64" | "utf8"): Promise<string> {
  const keyBytes = secretEncoding === "base64" ? base64ToBytes(secret) : new TextEncoder().encode(secret);
  const rawKey = new ArrayBuffer(keyBytes.byteLength);
  new Uint8Array(rawKey).set(keyBytes);
  const key = await crypto.subtle.importKey("raw", rawKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signed)));
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const decoded = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length));
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

async function aesKey(secret: string): Promise<CryptoKey> {
  if (!secret.trim()) {
    throw new Error("Encryption secret is empty");
  }

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return base64ToBytes(padded);
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let diff = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index]! ^ rightBytes[index]!;
  }
  return diff === 0;
}
