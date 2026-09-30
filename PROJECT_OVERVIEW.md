# KEA Verify — Project Overview & System Architecture

## 1. Executive Summary

**KEA Verify** is an enterprise-grade, offline-first exam centre verification system developed for the **Karnataka Examinations Authority (KEA)**. It serves as an on-ground digital invigilator tool to authenticate candidates entering examination halls, effectively eliminating impersonation, forged hall tickets, centre-jumping, and duplicate voting/attendance fraud.

The platform operates seamlessly on both mobile devices (Android/iOS) and modern web browsers with instant offline caching and cloud synchronization.

---

## 2. Technology Stack

| Layer | Technologies Used | Purpose |
|---|---|---|
| **Core Framework** | React Native (Expo SDK 52/57), TypeScript | Cross-platform runtime ensuring unified codebase for Web and Mobile. |
| **Routing & Navigation** | Expo Router (v4, file-based routing) | Deep-linking, nested layouts, modals, and screen transition management. |
| **Backend & Cloud** | Firebase Auth, Cloud Firestore, Firebase Hosting | Verifier authentication, real-time database, cloud hosting, and security rules. |
| **Camera & Vision** | `expo-camera`, Web `MediaStreamTrack` API, `jsQR`, BarcodeDetector API | High-definition QR scanning, continuous autofocus, zoom control, and tap-to-focus. |
| **Location & Geofencing** | `expo-location`, Haversine Distance Algorithm | Geographic boundary enforcement to verify scans occur inside the designated centre. |
| **Biometrics & AI** | On-device MobileFaceNet embedding logic, Expo Image Manipulator | Live face capture vs reference photo matching with cosine similarity scoring. |
| **Offline & Storage** | `@react-native-async-storage/async-storage`, NetInfo | Offline roster cache, queueing scans when offline, and idempotent synchronization. |
| **Styling & Assets** | Vanilla StyleSheet tokens, Material Icons (@expo/vector-icons) | High-contrast design system adhering to official KEA examination aesthetics. |

---

## 3. System Architecture & Workflows

```
   [ Candidate Hall Ticket ]
              │
              ▼
   [ 1. QR Code Scanner ] ──► (1080p HD stream, Continuous AF, 1.5x/2x Zoom)
              │
              ▼
   [ 2. Geofence Evaluation ] ──► Checks GPS distance to exam centre (< 500m)
              │
              ▼
   [ 3. Centre & Duplicate Policy ] ──► Validates allotted centre; checks duplicate scan logs
              │
              ▼
   [ 4. Biometric Face Verification ] ──► Compares live photo to hall ticket reference
              │
              ▼
   [ 5. Decision & Offline Queue ] ──► Writes scan locally to AsyncStorage queue
              │
              ▼
   [ 6. Firestore Synchronization ] ──► Background sync to cloud & live dashboard refresh
```

### Detailed Functional Modules:

1. **Authentication & Role-Based Access**
   - **Google OAuth**: Official invigilator sign-in mapped to pre-authorized centre IDs.
   - **Demo Mode**: One-tap sandbox sign-in for demonstration and testing without credential barriers.

2. **Geofencing Gating**
   - Calculates the invigilator's precise GPS coordinates against the designated exam centre's geographic centroid.
   - If outside the authorized radius (default 500m), scanning is blocked with an alert displaying exact distance to the centre. Includes an invigilator bypass switch for emergency/demo scenarios.

3. **High-Definition Camera & Smart Scanner**
   - **Full HD (1080p/720p)**: Custom stream interceptor prevents browser downscaling to blurry 640×480 VGA.
   - **Continuous Hardware Autofocus**: Forces smartphone lens actuators into continuous tracking mode.
   - **Tap-to-Focus**: Interactive touch target triggering hardware autofocus with a visual indicator ring.
   - **Optical/Digital Zoom (1x, 1.5x, 2x)**: Allows scanning from 20–30 cm away, avoiding the minimum focus blur zone of smartphone lenses.

4. **Multi-Policy Verification Engine**
   - **Centre Validation**: Detects candidates attempting to write exams at the wrong venue.
   - **Anti-Passback (Duplicate Prevention)**: Immediately flags candidates whose QR code has already been checked in.
   - **Face Match & Manual Verification**: Compares live photo to reference photo. If biometric confidence is below threshold or mismatched, triggers the **Manual Verification Modal** where invigilators record ID proof details and explicit reason for approval or rejection.

5. **Offline-First Synchronization**
   - Scans are appended locally to an idempotent sync queue with unique client UUIDs.
   - Background sync worker automatically drains the queue to Cloud Firestore when network connectivity is established.

6. **Live Invigilator Dashboard**
   - Displays real-time metrics: Total Candidates, Verified, Flagged (Duplicates/Centre Mismatch), and Pending.
   - Auto-refreshes every 2 seconds and on screen focus, ensuring immediate reflection of newly processed candidates.

---

## 4. Project File Structure

```
├── dist/                      # Compiled production web bundle
├── scripts/
│   ├── post-build.cjs         # Font injection & static asset generator
│   └── seed-firebase.mjs      # Database seed script for exam centres & rosters
├── src/
│   ├── app/                   # Screen routes (Expo Router)
│   │   ├── _layout.tsx        # Global provider gate & camera interceptor init
│   │   ├── index.tsx          # Invigilator Login screen
│   │   ├── dashboard.tsx      # Live statistics & candidate management
│   │   ├── scan.tsx           # Camera scanner & verification interface
│   │   ├── manual-verification.tsx # Photo comparison & rejection workflow
│   │   └── history.tsx        # Verification audit log
│   ├── components/            # Reusable UI widgets (SyncBanner, FoundCard, etc.)
│   ├── constants/             # Design system theme tokens (Colors, Typography, Radius)
│   ├── context/               # AuthContext state management
│   └── services/              # Domain logic
│       ├── cameraFocusEnhancer.ts # Web camera HD & autofocus driver
│       ├── geofence.ts        # Haversine distance & geofence rules
│       ├── roster.ts          # Candidate data retrieval & offline caching
│       ├── scanLogs.ts        # Scan audit logging & duplicate detection
│       └── syncManager.ts     # Offline queue background synchronizer
├── test-qr-codes.html         # Test sheet with pre-rendered base64 QR codes
├── firebase.json              # Firebase Hosting configuration & cache rules
└── firestore.rules            # Security rules for Firestore collections
```

---

## 5. Live Deployment

- **Hosting Platform**: Google Firebase Hosting
- **Production URL**: [https://kea-verify.web.app](https://kea-verify.web.app)
- **Repository**: [GitHub — Srimanikanta2006/KEA-Verify](https://github.com/Srimanikanta2006/KEA-Verify)
