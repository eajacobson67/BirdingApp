# BirdApp

A social mobile app for birders — log sightings, identify species by sound or photo, compete on leaderboards, and share discoveries with friends.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React Native + Expo SDK 54 |
| Language | TypeScript |
| Navigation | Expo Router v3 (file-based) |
| Backend | Firebase (Firestore + Auth + Storage) |
| Maps | react-native-maps |
| Camera | expo-camera, expo-image-picker |
| Audio | expo-av + BirdNET API (Cornell Lab) |
| Location | expo-location |
| State | Zustand |
| Animation | React Native Animated API |

## Features

- **Log sightings** — tap the animated cedar waxwing button, pick a species from location-aware suggestions, or record audio/photo for AI identification
- **BirdNET audio ID** — record a bird call, get ranked species results with confidence scores
- **Interactive map** — public sightings as custom bird-photo pins with clustering; friends-only toggle
- **Leaderboards** — Global, Nearby (50 mi geospatial), and Friends tabs
- **Life List & Big Year** — auto-updated species lists; Big Year resets each January 1
- **Badges** — milestone badges (first bird, 10 species, 50 species, etc.)
- **Bird avatars** — 11 species choices for your profile icon (see bird-preview.html)
- **Social** — friend requests, friend activity feed, friend map filter

## Setup

1. **Clone and install**
   ```bash
   cd BirdApp
   npm install
   ```

2. **Firebase** — Create a project at console.firebase.google.com, then add credentials to `lib/firebase.ts`. Required services: Authentication (email/password), Firestore, Storage.

3. **Google Maps (Android)** — API key is in `app.json` under `android.config.googleMaps.apiKey`. Keep this key restricted to the app's package ID in production.

4. **BirdNET API** — Register for a Cornell Lab API key and add it to `lib/birdnet.ts`.

5. **Run**
   ```bash
   npx expo start
   ```

## Build (EAS)

```bash
npx eas build --profile preview --platform android   # APK for testing
npx eas build --profile production --platform all     # App Store / Play Store
```

## Color Palette (Cedar Waxwing)

| Token | Hex | Usage |
|---|---|---|
| Brown | `#A67C52` | Primary surfaces |
| Blue-gray | `#8BA3B0` | Secondary text, icons |
| Yellow | `#E8C84A` | Accent, CTA |
| Charcoal | `#1C1C1E` | Mask, headers |
| Red | `#B5423A` | Wing tips, danger |
| Cream | `#F5EFE0` | Backgrounds |

## Project Structure

```
app/
  (auth)/login.tsx, signup.tsx      — Auth screens
  (tabs)/index.tsx                  — Home (WaxwingButton)
  (tabs)/map.tsx                    — Sightings map
  (tabs)/leaderboard.tsx            — Rankings
  (tabs)/profile.tsx                — Your profile
  log/select.tsx, audio.tsx,
      camera.tsx                    — Logging flows
  sighting/[id].tsx                 — Sighting detail
  user/[id].tsx                     — Other user profile
components/
  home/WaxwingButton.tsx            — Animated home button
  ui/BirdAvatar.tsx                 — All 11 avatar birds + BIRD_STYLES
  ui/StatCard.tsx, BadgeIcon.tsx
lib/
  firebase.ts                       — Firebase init
  firestore/sightings.ts,
            users.ts, friends.ts
  birdnet.ts, location.ts,
  birdImages.ts, seedData.ts
store/
  authStore.ts, themeStore.ts
```

## Bird Avatars

Open `bird-preview.html` in any browser to see all 11 species rendered as SVGs before rebuilding the app.
