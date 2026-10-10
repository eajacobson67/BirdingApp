# Releasing Bird League to Google Play

## Signing

Release builds are signed by `plugins/withReleaseSigning.js`, which rewrites
`android/app/build.gradle` on every prebuild. It reads four Gradle properties
from `~/.gradle/gradle.properties` — outside the repo, so the password is never
committed:

```properties
BIRDAPP_UPLOAD_STORE_FILE=C:/Users/eajac/keystores/birdapp-upload.keystore
BIRDAPP_UPLOAD_STORE_PASSWORD=...
BIRDAPP_UPLOAD_KEY_ALIAS=birdapp
BIRDAPP_UPLOAD_KEY_PASSWORD=...
```

If those are absent, `bundleRelease` fails with an explicit error rather than
quietly producing a debug-signed artifact that Play will reject after upload.

**Back up the keystore.** `C:\Users\eajac\keystores\birdapp-upload.keystore` is
the only key that can push an update to this listing. Losing it means asking
Google to reset the upload key, and losing it before the first upload means
starting the listing over. Copy it somewhere durable and off this machine.

Upload certificate fingerprint:

```
SHA1:   9D:7A:CA:F2:E0:E9:0E:34:11:C8:DF:4C:EB:0B:DD:2A:ED:CE:64:48
SHA256: 87:E7:C6:62:B8:32:28:D8:46:AE:0B:D1:EB:00:6F:40:A8:0F:7F:D4:B0:7E:BE:5B:08:20:58:C2:DE:12:77:6B
```

## Building

```bash
npm run build:aab   # android/app/build/outputs/bundle/release/app-release.aab
```

Play takes the `.aab`. `npm run build:apk` produces an installable APK for
sideloading a release build onto a device; Play does not accept it.

Bump `android.versionCode` in `app.config.js` before every upload — Play rejects
a reused one, and the value is baked in at prebuild time.

## Dev vs. production Firebase

Two separate Firebase projects exist — there is no shared database between
local development and real users:

| | Project | Used by |
|---|---|---|
| dev | `birdapp-dev-birdleague` | `npx expo start`, `npx expo run:android` (debug), seed scripts |
| prod | `birding-app-1a446` | `./gradlew bundleRelease` / `assembleRelease` — real users |

This is not a manual toggle. `lib/firebase.ts` reads its config from
`EXPO_PUBLIC_FIREBASE_*` env vars, and Expo's built-in env-file loading picks
`.env.development` or `.env.production` based on `NODE_ENV`, which the Gradle
release task sets to `production` automatically via its `--dev false` flag —
the same mechanism `expo start` uses to set `development`. Restart Metro after
touching either `.env.*` file; it's only read at startup, and `__DEV__` builds
log which project they connected to on launch.

**Rules and indexes must be deployed to both projects separately.** They are
never in sync automatically:

```bash
npx firebase-tools deploy --project dev  --only firestore:rules,firestore:indexes,storage
npx firebase-tools deploy --project prod --only firestore:rules,firestore:indexes,storage
```

`.firebaserc` aliases `dev` → `birdapp-dev-birdleague` and `prod`/`default` →
`birding-app-1a446`, so a bare `firebase deploy` (no `--project`) still targets
prod exactly as before this split existed.

**Seed scripts (`scripts/*.mjs`) write with firebase-admin, which bypasses every
security rule.** They all route through `initAdminApp()`
(`scripts/lib/adminApp.mjs`), which reads the project ID out of whatever key
`GOOGLE_APPLICATION_CREDENTIALS` points at and refuses to run if it resolves to
`birding-app-1a446`. Point it at the dev key instead:

```
GOOGLE_APPLICATION_CREDENTIALS=C:\Users\eajac\firebase-keys\birdapp-dev-adminsdk.json
```

That key is scoped to the dev project only and isn't sensitive the way the
release keystore is — if it's ever lost, regenerate it with:

```bash
gcloud iam service-accounts keys create <path> \
  --iam-account=firebase-adminsdk-fbsvc@birdapp-dev-birdleague.iam.gserviceaccount.com \
  --project=birdapp-dev-birdleague
```

## Google Maps key

The key is injected from `GOOGLE_MAPS_API_KEY` in `.env` at prebuild time and
lands in the manifest. Restrict it in Google Cloud Console to the Android
package `com.birdapp.app`.

**Play App Signing re-signs the app**, so the certificate the installed app runs
under is not the upload certificate above. After the first upload, copy the app
signing SHA-1 from Play Console → Test and release → App integrity, and add it
to the key restriction alongside the upload SHA-1. Skip this and the map renders
as a blank grey tile in production with no error anywhere.

## Store listing requirements

- **Privacy policy URL** — host `docs/` (GitHub Pages: Settings → Pages → main
  branch, `/docs`) and give Play `https://<user>.github.io/<repo>/privacy.html`.
- **Account deletion URL** — `https://<user>.github.io/<repo>/delete-account.html`.
  Play requires a web URL in addition to the in-app flow.
- **Data safety form** — declare: location (precise), photos, audio, email
  address, name, app activity. All are collected, none is shared with third
  parties, and all can be deleted by the user. `docs/privacy.html` is the
  authoritative wording; keep the form consistent with it.
- **Content rating** questionnaire and a target audience of 13+.

Both hosted pages are generated from `lib/legal.ts`. Edit that file and run
`npm run legal:html`; a coverage test fails if `docs/` has gone stale.

## Closed testing

A **personal** Play developer account created after November 2023 must run a
closed test with at least 12 testers opted in for 14 continuous days before
production access is granted. Organisation accounts are exempt. Start this early
— it is usually the longest pole in the whole release.

## Before uploading

```bash
npm test           # unit + api + config, includes the submission-blocker guards
npm run test:rules # permission matrix against the emulator
```

Account deletion is a destructive path that runs entirely under the user's own
credentials, so `npm run test:rules` is the only thing that proves it can
complete. Mocked tests cannot — the rules never execute.
