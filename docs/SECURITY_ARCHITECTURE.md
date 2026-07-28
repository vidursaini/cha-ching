# Security architecture

This document describes Cha-Ching's security boundaries. It is not a guarantee that the software is free of vulnerabilities. Report suspected issues privately as described in [`SECURITY.md`](../SECURITY.md).

## Trust boundaries

- Superwall and RevenueCat send revenue events to per-app, unguessable webhook URLs.
- The Cloudflare Worker verifies each provider's secret before normalizing an event.
- The macOS app authenticates API calls with a random device bearer token stored in Keychain.
- Hosted licenses are validated or activated against Dodo Payments before a device token is issued.
- Community owners prove control with a random setup token stored as a Worker secret.

## Secret storage

- Provider credentials are encrypted with AES-256-GCM before they are stored in D1. The encryption key is a Cloudflare Worker secret and is never stored in D1 or source control.
- Hosted payment, webhook, admin, and email credentials are Cloudflare Worker secrets.
- macOS license keys and device tokens are stored in Keychain, not UserDefaults.
- Repository history is scanned for credential patterns before public releases.

## Request protection

- Superwall webhooks use Svix HMAC verification with a five-minute replay window.
- RevenueCat webhooks require a per-app authorization value and compare its SHA-256 digest in constant time.
- Dodo webhooks use their signed webhook headers with a five-minute replay window.
- Request bodies have explicit size limits and event identifiers are deduplicated.
- Activation, checkout, configuration writes, resend, and test-event routes are rate limited.
- CORS is restricted to configured origins in the hosted deployment.

## Stored data

- Normalized revenue events contain operational purchase metadata such as app, product, store, country, amount, currency, and transaction identifiers.
- Raw webhook data is redacted before storage, capped at 32 KiB, and its body is removed after the configured retention period. The hosted default is 30 days. Cleanup is scheduled opportunistically by normal traffic, so it does not require a separately permissioned Cron Trigger.
- Provider credentials are decrypted only while processing the relevant request.
- Cha-Ching does not publish revenue data or expose a leaderboard.

## Known residual risks

- License keys and device tokens are bearer credentials in D1. Database access must be treated as privileged.
- Device revocation and rotation UI is not included in the current beta. A compromised device token should be revoked by an operator or replaced by redeploying the Community owner setup.
- Cloudflare account, Dodo account, and Apple signing-account security remain operator responsibilities. Use phishing-resistant MFA and least-privilege access.
- Self-hosters are responsible for setting strong unique secrets, applying migrations, reviewing logs, and keeping dependencies current.

## Operational release checks

Before a hosted release:

1. Run Worker tests, TypeScript type checking, and macOS unit tests.
2. Scan the current tree and Git history for credentials.
3. Back up D1 before applying production migrations.
4. Sign with Developer ID, notarize with Apple, staple, and validate both the app and DMG.
5. Verify the live health, metadata, sync, checkout, download, and appcast endpoints.
