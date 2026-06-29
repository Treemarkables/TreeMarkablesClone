#!/usr/bin/env bash
# Generate the Electron app icons from the existing Inflow brand icon, using only
# built-in macOS tools (sips + iconutil). Run from anywhere:
#
#   ./electron/assets/gen-icons.sh
#
# Produces (gitignored) electron/assets/icon.icns + icon.png for electron-builder.
# Windows icon.ico isn't produced here (no built-in mac tool); generate it separately
# if/when you do a Windows build (e.g. npx electron-icon-builder, or an online converter).

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$DIR/../../client/public/inflow-icon-512.png"   # 512×512 brand icon

if [ ! -f "$SRC" ]; then
  echo "✗ source icon not found: $SRC" >&2
  exit 1
fi

# Linux / window icon
cp "$SRC" "$DIR/icon.png"

# macOS .icns — build an .iconset at the required sizes, then convert.
ICONSET="$(mktemp -d)/icon.iconset"
mkdir -p "$ICONSET"
for sz in 16 32 64 128 256 512; do
  sips -z "$sz" "$sz"       "$SRC" --out "$ICONSET/icon_${sz}x${sz}.png"      >/dev/null
  dbl=$((sz * 2))
  sips -z "$dbl" "$dbl"     "$SRC" --out "$ICONSET/icon_${sz}x${sz}@2x.png"   >/dev/null
done
iconutil -c icns "$ICONSET" -o "$DIR/icon.icns"
rm -rf "$(dirname "$ICONSET")"

echo "✓ wrote $DIR/icon.icns and $DIR/icon.png (from inflow-icon-512.png)"
