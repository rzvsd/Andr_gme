# 📱 android/

Capacitor-generated Android project. This folder is created by running `npx cap add android` and should not be manually edited (except for specific Android config tweaks).

## Setup

```bash
# From project root:
npm install @capacitor/core @capacitor/cli
npx cap init "Bullet Dodge Arena" com.bulletdodge.arena
npx cap add android
npm run build         # Build the web app
npx cap sync          # Copy web build to Android
npx cap open android  # Open in Android Studio
```

## Android-Specific Config

- **Min SDK:** 24 (Android 7.0)
- **Target SDK:** 34 (Android 14)
- **Orientation:** Landscape locked
- **Fullscreen:** Yes (immersive mode, hide status bar)
- **WebView Performance:** Hardware acceleration enabled

## Files You May Edit

- `app/src/main/AndroidManifest.xml` — permissions, orientation, fullscreen
- `app/src/main/res/values/styles.xml` — splash screen theme
- `app/src/main/res/mipmap-*` — app icon (all densities)
