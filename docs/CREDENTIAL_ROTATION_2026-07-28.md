# Credential rotation record: 2026-07-28

This record intentionally contains credential names and verification outcomes only. It does not contain secret values, provider object identifiers, customer data, or private backup paths.

## Scope

- Cloudflare Worker: `chaching-worker`
- Hosted API: `https://chaching-api.vidursaini.com`
- Providers: Cloudflare, Dodo Payments, Resend, and Superwall
- Source deployment used for compatibility: `a9ffbe55-1269-4bf6-8460-4dd8fcd1d042`

## Completed rotations

- Created and validated an off-repository D1 export before modifying encrypted provider configuration.
- Added dual-key provider configuration decryption, primary-key writes, deterministic migration planning, compare-and-swap migration, and conflict-aware rollback.
- Migrated two encrypted provider configurations to the new primary key, verified reads, and retired the old encryption key and temporary migration credentials.
- Rotated `ADMIN_TOKEN`.
- Removed confirmed-unused `DEFAULT_LICENSE_KEY` and global `SUPERWALL_WEBHOOK_SECRET` bindings.
- Rotated the Cha-Ching and LoadFast Resend API keys independently. Verified successful Cha-Ching delivery and a successful LoadFast magic-link request before deleting both superseded keys.
- Rotated the Dodo Payments API key. Verified hosted checkout creation before deleting the superseded key.
- Added dual-secret Dodo webhook verification. Verified current and fallback signatures, confirmed successful dashboard test deliveries, disabled the superseded endpoint, and removed `DODO_PAYMENTS_WEBHOOK_KEY_PREVIOUS`.
- Created a tokenized Superwall webhook and rotated its signing secret. Verified current and fallback signatures. The previous encrypted per-app secret remains temporarily available until the first genuine delivery reaches the new endpoint.

## Production verification

- Hosted API health check returned `{"ok":true}` after retirement.
- Cloudflare secret inventory contains only the expected active bindings.
- Full Worker test suite: 18 files and 53 tests passed.
- TypeScript typecheck passed.
- `git diff --check` passed.

## Deferred by design

- The disabled legacy Superwall webhook and encrypted previous per-app secret will be retired only after a genuine event is delivered successfully to the new endpoint.
- GitHub, Cloudflare account, Apple signing/notarization, and Sparkle credentials were not rotated because the preflight found no evidence that they were exposed.

## Rollback posture

- The validated D1 export remains outside the repository.
- Provider-encryption migration backups remain in D1 for controlled rollback.
- Resend and Dodo superseded credentials are permanently retired after replacement verification.
- Superwall retains a narrow dual-secret rollback window pending genuine provider delivery.
