#!/usr/bin/env bash
# =============================================================================
# Treemarkables — Quick iOS sync after web code changes
# Run this on your Mac whenever you pull new code from Replit.
#
# Usage: ./scripts/ios-sync.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[sync]${NC} $*"; }
success() { echo -e "${GREEN}[sync]${NC} ✅ $*"; }

info "Building web app..."
npm run build
success "Web app built"

info "Syncing to iOS..."
npx cap sync ios
success "iOS synced"

echo ""
echo -e "${GREEN}Done! Rebuild in Xcode (⌘R) to see changes on device.${NC}"
echo ""
