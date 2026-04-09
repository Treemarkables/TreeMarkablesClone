#!/usr/bin/env bash
# scripts/ios-setup.sh
#
# Run this script on a Mac with Xcode 15+ and CocoaPods installed.
# It creates the iOS Capacitor project, installs the Twilio Voice SDK,
# and wires in the native CallKit/PushKit plugin.
#
# Usage:
#   chmod +x scripts/ios-setup.sh
#   ./scripts/ios-setup.sh
#
# Prerequisites:
#   - Node.js 20+
#   - Xcode 15+ (from Mac App Store)
#   - CocoaPods: sudo gem install cocoapods
#   - Apple Developer account configured in Xcode

set -e  # Exit on first error

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IOS_NATIVE_DIR="$ROOT_DIR/ios-native"
IOS_APP_DIR="$ROOT_DIR/ios/App/App"
PODFILE="$ROOT_DIR/ios/App/Podfile"

echo "=== Treemarkables iOS Setup ==="
echo "Root: $ROOT_DIR"
echo ""

# --- Step 1: Build web app ---
echo "[1/7] Building web app..."
cd "$ROOT_DIR"
npm run build
echo "    ✓ Web app built"

# --- Step 2: Add iOS platform (idempotent) ---
echo "[2/7] Adding iOS platform..."
if [ -d "$ROOT_DIR/ios" ]; then
    echo "    ios/ already exists — syncing instead"
    npx cap sync ios
else
    npx cap add ios
fi
echo "    ✓ iOS platform ready"

# --- Step 3: Copy native Twilio Voice plugin ---
echo "[3/7] Copying Twilio Voice native plugin..."
cp "$IOS_NATIVE_DIR/TwilioVoicePlugin.swift" "$IOS_APP_DIR/"
cp "$IOS_NATIVE_DIR/TwilioVoicePlugin.m"     "$IOS_APP_DIR/"
echo "    ✓ Plugin files copied to ios/App/App/"

# --- Step 4: Apply entitlements (VoIP push) ---
echo "[4/7] Applying entitlements..."
ENTITLEMENTS_DST="$IOS_APP_DIR/App.entitlements"
if [ -f "$ENTITLEMENTS_DST" ]; then
    echo "    App.entitlements already exists — merging VoIP key..."
    # Add VoIP key if not already present
    /usr/libexec/PlistBuddy -c \
        "Print :com.apple.developer.pushkit.unrestricted-voip" \
        "$ENTITLEMENTS_DST" 2>/dev/null || \
    /usr/libexec/PlistBuddy -c \
        "Add :com.apple.developer.pushkit.unrestricted-voip bool true" \
        "$ENTITLEMENTS_DST"
else
    cp "$IOS_NATIVE_DIR/App.entitlements" "$ENTITLEMENTS_DST"
    echo "    App.entitlements created"
fi
echo "    ✓ VoIP push entitlement applied"

# --- Step 5: Patch Info.plist with background modes ---
echo "[5/7] Patching Info.plist with background modes..."
INFO_PLIST="$IOS_APP_DIR/Info.plist"

# UIBackgroundModes array — add voip, audio if not present
add_bg_mode() {
    local MODE="$1"
    # Check if already present
    /usr/libexec/PlistBuddy -c "Print :UIBackgroundModes" "$INFO_PLIST" 2>/dev/null | grep -q "$MODE" && {
        echo "    UIBackgroundModes:$MODE already set"
        return
    }
    # Array may not exist yet
    /usr/libexec/PlistBuddy -c "Print :UIBackgroundModes" "$INFO_PLIST" 2>/dev/null || \
        /usr/libexec/PlistBuddy -c "Add :UIBackgroundModes array" "$INFO_PLIST"
    /usr/libexec/PlistBuddy -c "Add :UIBackgroundModes: string $MODE" "$INFO_PLIST"
    echo "    Added UIBackgroundModes:$MODE"
}
add_bg_mode "voip"
add_bg_mode "audio"
add_bg_mode "remote-notification"

# Microphone usage description (required for voice calls)
/usr/libexec/PlistBuddy -c \
    "Print :NSMicrophoneUsageDescription" \
    "$INFO_PLIST" 2>/dev/null || \
/usr/libexec/PlistBuddy -c \
    "Add :NSMicrophoneUsageDescription string 'Treemarkables needs microphone access for voice calls with customers.'" \
    "$INFO_PLIST"

echo "    ✓ Info.plist patched"

# --- Step 6: Edit Podfile to add Twilio Voice SDK ---
echo "[6/7] Adding Twilio Voice SDK to Podfile..."
if grep -q "TwilioVoice" "$PODFILE"; then
    echo "    TwilioVoice already in Podfile"
else
    # Insert after 'capacitor_pods' line inside the App target
    sed -i.bak "s/  capacitor_pods/  capacitor_pods\n  pod 'TwilioVoice', '~> 6.12'/" "$PODFILE"
    rm -f "${PODFILE}.bak"
    echo "    ✓ pod 'TwilioVoice', '~> 6.12' added to Podfile"
fi

# --- Step 7: Install CocoaPods ---
echo "[7/7] Installing CocoaPods dependencies..."
cd "$ROOT_DIR/ios/App"
pod install
cd "$ROOT_DIR"
echo "    ✓ pod install complete"

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "  1. Open Xcode:  npx cap open ios"
echo "  2. In Xcode → Signing & Capabilities:"
echo "       - Set your Team and Bundle ID (com.treemarkables.app)"
echo "       - Add capability: Push Notifications"
echo "       - Add capability: Background Modes"
echo "           ✓ Voice over IP"
echo "           ✓ Audio, AirPlay, and Picture in Picture"
echo "           ✓ Remote notifications"
echo "  3. Connect your iPhone, press Run (⌘R)"
echo "  4. Log in to the app — it will register for VoIP push automatically"
echo ""
echo "Required Replit Secrets:"
echo "  TWILIO_API_KEY     — API Key SID (SK...) from Twilio Console → API Keys"
echo "  TWILIO_API_SECRET  — API Key Secret (shown once)"
echo ""
echo "For TestFlight: Product → Archive → Distribute App → App Store Connect"
