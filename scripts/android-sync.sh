#!/usr/bin/env bash
# =============================================================================
# Inflow — Quick Android sync after web code changes.
# Run whenever you pull new web code; re-copies native sources too (in case the
# Kotlin plugin changed) and re-syncs the Capacitor Android project.
#
# Usage: ./scripts/android-sync.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
NATIVE_DIR="$ROOT_DIR/android-native"
PKG_DIR="$ROOT_DIR/android/app/src/main/java/co/nz/inflowapp"
cd "$ROOT_DIR"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[sync]${NC} $*"; }
success() { echo -e "${GREEN}[sync]${NC} ✅ $*"; }

info "Building web app..."
npm run build
success "Web app built"

info "Syncing to Android..."
npx cap sync android
success "Android synced"

if [ -d "$PKG_DIR" ]; then
    info "Refreshing native Kotlin sources..."
    cp "$NATIVE_DIR/co/nz/inflowapp/MainActivity.kt" "$PKG_DIR/"
    cp "$NATIVE_DIR/co/nz/inflowapp/voice/"*.kt "$PKG_DIR/voice/"
    success "Native sources refreshed"
fi

echo ""
echo -e "${GREEN}Done! Rebuild in Android Studio to see changes on device.${NC}"
echo ""
