#!/usr/bin/env bash
# scripts/ios-setup.sh
#
# Run this script on a Mac with Xcode 15+.
# It creates the iOS Capacitor project, wires in the native CallKit/PushKit plugin,
# and either installs CocoaPods (older Capacitor) or prints SPM instructions (Capacitor 6+).
#
# Usage:
#   chmod +x scripts/ios-setup.sh
#   ./scripts/ios-setup.sh

set -e

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

# --- Step 2: Add / sync iOS platform ---
echo "[2/7] Setting up iOS platform..."
if [ -d "$ROOT_DIR/ios" ]; then
    echo "    ios/ already exists — syncing..."
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

# --- Step 5: Patch Info.plist ---
echo "[5/7] Patching Info.plist with background modes..."
INFO_PLIST="$IOS_APP_DIR/Info.plist"

add_bg_mode() {
    local MODE="$1"
    /usr/libexec/PlistBuddy -c "Print :UIBackgroundModes" "$INFO_PLIST" 2>/dev/null | grep -q "$MODE" && {
        echo "    UIBackgroundModes:$MODE already set"; return
    }
    /usr/libexec/PlistBuddy -c "Print :UIBackgroundModes" "$INFO_PLIST" 2>/dev/null || \
        /usr/libexec/PlistBuddy -c "Add :UIBackgroundModes array" "$INFO_PLIST"
    /usr/libexec/PlistBuddy -c "Add :UIBackgroundModes: string $MODE" "$INFO_PLIST"
    echo "    Added UIBackgroundModes:$MODE"
}
add_bg_mode "voip"
add_bg_mode "audio"
add_bg_mode "remote-notification"

/usr/libexec/PlistBuddy -c \
    "Print :NSMicrophoneUsageDescription" "$INFO_PLIST" 2>/dev/null || \
/usr/libexec/PlistBuddy -c \
    "Add :NSMicrophoneUsageDescription string 'Treemarkables needs microphone access for voice calls with customers.'" \
    "$INFO_PLIST"
echo "    ✓ Info.plist patched"

# --- Step 6 & 7: Twilio Voice SDK ---
echo "[6/7] Adding Twilio Voice SDK..."

if [ -f "$PODFILE" ]; then
    # CocoaPods path (Capacitor 4/5)
    echo "    Detected CocoaPods (Podfile found)"
    if grep -q "TwilioVoice" "$PODFILE"; then
        echo "    TwilioVoice already in Podfile"
    else
        sed -i.bak "s/  capacitor_pods/  capacitor_pods\n  pod 'TwilioVoice', '~> 6.12'/" "$PODFILE"
        rm -f "${PODFILE}.bak"
        echo "    ✓ pod 'TwilioVoice', '~> 6.12' added to Podfile"
    fi
    echo "[7/7] Installing CocoaPods dependencies..."
    cd "$ROOT_DIR/ios/App"
    pod install
    cd "$ROOT_DIR"
    echo "    ✓ pod install complete"
else
    # Swift Package Manager path (Capacitor 6+)
    echo "    Detected Swift Package Manager (no Podfile — Capacitor 6+)"
    echo "    ✓ SPM projects add TwilioVoice directly in Xcode (see instructions below)"
    echo "[7/7] Skipped (SPM — no pod install needed)"
fi

echo ""
echo "=== Setup complete! ==="
echo ""

if [ ! -f "$PODFILE" ]; then
    echo "IMPORTANT — Add TwilioVoice Swift Package in Xcode:"
    echo "  1.  npx cap open ios"
    echo "  2.  In Xcode: File → Add Package Dependencies..."
    echo "  3.  Paste URL: https://github.com/twilio/twilio-voice-ios"
    echo "  4.  Version rule: Up to Next Major from 6.12.0"
    echo "  5.  Add 'TwilioVoice' library to the 'App' target"
    echo ""
fi

echo "Next steps in Xcode:"
echo "  • Signing & Capabilities → set Team + Bundle ID: com.treemarkables.app"
echo "  • Add capability: Push Notifications"
echo "  • Add capability: Background Modes"
echo "      ✓ Voice over IP"
echo "      ✓ Audio, AirPlay, and Picture in Picture"
echo "      ✓ Remote notifications"
echo "  • Connect iPhone → press Run (⌘R)"
echo ""
echo "Required Replit Secrets (already set):"
echo "  TWILIO_API_KEY     — SK... from Twilio Console → API Keys"
echo "  TWILIO_API_SECRET  — shown once when key was created"
echo ""
echo "For TestFlight: Product → Archive → Distribute App → App Store Connect"
