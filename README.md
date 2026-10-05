# KEA Verify — Exam Centre Candidate Verification System

[![Live Web App](https://img.shields.io/badge/Live%20App-kea--verify.web.app-success?style=for-the-badge&logo=firebase)](https://kea-verify.web.app)
[![Expo SDK 52/57](https://img.shields.io/badge/Expo%20SDK-57-blue?style=for-the-badge&logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.86-61DAFB?style=for-the-badge&logo=react)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)

---

## 1. Executive Summary

**KEA Verify** is an enterprise-grade, offline-first exam centre candidate authentication system designed for the **Karnataka Examinations Authority (KEA)**. Operating on both mobile smartphones and web browsers, it serves as an on-ground digital invigilator tool to authenticate candidates entering examination halls, effectively preventing:

- **Impersonation & Fake Hall Tickets**: Cryptographically structured QR codes matched against live photo and facial recognition models.
- **Centre-Jumping**: Enforces strict GPS geofencing against the candidate's allotted venue.
- **Duplicate Attendance Fraud**: Immediate anti-passback detection flags any hall ticket already scanned earlier.
- **Network Outage Failures**: An offline-first local queue records verifications instantly and synchronizes idempotently to Cloud Firestore once network is restored.

**Live Production URL:** [https://kea-verify.web.app](https://kea-verify.web.app)

---

## 2. Technology Stack

| Layer | Technologies Used | Purpose |
|---|---|---|
| **Core Framework** | React Native (Expo SDK 52/57), TypeScript (Strict) | Single cross-platform codebase supporting Android, iOS, and Web. |
| **Routing & Navigation** | Expo Router (v4, file-based routing) | Deep-linking, nested layouts, modals, and screen transitions. |
| **Backend & Cloud** | Google Firebase (Auth, Firestore, Hosting) | Secure verifier authentication, real-time database, security rules, and global hosting. |
| **Camera & Vision** | `expo-camera`, Web `MediaStreamTrack` API, `jsQR`, BarcodeDetector API | Full HD 1080p stream, continuous hardware autofocus, tap-to-focus, and optical/digital zoom. |
| **Location & Geofencing** | `expo-location`, Haversine Distance Algorithm | Geographic boundary enforcement verifying scans occur inside the designated centre radius (<500m). |
| **Biometrics & AI** | On-device MobileFaceNet embedding logic, Expo Image Manipulator | Live face capture vs reference photo matching with cosine similarity scoring. |
| **Offline Storage & Sync** | `@react-native-async-storage/async-storage`, NetInfo | Offline roster cache, local write queuing, and resilient background cloud synchronization. |
| **Design & Typography** | Vanilla StyleSheet tokens, Material Icons (@expo/vector-icons) | High-contrast design system adhering to official KEA examination aesthetics. |

---

## 3. System Architecture & Workflow

```
   [ Candidate Hall Ticket QR ]
                │
                ▼
   [ 1. High-Definition Scanner ] ──► (1080p HD, Continuous Autofocus, 1.5x/2x Zoom)
                │
                ▼
   [ 2. GPS Geofence Check ] ─────► Verifies invigilator device is within 500m of centre
                │
                ▼
   [ 3. Policy & Roster Check ] ──► Validates allotted centre; checks duplicate scan logs
                │
                ▼
   [ 4. Biometric Face Match ] ───► Compares live photo to reference; opens review if needed
                │
                ▼
   [ 5. Local Offline Queue ] ────► Commits scan locally to AsyncStorage (instant response)
                │
                ▼
   [ 6. Cloud Synchronization ] ──► Background sync to Firestore; auto-updates live dashboard
```

---

## 4. Key Feature Matrix

| # | Feature | Status | Description |
|---|---|:---:|---|
| **1** | **Authentication & Sessions** | ✅ Active | Google OAuth for authorized invigilator emails + One-Tap Demo Mode. |
| **2** | **High-Definition QR Scanner** | ✅ Active | Custom web stream enhancer boosting resolution to 1080p, continuous autofocus, tap-to-focus, and zoom controls. |
| **3** | **Geofencing Gating** | ✅ Active | Device GPS coordinates validated against centre centroid with demo override switch. |
| **4** | **Centre & Duplicate Policy** | ✅ Active | Real-time audit checks detect centre mismatches and prevent duplicate check-ins. |
| **5** | **Face Match & Manual Review** | ✅ Active | Live photo comparison with manual approval/rejection modal requiring documented justification. |
| **6** | **Offline Queue & Background Sync**| ✅ Active | Local-first write pipeline with network resilience auto-draining scans to Cloud Firestore. |

---

## 5. Quick Start & Local Setup

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation & Run

```bash
# 1. Clone the repository
git clone https://github.com/Srimanikanta2006/KEA-Verify.git
cd KEA-Verify

# 2. Install dependencies
npm install

# 3. Verify contracts and types
npm run check

# 4. Start local development
npm start
# Press 'w' for Web, 'a' for Android, or 'i' for iOS
```

---

## 6. Environment & Firebase Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Fill in the values from your Firebase Project Console (**Project Settings → General → Web apps**):
   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your_oauth_web_client_id
   ```
3. Deploy Firestore security rules:
   ```bash
   npx firebase deploy --only firestore:rules
   ```
4. Optional: Seed sample test data (3 centres, 3 verifiers, 24 candidates):
   ```bash
   npm run seed
   ```

---

## 7. Scaling & Resilience Story (Architecture Highlights)

- **Stateless Clients, Zero GPU Cost**: Biometric matching and QR decoding run directly on the client device. The backend operates purely as a standard Firestore document store without requiring expensive GPU inference servers.
- **Offline-First Resilience**: All scans append to a local queue (`AsyncStorage`) with unique UUIDs (`clientScanId`). Even if Wi-Fi or cellular networks drop entirely mid-exam, no data is lost.
- **Natural Centre Sharding**: Each invigilator only queries candidates allotted to their specific centre ID (`candidates where allottedCentreId == X`). Statewide examination traffic (500,000+ candidates) partitions cleanly across centres.
- **Immutable Security**: Firestore rules enforce append-only scan logs. Once a verification log is created, it cannot be edited, overwritten, or deleted by any user.

---

## 8. Project Structure

```
├── assets/                    # App icons, splash screens, and tflite face models
├── dist/                      # Compiled production web bundle (git ignored)
├── mockups/                   # Approved static Stitch HTML design mockups (reference)
│   ├── README.md              # Documentation of visual mockups
│   ├── index.html             # Redirect to login mockup
│   ├── login.html             # Login screen mockup
│   ├── dashboard.html         # Dashboard mockup
│   ├── manual_verification.html # Verification review mockup
│   ├── qr_scan.html           # QR scan mockup
│   ├── records_history.html   # Records history mockup
│   └── verification_complete.html # Completion mockup
├── scripts/
│   ├── check-contract.mjs     # Model contract validation
│   ├── generate-static-qr.cjs # Static base64 QR generator
│   ├── make-test-qr-codes.mjs # QR test data maker
│   ├── post-build.cjs         # Font injection & static asset generator
│   ├── qr-decode-selftest.mjs # QR decode selftest runner
│   ├── qr-selftest.entry.ts   # QR test entrypoint
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
│   └── services/              # Domain logic (cameraFocusEnhancer, geofence, roster, etc.)
├── test-qr-codes.html         # Test sheet with pre-rendered base64 QR codes
├── firebase.json              # Firebase Hosting configuration & security headers
├── firestore.rules            # Security rules for Firestore collections
└── .env.example               # Template environment configuration
```

---

## 9. Testing & Quality Assurance

```bash
# Run contract verification & TypeScript compilation checks
npm run check

# Run QR multi-pass degradation selftests (wrinkles, stains, low contrast)
npm run test:qr

# Build and export production web bundle
npm run build
```

---

## 10. License

Developed for the **Karnataka Examinations Authority (KEA)** entrance examination verification protocol. Proprietary & confidential.
