#!/usr/bin/env bash
set -euo pipefail

APP_NAME="ChaChing"
BUNDLE_ID="${BUNDLE_ID:?Set BUNDLE_ID for the official release}"
VERSION="${VERSION:-0.1.0}"
BUILD_NUMBER="${BUILD_NUMBER:-1}"
MIN_SYSTEM_VERSION="${MIN_SYSTEM_VERSION:-14.0}"
SIGN_IDENTITY="${SIGN_IDENTITY:?Set SIGN_IDENTITY for the official release}"
SPARKLE_PUBLIC_ED_KEY="${SPARKLE_PUBLIC_ED_KEY:-TuKvWSDfVUWl/K/EuQcInTah2VN3xJMQzZsm1wr716A=}"
SPARKLE_ACCOUNT="${SPARKLE_ACCOUNT:?Set SPARKLE_ACCOUNT for the official release}"
APPCAST_URL_PREFIX="${APPCAST_URL_PREFIX:?Set APPCAST_URL_PREFIX for the official release}"
APPCAST_LINK="${APPCAST_LINK:?Set APPCAST_LINK for the official release}"
GENERATE_APPCAST="${GENERATE_APPCAST:-1}"
WEBSITE_DIR="${WEBSITE_DIR:?Set WEBSITE_DIR for the official release}"
NOTARY_PROFILE="${NOTARY_PROFILE:-}"
NOTARY_KEY="${NOTARY_KEY:-}"
NOTARY_KEY_ID="${NOTARY_KEY_ID:-}"
NOTARY_ISSUER="${NOTARY_ISSUER:-}"
SKIP_NOTARIZATION="${SKIP_NOTARIZATION:-0}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
APP_BUNDLE="$DIST_DIR/$APP_NAME.app"
APP_CONTENTS="$APP_BUNDLE/Contents"
APP_MACOS="$APP_CONTENTS/MacOS"
APP_RESOURCES="$APP_CONTENTS/Resources"
APP_FRAMEWORKS="$APP_CONTENTS/Frameworks"
APP_BINARY="$APP_MACOS/$APP_NAME"
INFO_PLIST="$APP_CONTENTS/Info.plist"
ZIP_VERSIONED="$DIST_DIR/$APP_NAME-$VERSION.zip"
ZIP_LATEST="$DIST_DIR/$APP_NAME.zip"
ICON_SOURCE="$ROOT_DIR/Sources/ChaChing/Resources/Logo/cha-logo-transparent.png"
FALLBACK_ICON_SOURCE="$ROOT_DIR/Sources/ChaChing/Resources/Logo/cha-logo.png"
SPARKLE_FRAMEWORK_SOURCE="${SPARKLE_FRAMEWORK_SOURCE:-$ROOT_DIR/.build/artifacts/sparkle/Sparkle/Sparkle.xcframework/macos-arm64_x86_64/Sparkle.framework}"
SPARKLE_BIN_DIR="${SPARKLE_BIN_DIR:-$ROOT_DIR/.build/artifacts/sparkle/Sparkle/bin}"
RELEASE_DIR="${RELEASE_DIR:-$WEBSITE_DIR/public/cha-ching/releases}"
PUBLIC_APPCAST_PATH="${PUBLIC_APPCAST_PATH:-$WEBSITE_DIR/public/cha-ching/appcast.xml}"
PUBLIC_DOWNLOAD_PATH="${PUBLIC_DOWNLOAD_PATH:-$WEBSITE_DIR/public/downloads/$APP_NAME.zip}"

BUILD_ARGS=(-c release)
if [[ "${UNIVERSAL:-1}" == "1" ]]; then
  BUILD_ARGS+=(--arch arm64 --arch x86_64)
fi

if [[ -n "$NOTARY_PROFILE" && -n "$NOTARY_KEY" ]]; then
  echo "Use either NOTARY_PROFILE or NOTARY_KEY, not both." >&2
  exit 1
fi

if [[ -n "$NOTARY_KEY" && ( -z "$NOTARY_KEY_ID" || -z "$NOTARY_ISSUER" ) ]]; then
  echo "NOTARY_KEY requires NOTARY_KEY_ID and NOTARY_ISSUER." >&2
  exit 1
fi

if [[ "$SKIP_NOTARIZATION" != "1" && -z "$NOTARY_PROFILE" && -z "$NOTARY_KEY" ]]; then
  echo "Set NOTARY_PROFILE or NOTARY_KEY, or explicitly set SKIP_NOTARIZATION=1." >&2
  exit 1
fi

swift build --package-path "$ROOT_DIR" "${BUILD_ARGS[@]}"
BUILD_DIR="$(swift build --package-path "$ROOT_DIR" "${BUILD_ARGS[@]}" --show-bin-path)"
BUILD_BINARY="$BUILD_DIR/$APP_NAME"
RESOURCE_BUNDLE="$BUILD_DIR/${APP_NAME}_${APP_NAME}.bundle"

rm -rf "$APP_BUNDLE" "$ZIP_VERSIONED" "$ZIP_LATEST"
mkdir -p "$APP_MACOS" "$APP_RESOURCES" "$APP_FRAMEWORKS"
cp "$BUILD_BINARY" "$APP_BINARY"
chmod +x "$APP_BINARY"

if [[ -d "$RESOURCE_BUNDLE" ]]; then
  cp -R "$RESOURCE_BUNDLE" "$APP_RESOURCES/"
fi

if [[ -d "$SPARKLE_FRAMEWORK_SOURCE" ]]; then
  ditto "$SPARKLE_FRAMEWORK_SOURCE" "$APP_FRAMEWORKS/Sparkle.framework"
  if ! otool -l "$APP_BINARY" | grep -q "@executable_path/../Frameworks"; then
    install_name_tool -add_rpath "@executable_path/../Frameworks" "$APP_BINARY"
  fi
else
  cat >&2 <<EOF
Missing Sparkle framework: $SPARKLE_FRAMEWORK_SOURCE

Run:
  swift package resolve --package-path "$ROOT_DIR"
EOF
  exit 1
fi

if [[ ! -f "$ICON_SOURCE" && -f "$FALLBACK_ICON_SOURCE" ]]; then
  ICON_SOURCE="$FALLBACK_ICON_SOURCE"
fi

if [[ -f "$ICON_SOURCE" ]]; then
  ICONSET="$DIST_DIR/$APP_NAME.iconset"
  rm -rf "$ICONSET"
  mkdir -p "$ICONSET"

  sips -z 16 16 "$ICON_SOURCE" --out "$ICONSET/icon_16x16.png" >/dev/null
  sips -z 32 32 "$ICON_SOURCE" --out "$ICONSET/icon_16x16@2x.png" >/dev/null
  sips -z 32 32 "$ICON_SOURCE" --out "$ICONSET/icon_32x32.png" >/dev/null
  sips -z 64 64 "$ICON_SOURCE" --out "$ICONSET/icon_32x32@2x.png" >/dev/null
  sips -z 128 128 "$ICON_SOURCE" --out "$ICONSET/icon_128x128.png" >/dev/null
  sips -z 256 256 "$ICON_SOURCE" --out "$ICONSET/icon_128x128@2x.png" >/dev/null
  sips -z 256 256 "$ICON_SOURCE" --out "$ICONSET/icon_256x256.png" >/dev/null
  sips -z 512 512 "$ICON_SOURCE" --out "$ICONSET/icon_256x256@2x.png" >/dev/null
  sips -z 512 512 "$ICON_SOURCE" --out "$ICONSET/icon_512x512.png" >/dev/null
  sips -z 1024 1024 "$ICON_SOURCE" --out "$ICONSET/icon_512x512@2x.png" >/dev/null
  iconutil -c icns "$ICONSET" -o "$APP_RESOURCES/$APP_NAME.icns"
  rm -rf "$ICONSET"
fi

/usr/libexec/PlistBuddy -c "Clear dict" "$INFO_PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleExecutable string $APP_NAME" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string $BUNDLE_ID" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :ChaChingDistribution string hosted" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :CFBundleName string $APP_NAME" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :CFBundleDisplayName string Cha-Ching" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :CFBundleIconFile string $APP_NAME" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :CFBundlePackageType string APPL" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :CFBundleShortVersionString string $VERSION" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :CFBundleVersion string $BUILD_NUMBER" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :LSMinimumSystemVersion string $MIN_SYSTEM_VERSION" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :LSApplicationCategoryType string public.app-category.finance" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :NSPrincipalClass string NSApplication" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :SUFeedURL string $APPCAST_LINK/appcast" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :SUPublicEDKey string $SPARKLE_PUBLIC_ED_KEY" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :SUScheduledCheckInterval integer 86400" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :SUEnableAutomaticChecks bool true" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :SUAutomaticallyUpdate bool false" "$INFO_PLIST"

codesign --force --options runtime --timestamp --sign "$SIGN_IDENTITY" "$APP_FRAMEWORKS/Sparkle.framework/Versions/B/Updater.app"
codesign --force --options runtime --timestamp --sign "$SIGN_IDENTITY" "$APP_FRAMEWORKS/Sparkle.framework/Versions/B/XPCServices/Downloader.xpc"
codesign --force --options runtime --timestamp --sign "$SIGN_IDENTITY" "$APP_FRAMEWORKS/Sparkle.framework/Versions/B/XPCServices/Installer.xpc"
codesign --force --options runtime --timestamp --sign "$SIGN_IDENTITY" "$APP_FRAMEWORKS/Sparkle.framework/Versions/B/Autoupdate"
codesign --force --options runtime --timestamp --sign "$SIGN_IDENTITY" "$APP_FRAMEWORKS/Sparkle.framework"
codesign --force --options runtime --timestamp --sign "$SIGN_IDENTITY" "$APP_BINARY"
codesign --force --options runtime --timestamp --sign "$SIGN_IDENTITY" "$APP_BUNDLE"
codesign --verify --deep --strict --verbose=2 "$APP_BUNDLE"

ditto -c -k --keepParent --sequesterRsrc "$APP_BUNDLE" "$ZIP_VERSIONED"
cp "$ZIP_VERSIONED" "$ZIP_LATEST"

if [[ -n "$NOTARY_PROFILE" || -n "$NOTARY_KEY" ]]; then
  if [[ -n "$NOTARY_PROFILE" ]]; then
    xcrun notarytool submit "$ZIP_VERSIONED" --keychain-profile "$NOTARY_PROFILE" --wait
  else
    xcrun notarytool submit "$ZIP_VERSIONED" --key "$NOTARY_KEY" --key-id "$NOTARY_KEY_ID" --issuer "$NOTARY_ISSUER" --wait
  fi
  xcrun stapler staple "$APP_BUNDLE"
  xcrun stapler validate "$APP_BUNDLE"
  rm -f "$ZIP_VERSIONED" "$ZIP_LATEST"
  ditto -c -k --keepParent --sequesterRsrc "$APP_BUNDLE" "$ZIP_VERSIONED"
  cp "$ZIP_VERSIONED" "$ZIP_LATEST"
fi

if [[ "$GENERATE_APPCAST" == "1" ]]; then
  if [[ ! -x "$SPARKLE_BIN_DIR/generate_appcast" ]]; then
    cat >&2 <<EOF
Missing Sparkle appcast generator: $SPARKLE_BIN_DIR/generate_appcast

Run:
  swift package resolve --package-path "$ROOT_DIR"
EOF
    exit 1
  fi

  mkdir -p "$RELEASE_DIR" "$(dirname "$PUBLIC_APPCAST_PATH")" "$(dirname "$PUBLIC_DOWNLOAD_PATH")"
  RELEASE_ARCHIVE="$RELEASE_DIR/$APP_NAME-$VERSION.zip"
  RELEASE_NOTES="$RELEASE_DIR/$APP_NAME-$VERSION.md"
  cp "$ZIP_VERSIONED" "$RELEASE_ARCHIVE"
  cp "$ZIP_LATEST" "$PUBLIC_DOWNLOAD_PATH"

  if [[ ! -f "$RELEASE_NOTES" ]]; then
    cat > "$RELEASE_NOTES" <<EOF
# Cha-Ching $VERSION

- Adds the latest Cha-Ching beta build.
- Includes built-in Sparkle update checks for future releases.
- Keeps webhook ingestion hosted so revenue events are not missed while the Mac is offline.
EOF
  fi

  APPCAST_INPUT_DIR="$(mktemp -d)"
  find "$RELEASE_DIR" -maxdepth 1 -type f \( -name "*.zip" -o -name "*.md" -o -name "*.delta" -o -name "appcast.xml" \) -exec cp {} "$APPCAST_INPUT_DIR/" \;

  "$SPARKLE_BIN_DIR/generate_appcast" \
    --account "$SPARKLE_ACCOUNT" \
    --download-url-prefix "$APPCAST_URL_PREFIX" \
    --release-notes-url-prefix "$APPCAST_URL_PREFIX" \
    --link "$APPCAST_LINK" \
    --embed-release-notes \
    -o "$APPCAST_INPUT_DIR/appcast.xml" \
    "$APPCAST_INPUT_DIR"

  find "$APPCAST_INPUT_DIR" -maxdepth 1 -type f -name "*.delta" -exec cp {} "$RELEASE_DIR/" \;
  cp "$APPCAST_INPUT_DIR/appcast.xml" "$RELEASE_DIR/appcast.xml"
  rm -rf "$APPCAST_INPUT_DIR"
  cp "$RELEASE_DIR/appcast.xml" "$PUBLIC_APPCAST_PATH"
fi

echo "$ZIP_VERSIONED"
