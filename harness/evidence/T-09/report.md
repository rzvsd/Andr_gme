# T-09 verification report (build half of A-09)

Verifier: independent agent, 2026-10-30. No gradle run; checked the builder's log and artifact as found.

| Check | How run | Result | Evidence |
|---|---|---|---|
| A-09 / `assembleRelease` log ends BUILD SUCCESSFUL, EXIT=0 | `tail`/`grep` on assembleRelease.log (line 162: EXIT=0, 1x BUILD SUCCESSFUL) | pass | harness/evidence/T-09/verify-apk.log |
| A-09 / `app-release-unsigned.apk` exists, size under 15 MB | `ls -l`, `stat -c %s` = 3,725,967 bytes (< 15,728,640) | pass | harness/evidence/T-09/verify-apk.log |
| A-09 / APK bundles web build, is unsigned | `unzip -l`: 456 files, 1x `assets/public/index.html`, 0 `META-INF/*.RSA|DSA|EC` | pass | harness/evidence/T-09/verify-apk.log |
| T-09 / build.gradle signs only when `keystore.properties` exists | `grep`: `keystorePropertiesFile.exists()` guards load (L7), `signingConfigs.release` (L29) and `signingConfig signingConfigs.release` (L41-42) | pass | harness/evidence/T-09/verify-signing-config.log |
| T-09 / `.gitignore` excludes keystores; no secrets file in tree | `.gitignore` L14-16: `*.jks`, `*.keystore`, `keystore.properties`; `git status --short` empty; `ls android/keystore.properties` -> No such file; `git check-ignore` matches | pass | harness/evidence/T-09/verify-signing-config.log |
| T-09 / `docs/RELEASE.md` covers build, keystore, properties, apksigner, adb, version bump | `grep`: `assembleRelease` L14, `keytool -genkeypair` L30, 4 keys L41-44, `apksigner sign/verify` L54-55, `adb install -r` L64, `versionCode` L71-72 | pass | harness/evidence/T-09/verify-docs.log |
| T-09 / no secret values in docs | `grep "storePassword="` -> only `storePassword=...` (L42); `keyPassword=...` (L44); no `-storepass`/`--ks-pass` literals | pass | harness/evidence/T-09/verify-docs.log |
| T-09 / README links to RELEASE.md | `grep RELEASE.md README.md` -> L25 | pass | harness/evidence/T-09/verify-docs.log |

Notes
- Phone half of A-09 (sign, install, 10 min play) is T-11 and out of scope here; A-09 stays `open` until then.
- Evidence files: assembleRelease.log (builder), verify-apk.log, verify-signing-config.log, verify-docs.log (verifier).
