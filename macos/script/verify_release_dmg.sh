#!/usr/bin/env bash
set -euo pipefail

DMG_PATH="${1:?Usage: verify_release_dmg.sh /path/to/release.dmg}"

codesign --verify --verbose=2 "$DMG_PATH"
xcrun stapler validate "$DMG_PATH"
spctl --assess --type open --context context:primary-signature --verbose=4 "$DMG_PATH"

echo "Release DMG signature, notarization ticket, and Gatekeeper assessment are valid."
