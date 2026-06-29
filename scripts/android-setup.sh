#!/usr/bin/env bash
# scripts/android-setup.sh
#
# Run on a machine with the Android SDK + JDK 17 (Android Studio installed).
# Creates the Android Capacitor project, wires in the native Twilio Voice + FCM plugin,
# applies the Gradle/Manifest additions, and is safe to re-run (idempotent).
#
# Usage:
#   chmod +x scripts/android-setup.sh
#   ./scripts/android-setup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
NATIVE_DIR="$ROOT_DIR/android-native"
ANDROID_DIR="$ROOT_DIR/android"
JAVA_SRC="$ANDROID_DIR/app/src/main/java"
PKG_DIR="$JAVA_SRC/co/nz/inflowapp"
MANIFEST="$ANDROID_DIR/app/src/main/AndroidManifest.xml"
APP_GRADLE="$ANDROID_DIR/app/build.gradle"
PROJ_GRADLE="$ANDROID_DIR/build.gradle"

echo "=== Inflow Android Setup ==="
echo "Root: $ROOT_DIR"
echo ""

# --- Step 1: Build web app ---
echo "[1/7] Building web app..."
cd "$ROOT_DIR"
npm run build
echo "    ✓ Web app built"

# --- Step 2: Add / sync Android platform ---
echo "[2/7] Setting up Android platform..."
if [ -d "$ANDROID_DIR" ]; then
    echo "    android/ already exists — syncing..."
    npx cap sync android
else
    npx cap add android
fi
echo "    ✓ Android platform ready"

# --- Step 3: Copy native Kotlin sources ---
echo "[3/7] Copying native Kotlin sources..."
# Ensure the staged sources point at the configured app-shell URL first.
node "$SCRIPT_DIR/sync-app-shell-url.mjs" >/dev/null 2>&1 || true
mkdir -p "$PKG_DIR/voice"
cp "$NATIVE_DIR/co/nz/inflowapp/MainActivity.kt"      "$PKG_DIR/"
cp "$NATIVE_DIR/co/nz/inflowapp/voice/"*.kt            "$PKG_DIR/voice/"
# The Capacitor template ships a Java MainActivity — remove it so the Kotlin one wins.
if [ -f "$PKG_DIR/MainActivity.java" ]; then
    rm "$PKG_DIR/MainActivity.java"
    echo "    Removed generated MainActivity.java (replaced by MainActivity.kt)"
fi
echo "    ✓ Kotlin sources copied to $PKG_DIR"

# --- Step 4: google-services.json check ---
echo "[4/7] Checking Firebase config..."
if [ ! -f "$ANDROID_DIR/app/google-services.json" ]; then
    echo "    ⚠️  android/app/google-services.json is MISSING."
    echo "       Download it from Firebase Console (package: co.nz.inflowapp) and place it there."
    echo "       See android-native/google-services.json.PLACEHOLDER."
else
    echo "    ✓ google-services.json present"
fi

# --- Step 5: Patch project-level build.gradle ---
echo "[5/7] Patching project build.gradle..."
if ! grep -q "com.google.gms:google-services" "$PROJ_GRADLE"; then
    # Insert the classpath into the first buildscript { dependencies { ... } } block.
    perl -0pi -e 's/(buildscript\s*\{.*?dependencies\s*\{)/$1\n        classpath '"'"'com.google.gms:google-services:4.4.2'"'"'/s' "$PROJ_GRADLE"
    echo "    Added google-services classpath"
else
    echo "    google-services classpath already present"
fi
# Kotlin gradle plugin classpath — REQUIRED: the native code is Kotlin and the
# Capacitor template is Java-only, so without this the .kt files silently never
# compile (build "succeeds" but the app crashes with ClassNotFoundException).
if ! grep -q "kotlin-gradle-plugin" "$PROJ_GRADLE"; then
    perl -0pi -e 's/(buildscript\s*\{.*?dependencies\s*\{)/$1\n        classpath '"'"'org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.21'"'"'/s' "$PROJ_GRADLE"
    echo "    Added Kotlin gradle plugin classpath"
fi

# --- Step 6: Patch app build.gradle ---
echo "[6/7] Patching app build.gradle..."
if ! grep -q "com.google.gms.google-services" "$APP_GRADLE"; then
    printf "\napply plugin: 'com.google.gms.google-services'\n" >> "$APP_GRADLE"
    echo "    Applied google-services plugin"
fi
# Kotlin Android plugin — REQUIRED so the Kotlin native sources actually compile.
# Inserted next to the application plugin so it's applied early.
if ! grep -q "org.jetbrains.kotlin.android" "$APP_GRADLE"; then
    perl -0pi -e "s/(apply plugin: 'com.android.application')/\$1\napply plugin: 'org.jetbrains.kotlin.android'/" "$APP_GRADLE"
    echo "    Applied Kotlin Android plugin"
fi
if ! grep -q "com.twilio:voice-android" "$APP_GRADLE"; then
    cat >> "$APP_GRADLE" <<'EOF'

// --- Inflow native dependencies (added by scripts/android-setup.sh) ---
dependencies {
    implementation platform('com.google.firebase:firebase-bom:33.1.2')
    implementation 'com.google.firebase:firebase-messaging-ktx'
    implementation 'com.twilio:voice-android:6.6.3'
    implementation 'androidx.core:core-ktx:1.13.1'
}
EOF
    echo "    Added Firebase + Twilio Voice dependencies"
else
    echo "    Native dependencies already present"
fi
echo "    ⚠️  Ensure android { defaultConfig { minSdkVersion 24 } } (Twilio Voice needs API 24+)."
# Note: FCM tokens register per-user via the webview/session path (the web app POSTs the
# token with the signed-in employee's cookie) — no build-time secret or owner id needed.

# --- Step 7: Patch AndroidManifest.xml ---
echo "[7/7] Patching AndroidManifest.xml..."
if ! grep -q "MANAGE_OWN_CALLS" "$MANIFEST"; then
    python3 - "$MANIFEST" <<'PY'
import sys, re
path = sys.argv[1]
xml = open(path, encoding="utf-8").read()

perms = """    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.MANAGE_OWN_CALLS" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_PHONE_CALL" />
"""

services = """        <service
            android:name="co.nz.inflowapp.voice.VoiceFirebaseMessagingService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
        <service
            android:name="co.nz.inflowapp.voice.VoiceConnectionService"
            android:exported="true"
            android:permission="android.permission.BIND_TELECOM_CONNECTION_SERVICE">
            <intent-filter>
                <action android:name="android.telecom.ConnectionService" />
            </intent-filter>
        </service>
"""

# Insert permissions right after the opening <manifest ...> tag.
xml = re.sub(r"(<manifest[^>]*>\n)", r"\1" + perms, xml, count=1)
# Insert services right before </application>.
xml = xml.replace("    </application>", services + "    </application>", 1)

open(path, "w", encoding="utf-8").write(xml)
print("    Manifest permissions + services inserted")
PY
else
    echo "    Manifest already patched"
fi

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "  • npx cap open android   (opens Android Studio)"
echo "  • Confirm minSdkVersion 24 in android/app/build.gradle"
echo "  • Place android/app/google-services.json (Firebase) if not already there"
echo "  • Set up a Twilio FCM Push Credential (Console → Voice → Push Credentials)"
echo "    and add its SID to DO env as TWILIO_PUSH_CREDENTIAL_SID_ANDROID"
echo "  • Build/Run on a device; for Play Store: Build → Generate Signed Bundle (.aab)"
echo ""
echo "See ANDROID_BUILD_GUIDE.md for the full walkthrough."
