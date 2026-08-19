# VelShop APK Installation Guide

> Last Updated: August 19, 2026

## Status: NOT AVAILABLE

The VelShop Android APK has not been built yet because the Android project does not exist.

---

## When the APK is Available

### Option 1: Direct Download (after GitHub Release)

1. Go to: https://github.com/EnJirad/velnox-mvp/releases
2. Download `velshop-debug.apk` from the latest release
3. Transfer the APK to your Android device

### Option 2: ADB Install (for developers)

```bash
# Verify device is connected
adb devices

# Install APK
adb install -r velshop-debug.apk

# Launch app
adb shell am start -n com.velnox.velshop/.MainActivity
```

### Option 3: Direct APK install on device

1. Copy `velshop-debug.apk` to your Android device
2. Open the file manager on your device
3. Tap the APK file
4. If prompted, enable "Install from unknown sources"
5. Tap "Install"

---

## Requirements

- Android 7.0 (API 24) or newer
- At least 100 MB free storage
- Internet connection (for backend API)

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "App not installed" | Check minimum SDK version (Android 7.0+) |
| "Parse error" | APK may be corrupted, re-download |
| Blocked by Play Protect | Tap "Install anyway" |
| Network error on launch | Verify backend API URL is accessible |
