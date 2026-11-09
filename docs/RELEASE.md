# Release build and signing

Agents build the unsigned release APK. Signing is the owner's job and happens only on the
owner's machine. No keystore, password or `keystore.properties` is ever committed
(`.gitignore` already excludes `*.jks`, `*.keystore` and `keystore.properties`).

## 1. Build the unsigned release APK

```bash
npm ci
npm run build
npx cap sync android
cd android
./gradlew assembleRelease
```

On Windows without Java on the PATH, point Gradle at Android Studio's bundled JDK first:

```bash
export JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
```

Output: `android/app/build/outputs/apk/release/app-release-unsigned.apk` (target under 15 MB).
Note: if `android/keystore.properties` exists (step 2), the same command produces a signed
`app-release.apk` instead.

## 2. Create a keystore once (owner only)

```bash
keytool -genkeypair -v -keystore ~/bullet-dodge-arena.jks -alias bda -keyalg RSA -keysize 2048 -validity 10000
```

Keep the `.jks` file and both passwords somewhere safe outside the repo. Losing them means
you can never update an installed app with the same signature.

## 3. Tell Gradle where the keystore is (owner only)

Create `android/keystore.properties` (ignored by git) with these four keys:

```properties
storeFile=C:/Users/you/bullet-dodge-arena.jks
storePassword=...
keyAlias=bda
keyPassword=...
```

`android/app/build.gradle` reads this file when it exists and signs the release build type.
When the file is missing, the build stays unsigned, so CI and agents never need secrets.

## 4. Sign an already built unsigned APK (alternative)

```bash
"$ANDROID_HOME/build-tools/35.0.0/zipalign" -v -p 4 app-release-unsigned.apk app-release-aligned.apk
"$ANDROID_HOME/build-tools/35.0.0/apksigner" sign --ks ~/bullet-dodge-arena.jks --ks-key-alias bda --out app-release.apk app-release-aligned.apk
"$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --print-certs app-release.apk
```

## 5. Install on a phone

Enable Developer options and USB debugging on the phone, connect it, then:

```bash
adb devices
adb install -r app-release.apk
```

Or copy the APK to the phone and open it; allow "install unknown apps" for the file manager.

## 6. Version bump

`versionCode` and `versionName` live in `android/app/build.gradle` under `defaultConfig`.
Raise `versionCode` by one for every APK you hand out; Android refuses to install a lower code
over a higher one.
