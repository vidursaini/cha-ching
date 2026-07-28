# Cha-Ching

Cha-Ching is an AGPL-licensed native macOS revenue celebration app for indie app makers. It supports an official hosted edition and a free Community edition that runs in your own Cloudflare account.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/vidursaini/cha-ching/tree/main/worker)

It has two parts:

- `macos/` - native SwiftUI/AppKit menu-bar app.
- `worker/` - shared Cloudflare Worker + D1 backend for webhook ingest, activation, and event sync.

## Product

Superwall and RevenueCat webhooks are authenticated, persisted, normalized into revenue events, and replayed to the Mac app by cursor. Hosted builds activate Dodo license keys against the official API. Community builds connect to a user-owned Worker with a one-time setup token. Provider credentials are encrypted before storage in D1.

The Mac client uses one adaptive `/api/sync` request instead of separate high-frequency event and summary requests. Idle installations poll once per minute and back off during failures.

## Reliability Boundary

V1 is reliable for events emitted to the hosted endpoint. Direct App Store / Google Play reconciliation is intentionally a later upgrade.

## Local Development

Mac app:

```bash
cd macos
swift test --filter ChaChingCoreTests
./script/build_and_run.sh --demo
CHACHING_DISTRIBUTION=community ./script/build_and_run.sh --verify
./script/package_release.sh
```

Worker:

```bash
cd worker
npm install
npx wrangler d1 migrations apply DB --local
npm test
npx tsc --noEmit
```

Secrets are stored in Cloudflare and the local macOS Keychain, not in this repo.

See `worker/README.md` for Community deployment and hosted production commands.

## Editions

- **Community:** free, self-hosted, source build, user-owned Worker and D1 database.
- **Hosted:** paid official build, managed backend, Dodo license activation, signed and notarized DMG, and Sparkle updates.

## Security and licensing

The code is available under `AGPL-3.0-or-later`. See `SECURITY.md` for private vulnerability reporting, `docs/SECURITY_ARCHITECTURE.md` for the trust boundaries and residual risks, `CONTRIBUTING.md` for contribution requirements, and `TRADEMARKS.md` for use of the Cha-Ching name and logo.
