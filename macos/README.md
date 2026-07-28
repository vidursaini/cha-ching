# Cha-Ching

Cha-Ching is a native macOS menu-bar app that celebrates revenue events from the hosted Cha-Ching Worker.

## V1 behavior

- Activate a license against the hosted Worker.
- Add Superwall and RevenueCat webhook setup inside the native Mac app.
- Add multiple app connections for each provider, each with its own webhook URL.
- Store the device token in Keychain.
- Poll `/api/events` by cursor so missed events replay after sleep/reopen.
- Show a custom top-right sale toast plus full-screen confetti cannon for positive purchases and renewals.
- Show a screenshot-friendly revenue card.
- Demo mode creates fictional Nimbus Notes/Orbit Tasks revenue for launch screenshots.
- Check for app updates through Sparkle from the menu-bar app.

## Reliability boundary

The Mac app is not the source of truth. The hosted Worker receives and stores webhooks while the Mac is offline. V1 is reliable for events Superwall emits to the Worker.

## Local notes

Until a real license exists, use demo mode or seed a license in D1.

## Release packaging

Create a signed universal ZIP for direct website downloads:

```bash
./script/package_release.sh
```

Outputs:

- `dist/ChaChing-0.1.0.zip`
- `dist/ChaChing.zip`

Community builds use ad-hoc signing by default. Official release builds require explicit signing, Sparkle, website, and notarization environment variables. Set `SKIP_NOTARIZATION=1` only for local non-public packaging.

The release script also refreshes the download, release archive, and appcast below the `WEBSITE_DIR` supplied by the release operator.

Future updates are delivered by Sparkle from `https://www.vidursaini.com/cha-ching/appcast`.
