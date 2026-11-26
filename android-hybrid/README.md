# CineCraft AI Studio — Separate Hybrid Android Project (Capacitor)

This directory (`android-hybrid/`) is a **completely separate Capacitor Android wrapper**.
The original website (`../src`, `../server.ts`, `../package.json`, `../vite.config.ts`) remains **100% untouched**.

## What Is Included
- **Automatic Local Web Packaging (`scripts/package-web.mjs`)**: Builds `../dist` and bundles it offline inside `android-hybrid/www/`, injecting the silent WebView bridge without modifying any original UI or React code.
- **Zero-UI Cloud API Bridge (`scripts/android-bridge.js`)**: Automatically routes relative `/api/*` calls (`TTS`, `key health`, `script adaptation`) to your deployed HTTPS backend (`ANDROID_CLOUD_API_BASE`) so API keys stay secure on the backend.
- **Native Streaming Downloads (`MainActivity.kt`)**: Intercepts exported `.mp4`, `.mp3`, `.wav`, `.png`, `.jpg`, `.zip`, and `.json` blob downloads in 512 KB low-RAM chunks and saves directly to `Downloads/CineCraft/`.
- **Low-Memory & Media Optimization**: Sets `android:largeHeap="true"`, `android:hardwareAccelerated="true"`, hardware WebView layer, `2048m` Gradle heap, and Android 9–15 runtime permissions (`RECORD_AUDIO`, `READ_MEDIA_VIDEO/IMAGES/AUDIO`).
- **Production-Ready Native AdMob**: Pre-wired Google Mobile Ads SDK (`banner` + post-export `interstitial`) using safe test IDs in `android/app/src/main/res/values/strings.xml` (swap with your live AdMob IDs before Play Store release).

## Build APK Locally (Requires JDK 17+ & Android SDK)
```bash
cd android-hybrid
npm install
npm run android:apk
```
Generated debug APKs will be copied automatically to:
- `APK_DOWNLOAD/app-debug.apk`
- `.build-outputs/app-debug.apk`
