# Contributing

Cha-Ching accepts focused bug fixes, tests, documentation improvements, and provider integrations.

## Development

Worker checks:

```bash
cd worker
npm install
npm test
npm run typecheck
```

macOS checks:

```bash
cd macos
swift test
CHACHING_DISTRIBUTION=community ./script/build_and_run.sh --verify
```

Use fake webhook payloads in tests. Never commit customer data, app credentials, license keys, device tokens, `.dev.vars`, or Cloudflare account credentials.

## Pull requests

- Keep changes scoped and explain the user-facing behavior.
- Add regression tests for bug fixes and unit tests for important logic.
- Preserve backward compatibility for persisted data and public APIs where practical.
- Confirm that no private app names or customer identifiers appear in fixtures, screenshots, or logs.

By contributing, you agree that your contribution is licensed under AGPL-3.0-or-later.
