# CLAUDE.md — Session Context for BirdApp

This file gives Claude sessions everything needed to resume work without re-reading the codebase from scratch.

---

## What This App Is

BirdApp is a social React Native mobile app (Expo SDK 54, TypeScript, Expo Router v3) for bird watchers. Users log sightings by tapping an animated cedar waxwing button, recording audio (BirdNET AI identification), or taking photos. Sightings appear on a map, feed into leaderboards, and build each user's Life List and Big Year count. Firebase is the backend.

---

## Key Files

| File | Purpose |
|---|---|
| `components/ui/BirdAvatar.tsx` | All bird definitions (`BIRD_STYLES` array) + `BirdAvatar` component. **Single source of truth for bird appearance.** |
| `components/home/WaxwingButton.tsx` | Animated home-screen bird button. **Duplicates BirdAvatar rendering logic** — must be kept in sync manually when bird masks or styles change. |
| `store/themeStore.ts` | Zustand store. `useColors()` returns the active bird's `ThemePalette`. **All screens must use `useColors()` — no static `Colors` imports.** |
| `app/(tabs)/map.tsx` | Map screen with custom pin rendering and clustering. |
| `lib/firestore/sightings.ts` | Sighting read/write + real-time subscription. |
| `lib/birdnet.ts` | Cornell BirdNET API client. |
| `bird-preview.html` | Open in browser to see all 11 birds as SVGs without rebuilding the app. |
| `plugins/withReleaseSigning.js` | Points release builds at the upload keystore. Re-applied on every prebuild. |
| `plugins/withManifestCleanup.js` | Strips Play-flagged permissions that libraries merge back in. **Must stay first in the plugins array.** |
| `lib/legal.ts` | Privacy policy + deletion notice text. `npm run legal:html` regenerates `docs/`. |
| `lib/firestore/account.ts` | Account deletion, client-side under the user's own credentials. |
| `docs/RELEASE.md` | Play submission runbook: signing, keystore, Maps key, store listing, dev/prod Firebase split. |
| `scripts/lib/adminApp.mjs` | Every seed script's Firebase entry point. Refuses to run against the prod project. |
| `.env.development` / `.env.production` | Per-environment Firebase config, auto-selected by Expo's env loader. |

---

## Bird Design Directives

These rules come directly from the user and must be followed:

1. **No beaks.** Birds are iconographic circles — no beak protrusions.
2. **No text labels** on the birds themselves.
3. **SVG-first for complex shapes.** The current `BirdAvatar.tsx` still uses React Native Views. The user has approved migrating to `react-native-svg` for features that need curves (especially the Inca Tern mustache). Use `Svg`, `Path`, `Circle`, `Ellipse`, `G`, `ClipPath`, `Defs` from `react-native-svg`.
4. **Inca Tern mustache must be curly** — handlebar/J-curve shape. View-pill approaches were explicitly rejected. The correct shape uses SVG cubic Bezier paths. Reference `bird-preview.html` for the approved curve geometry.
5. **Iconographic, not realistic.** Clean solid colors, bold shapes, recognizable silhouette.

### Current Bird Roster (11 species)

| ID | Label | Key features |
|---|---|---|
| `waxwing` | Cedar Waxwing | Brown, gray wings, red tips, black band mask, yellow belly, crest |
| `cardinal` | Northern Cardinal | Red, tall pointy crest, black bib |
| `bluejay` | Blue Jay | Vivid blue body/crest, white face, large round eyes with white ring, gray throat patch, light blue beak, dark navy wing shadow |
| `robin` | American Robin | Dark gray, orange belly, black band |
| `goldfinch` | American Goldfinch | Yellow, black cap, black wings + white tips |
| `incatern` | Inca Tern | Charcoal, white tips, **curly white mustache plumes (Bezier)**, red eye |
| `hornedgrebe` | Horned Grebe | Rufous, black cap, **gold ear tufts**, red eye |
| `paintedbunting` | Painted Bunting | Green body, blue-violet cap, red belly |
| `titmouse` | Tufted Titmouse | Blue-gray, pointy crest, black forehead cap |
| `hummingbird` | Ruby-Throat Hummingbird | Green, red gorget bib, white belly |
| `owl` | Great Horned Owl | Brown, ear tufts, **two forward-facing golden eyes** |
| `housesparrow` | House Sparrow | Warm brown, gray crown, streaked wings |
| `scissortailedflycatcher` | Scissor-tailed Flycatcher | Light gray body, steel-blue chest, salmon flanks, long forked tail |
| `goldfinch` | American Goldfinch | Golden-yellow body, black cap, black wings, large dark eyes |
| `blackcappedchickadee` | Black-capped Chickadee | Dark navy cap/back, white cheek patches, warm buff flanks |

---

## Testing

See `TESTING.md` for the full rationale. Short version:

- `npm test` — unit + api + config (fast, no emulator)
- `npm run test:rules` — permission matrix against the Firebase emulator; **needs
  `JAVA_HOME` set to Android Studio's JBR, from PowerShell not Git Bash**
- `npm run audit:firebase` — print every Firestore/Storage path the app touches

**Security rules are server-side, so mocked tests cannot catch rule bugs.** Any
permission work must be verified with `npm run test:rules`, never with mocks.

`firestore.rules`, `storage.rules` and `firestore.indexes.json` now live in the
repo and are the source of truth. **There are two Firebase projects** —
`birdapp-dev-birdleague` (dev) and `birding-app-1a446` (prod) — and a rules
change must be deployed to both, they are never synced automatically:
```
npx firebase-tools deploy --project dev  --only firestore:rules,firestore:indexes,storage
npx firebase-tools deploy --project prod --only firestore:rules,firestore:indexes,storage
```
See "Dev vs. production Firebase" in `docs/RELEASE.md` for how the app picks
which project to talk to, and why seed scripts (`scripts/*.mjs`) physically
refuse to run against prod.

`__tests__/config/coverage.test.ts` fails if a collection is added without a
rule, or a composite query without an index. That guard is the reason permission
bugs stop being found one screen at a time — don't delete it.

### Rules are not filters

Firestore permits a query only if its constraints *prove* every match is
readable; it does not silently drop unreadable docs. Any query over `sightings`
that is not scoped to the caller's own uid **must** include
`where('isPublic','==',true)` or it fails wholesale.

## Architecture Decisions

### Theme System
- Each `BirdStyle` has a `theme: ThemePalette` embedded in it.
- `themeStore` stores `birdStyleId`; `useColors()` looks up the active bird's palette.
- `useTheme()` returns the full `ThemePalette`; `useColors()` returns the same but is the standard hook to use in components.

### react-native-maps must stay on the Expo-pinned version

Expo SDK 54 pins `react-native-maps` to **1.20.1**. The project was on 1.27.2,
and the entire native map silently failed to initialise: `onMapReady` never
fired, `onRegionChangeComplete` never fired, the camera never moved off
`initialRegion`, and **no markers rendered at all** — including stock markers
with no custom children. The JS half looked completely healthy (component
mounted, sightings fetched, clusters computed at correct coordinates), which
made it look like a marker-rendering bug for a long time.

**Run `npx expo install --check` before debugging any native module.** A version
skew is far cheaper to rule out than reading application code. Do not let a
caret range (`^1.27.2`) drift this dependency; keep it pinned exactly.

Changing it requires a full native rebuild (`npx expo run:android`) — Fast
Refresh cannot apply native module changes.

### Map Pins (Android-safe)
- Custom marker views: `anchor={{ x: 0.5, y: 1 }}` (pin tail at bottom-center).
- `tracksViewChanges` is `true` until the thumbnail image fires `onLoad`, then `false`. This prevents the Android "pin froze before image loaded" bug.
- **Do NOT use `overflow: 'hidden'` on Marker child containers** — this breaks Android rendering. Apply `borderRadius` directly to `<Image>`.

### Clustering
- `clusterSightings()` in `map.tsx` uses degree-based thresholds derived from both `latDelta` and `lngDelta` of the visible region.
- Wrapped in `useMemo` keyed on `[displayed, region]`.

### Firebase Data Model (summary)
```
users/{uid}           — profile, totalSightings, totalSpecies, yearSpecies, statesVisited
sightings/{id}        — userId, commonName, location GeoPoint, timestamp, isPublic
friendships/{uid}/connections/{friendId}  — status, since
```

### Dev/Prod project split

Two separate Firebase projects — **never a shared database**:

| | Project | Config | Used by |
|---|---|---|---|
| dev | `birdapp-dev-birdleague` | `.env.development` | `expo start`, `expo run:android` (debug), seed scripts |
| prod | `birding-app-1a446` | `.env.production` | release builds — real users |

`lib/firebase.ts` picks its config from `EXPO_PUBLIC_FIREBASE_*` env vars;
Expo's env loader selects the file by `NODE_ENV`, which Gradle sets
automatically for release builds. No manual toggle, but **restart Metro** after
editing either `.env.*` file. Full mechanics and the rules-deploy workflow are
in `docs/RELEASE.md` under "Dev vs. production Firebase".

Seed scripts (`scripts/*.mjs`) all call `initAdminApp()`
(`scripts/lib/adminApp.mjs`) instead of a bare `initializeApp()` — it refuses to
run if `GOOGLE_APPLICATION_CREDENTIALS` resolves to the prod project. This is
the exact mistake that seeded fake data into prod before the split existed;
don't bypass it by calling `initializeApp()` directly in a new script.

---

## Pending Work

1. **Migrate `BirdAvatar.tsx` to `react-native-svg`** — enables true Bezier curves. `react-native-svg` may or may not be installed; check with `npx expo install react-native-svg` (idempotent).
2. **Inca Tern mustache** — current View-based 3-segment approach is a placeholder. Replace with SVG cubic Bezier. Reference the path in `bird-preview.html`.
3. **`user/[id].tsx`** — Public profile view (partially scaffolded).
4. **`sighting/[id].tsx`** — Sighting detail view.
5. **Notifications** — `notifications/{uid}/items` collection, friend request flow.

---

## User Preferences

- Terse responses, no trailing summaries.
- Don't add error handling for impossible scenarios.
- No comments unless the WHY is non-obvious.
- All screens use `useColors()` — never import `Colors` statically.
- When adding a new `maskStyle` to `BirdAvatar`, also update `WaxwingButton.tsx` to handle it.
- Use `bird-preview.html` for visual review before triggering an EAS build.

---

## Build

Local builds only. `JAVA_HOME` must point at Android Studio's JBR, and Gradle
has to be run from **PowerShell** — Git Bash does not have java on PATH:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
npm run build:aab     # Play upload artifact (.aab)
npm run build:apk     # sideloadable release APK
npx expo run:android  # debug build onto a device
```

`android/local.properties` holds `sdk.dir` and is regenerated by prebuild. Write
it with **forward slashes** (`C:/Users/.../Android/Sdk`). It is a Java
.properties file, so single backslashes are parsed as escape sequences and the
SDK path silently becomes garbage — which surfaces four layers down as
`java.io.IOException: Invalid file path` while configuring
`:expo-modules-core`, never as anything mentioning the SDK.

EAS project ID: `5d5c3329-7e8d-492f-8642-61914a65ba06`
Owner: `eajacobson67`
Android package: `com.birdapp.app`

## Play Store Release

Full runbook in `docs/RELEASE.md`. The parts that bite:

- **Signing is applied by a config plugin**, not by editing `android/`, because
  prebuild rewrites that folder. Credentials live in
  `~/.gradle/gradle.properties`; the keystore sits at
  `C:\Users\eajac\keystores\birdapp-upload.keystore` and is the only key that
  can ever ship an update to this listing. `bundleRelease` fails loudly rather
  than falling back to the debug key.
- **Config plugin mods run in REVERSE registration order** — a mod listed last
  runs first. `withManifestCleanup` must be listed first so it runs *after*
  expo-media-library, which otherwise re-adds `requestLegacyExternalStorage`
  immediately after it is removed.
- **Bump `android.versionCode`** in `app.config.js` before every upload.
- **Restrict the Maps key to the Play App Signing SHA-1**, not the upload SHA-1.
  Play re-signs the AAB, so the installed app runs under a different
  certificate; get the fingerprint from Play Console after the first upload or
  the map renders as a blank grey tile in production with no error.
- Privacy policy and account-deletion pages are generated from `lib/legal.ts`
  into `docs/`. Play requires both at a public URL, and a coverage test fails if
  the generated copies go stale.
