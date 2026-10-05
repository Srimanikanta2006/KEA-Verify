# KEA Verify — Exam Centre Face Verification App

React Native (Expo SDK 57) rebuild of the approved Stitch designs for the
**Karnataka Examinations Authority** invigilator app. The `*.html` files at the
repo root are the finalized mockups kept as reference — the screens are
recreated 1:1 in `src/app/` and wired to real functionality.

**Stack:** Expo + TypeScript + Expo Router · Firebase (Auth/Firestore, free Spark tier) · Google oAuth via `@react-native-google-signin/google-signin` · AsyncStorage.

## Feature roadmap (build order)

| # | Feature | Status |
|---|---------|--------|
| 1 | Auth + backend foundation (Google oAuth, verifier→centre session, seeded demo data) | ✅ this drop |
| 2 | Real QR scan → candidate lookup (expo-camera, offline-first lookup) | ✅ this drop |
| 3 | Geofencing (device location vs centre, gate before lookup + demo override) | ✅ this drop |
| 4 | Centre-mismatch + duplicate-scan logic (local-first scanLogs, audit every outcome) | ✅ this drop |
| 5 | Face detection + matching (on-device ML Kit + MobileFaceNet, manual-confirm fallback) | ✅ this drop |
| 6 | Offline queue + sync resilience (NetInfo auto-sync, Offline Cache Ready UI) | ✅ this drop |

## Run it

```bash
npm install
npm run typecheck   # verify the tree compiles
npm start           # press a → android emulator, or scan QR with Expo Go*
```

\* Google Sign-In needs a **development build** (`npx expo run:android`) because
it includes native code; Demo Mode works everywhere, including Expo Go.

## Firebase setup (free, no credit card)

1. Create a project at console.firebase.google.com (Spark plan).
2. **Authentication → Sign-in method → enable Google.** Add your Android SHA-1
   (from `cd android && ./gradlew signingReport` after `npx expo prebuild`, or
   `npx expo credentials` via EAS) plus the support email.
3. **Firestore → Create database** (production mode).
4. Copy `.env.example` → `.env` and paste the web API config values
   (Project settings → General → SDK setup).
5. Google Cloud console → APIs & Services → Credentials → copy the
   **Web client ID** (auto-created by Firebase for Google Sign-In) into
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
6. Paste the verifiers' Google emails into `scripts/seed-firebase.mjs`
   (search for `authProviderId`) — the app looks verifiers up by email.
7. Publish `firestore.rules` in Firestore → Rules, replacing the admin UID
   placeholder with your own (create any email/password test user in Auth and
   copy its UID).
8. Seed: either set `FIREBASE_SERVICE_ACCOUNT` to the service-account JSON, or
   create a password test user and run:
   ```bash
   FIREBASE_API_KEY=... FIREBASE_AUTH_EMAIL=you@test.com \
   FIREBASE_AUTH_PASSWORD=... npm run seed
   ```
   → writes 3 centres, 3 verifiers, 24 candidates.

## Scaling story (Feature 6 talking points for judges)

- **Stateless clients, thin backend**: all matching runs on-device (TFLite + ML Kit); the backend is just Firestore reads/writes. No GPU servers, no per-scan API calls. Cost stays at $0 and latency stays flat under load.
- **Offline-first writes**: scans append to a local queue (AsyncStorage mirror) and sync idempotently (`scanLogs/{clientScanId}` — client UUIDs make retries safe). Wifi dropping mid-demo loses nothing.
- **Indexed lookups**: candidate lookup hits one indexed doc (`candidates/{candidateId}`); duplicate checks query `scanLogs` by `candidateId` equality — add a composite index `(candidateId, timestamp)` at scale. Statewide load = 5 lakh scans/day is trivial doc-GET traffic for Firestore's model.
- **Read-path sharding by centre**: every verifier only ever reads their centre's roster (`candidates` where `allottedCentreId == X`), so hot reads are naturally partitioned per centre; a statewide write storm on result day touches disjoint documents.
- **Next step if deployed**: move duplicate-check + attendance writes behind a Cloud Function (transactional per candidate) once budgets allow; the client contract stays identical.

## Demo Mode (no keys needed)

On the login screen tap **Continue in Demo Mode** — signs in as the first
bundled verifier (AN0081) with the full offline roster. Good for UI checks and
emulator screenshots; real auth requires the Firebase setup above.

## Project layout

```
src/app/          Expo Router screens (login, dashboard, scan, manual verification)
src/components/   Reusable UI components (SyncBanner, FoundCard, etc.)
src/config/       Firebase configuration
src/constants/    Theme, colors, and typography tokens
src/context/      AuthProvider (persisted invigilator session)
src/services/     Core domain services (auth, camera, geofence, roster, scanLogs)
src/types/        TypeScript data models
scripts/          Build, seed, and QR test utilities
mockups/          Approved static Stitch mockups (preserved for visual reference)
test-qr-codes.html Test sheet with static pre-rendered candidate QR codes
firestore.rules   Security rules for Cloud Firestore
```
