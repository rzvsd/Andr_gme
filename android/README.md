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

- **Min SDK:** 23 (Android 6.0); **Target SDK:** 35 (see `variables.gradle`)
- **Orientation:** `sensorLandscape` (both landscape directions, never portrait)
- **Fullscreen:** immersive. `MainActivity` hides status and navigation bars with
  `WindowInsetsControllerCompat` (swipe shows them briefly) and draws into the
  display cutout (`values-v27/styles.xml`).
- **Hardware back key:** `MainActivity.onBackPressed` dispatches a synthetic
  `Escape` keydown/keyup on `window` instead of finishing the activity. The game
  treats Escape as "arm exit, press again to quit to menu" during a match.
- **Icon and splash:** dark arena colour `#05060a` (also `backgroundColor` in
  `capacitor.config.json`). Launcher icons, adaptive foreground and all `splash.png`
  files are generated PNGs (two crossing bullet slugs, P1 red / P2 blue).

## Build a debug APK

```bash
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug      # JAVA_HOME = Android Studio's jbr if java is missing
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.andr.gme/.MainActivity
```

## Files You May Edit

- `app/src/main/java/com/andr/gme/MainActivity.java` — fullscreen, back key
- `app/src/main/AndroidManifest.xml` — permissions, orientation
- `app/src/main/res/values*/styles.xml` — splash and cutout theme
- `app/src/main/res/mipmap-*`, `drawable*/splash.png` — icon and splash (all densities)
