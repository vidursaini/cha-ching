# Cha-Ching Worker

Cloudflare Worker and D1 backend shared by Cha-Ching Hosted and Cha-Ching Community.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/vidursaini/cha-ching/tree/main/worker)

## Deployment modes

The default `wrangler.jsonc` is the Community template. It uses `DEPLOYMENT_MODE=self_hosted`, contains no Cha-Ching production domain or database binding, and is suitable for Cloudflare's automatic D1 provisioning.

`wrangler.hosted.example.jsonc` documents hosted-only variables without publishing the official service's account-specific configuration. The operator keeps the real `wrangler.hosted.jsonc` ignored locally.

Shared functionality includes:

- Per-app Superwall and RevenueCat webhook URLs.
- Encrypted provider credentials scoped to one owner or hosted license.
- Redacted and size-capped raw webhook storage.
- Normalized, deduplicated revenue events.
- Cursor-based event catch-up and combined revenue summary sync.
- Automatic removal of old raw payload bodies while retaining normalized events and audit rows.

## Community deployment

Generate two different random secrets. Each should be at least 24 characters:

```bash
openssl rand -base64 32
openssl rand -base64 32
```

Configure them as Worker secrets:

```bash
npx wrangler secret put SELF_HOST_SETUP_TOKEN
npx wrangler secret put PROVIDER_CONFIG_ENCRYPTION_KEY
```

Then apply migrations and deploy:

```bash
npm install
npm run deploy
```

The Deploy to Cloudflare button provisions D1 automatically, prompts for the two secrets from `.dev.vars.example`, applies all migrations, and deploys the Worker. If the account has not used Workers before, Cloudflare also asks the owner to register a free `workers.dev` subdomain.

Enter the resulting HTTPS Worker URL and `SELF_HOST_SETUP_TOKEN` in a Community build of the Mac app. The setup token is used to mint an internal device token and is not retained by the app. Provider secrets are encrypted with `PROVIDER_CONFIG_ENCRYPTION_KEY` before they are written to D1.

For local development, copy `.dev.vars.example` to `.dev.vars`, replace both values, then run:

```bash
npm install
npx wrangler d1 migrations apply DB --local
npm run dev
```

## Hosted deployment

Hosted secrets remain in Cloudflare and are set with `wrangler secret put --config wrangler.hosted.jsonc`. Required hosted secrets are:

- `DODO_PAYMENTS_API_KEY`
- `DODO_PAYMENTS_WEBHOOK_KEY`
- `DODO_PRODUCT_ID`
- `ADMIN_TOKEN`
- `PROVIDER_CONFIG_ENCRYPTION_KEY`

Optional hosted secrets and variables include `RESEND_API_KEY`, checkout URLs, CORS origins, and the legacy global Superwall settings. Deploy only with:

```bash
npm run deploy:hosted
```

Before the first hosted deployment, copy `wrangler.hosted.example.jsonc` to the ignored `wrangler.hosted.jsonc`, replace every example value, and add the production D1 binding. Community users do not need this file.

## API

Shared endpoints:

- `GET /api/meta`
- `POST /api/webhooks/superwall/:token`
- `POST /api/webhooks/revenuecat/:token`
- `GET|POST /api/provider-configs`
- `GET /api/sync?after=0`
- `GET /api/events?after=0` (backward compatibility)
- `GET /api/revenue-card` (backward compatibility)

Hosted-only endpoints:

- `POST /api/webhooks/dodo`
- `POST /api/checkout`
- `POST /api/licenses/activate`
- `POST /api/licenses/resend`

Community-only endpoint:

- `POST /api/self-host/activate`

## Reliability boundary

Cha-Ching is reliable for events emitted to the configured webhook endpoint. It cannot infer a store renewal that Superwall or RevenueCat never sends.
