# VelShop Android APK Build Guide

> Last Updated: August 19, 2026

## Build Status: BLOCKED

**The VelShop Android project does not yet exist.**

The repository currently contains only web applications (VelShop Web, VelSeller, VelCenter).
Phase 3 — VelShop Mobile App has not been started.

---

## What's Needed to Build an APK

### 1. Android Project Must Be Created First

The following files must exist at `mobile/velshop/`:

```
mobile/velshop/
├── settings.gradle.kts
├── build.gradle.kts
├── gradle/
│   └── wrapper/
│       ├── gradle-wrapper.jar
│       └── gradle-wrapper.properties
├── gradlew
├── gradlew.bat
└── app/
    ├── build.gradle.kts
    └── src/
        └── main/
            ├── AndroidManifest.xml
            └── java/com/velnox/velshop/
                └── MainActivity.kt
```

### 2. Build Environment Requirements

| Component | Required Version |
|-----------|-----------------|
| JDK | 17+ (OpenJDK or Oracle) |
| Android SDK | API 34+ |
| Build Tools | 34.0.0+ |
| Gradle | 8.2+ (via wrapper) |
| AGP (Android Gradle Plugin) | 8.2+ |
| Kotlin | 1.9+ |
| compileSdk | 34 |
| minSdk | 24 (Android 7.0) |
| targetSdk | 34 |

### 3. Build Commands

Once the Android project exists:

```bash
# Navigate to the Android project
cd mobile/velshop/

# Build debug APK
./gradlew assembleDebug

# APK output path
# app/build/outputs/apk/debug/app-debug.apk
```

### 4. Production Build

```bash
# Build release APK (requires signing key)
./gradlew assembleRelease

# Or build AAB for Play Store
./gradlew bundleRelease
```

---

## Environment Setup (for new developers)

### Install JDK 17+

```bash
# macOS
brew install openjdk@17

# Ubuntu/Debian
sudo apt install openjdk-17-jdk

# Verify
java -version
```

### Install Android SDK

```bash
# Install Android command-line tools
# https://developer.android.com/studio#command-line-tools-only

# Set environment variables
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Install required SDK components
sdkmanager "platforms;android-34" "build-tools;34.0.0"
```

### Generate Signing Key (for release builds)

```bash
keytool -genkey -v -keystore velshop-release.keystore \
  -alias velshop -keyalg RSA -keysize 2048 -validity 10000
```

---

## Application Configuration

| Property | Value |
|----------|-------|
| Application ID | `com.velnox.velshop` |
| Version Name | `0.1.0` |
| Version Code | `1` |
| Min SDK | 24 |
| Target SDK | 34 |
| Compile SDK | 34 |
