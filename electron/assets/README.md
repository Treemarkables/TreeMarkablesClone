# electron/assets

Drop the app icons here before packaging:

- `icon.icns` — macOS (1024×1024 source)
- `icon.ico` — Windows (256×256 multi-res)
- `icon.png` — Linux / window icon (512×512)

Generate all three from the existing brand mark (the same artwork used for the iOS
AppIcon). A quick way:

    # from a 1024×1024 PNG
    npx electron-icon-builder --input=icon-1024.png --output=.

`entitlements.mac.plist` is already here (camera/mic + JIT for the hardened runtime).
