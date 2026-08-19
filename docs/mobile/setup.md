# VelShop Mobile — Setup Guide

## Prerequisites

- Android Studio Ladybug (2024.2.1) or later
- JDK 17
- Android SDK 35
- Kotlin 2.0.21

## Getting Started

1. Open `mobile/velshop/` in Android Studio

2. Sync Gradle (Android Studio will prompt automatically)

3. Configure the backend URL in `app/build.gradle.kts`:
   ```kotlin
   buildConfigField("String", "API_BASE_URL", "\"https://velnox.com\"")
   ```

4. Run on emulator or device:
   ```
   ./gradlew assembleDebug
   ```

## Build Commands

```bash
# Debug build
cd mobile/velshop
./gradlew assembleDebug

# Release build (requires signing config)
./gradlew assembleRelease

# Run unit tests
./gradlew test

# Clean build
./gradlew clean assembleDebug
```

## Architecture Requirements

- **Min SDK**: 26 (Android 8.0 Oreo)
- **Target SDK**: 35
- **Compile SDK**: 35
- **Kotlin**: 2.0.21
- **Compose BOM**: 2024.12.01

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `API_BASE_URL` | Backend API base URL | Yes |
| `CONVEX_URL` | Convex deployment URL | Optional |

No secrets are embedded in the mobile app.

## Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| Compose BOM | 2024.12.01 | UI framework |
| Material 3 | BOM-managed | Design system |
| Navigation Compose | 2.8.5 | Screen navigation |
| Retrofit | 2.11.0 | HTTP client |
| OkHttp | 4.12.0 | Network layer |
| Coil | 2.7.0 | Image loading |
| KotlinX Serialization | 1.7.3 | JSON parsing |
| EncryptedSharedPreferences | 1.1.0-alpha06 | Secure token storage |
