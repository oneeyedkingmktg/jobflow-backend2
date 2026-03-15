# JobFlow / CoatingPro360 — Native Mobile App Project
## Claude Code Context File

---

## Project Overview

**Product:** JobFlow (branded as CoatingPro360) — a multi-tenant SaaS CRM for epoxy floor coating contractors.
**Goal:** Wrap the existing React web app in a native iOS/Android app using Capacitor, with push notifications as the primary differentiator.
**Business Driver:** Key client (RFC Floors) asked "is there an app?" and has a referral ready that depends on having a native app.
**Target:** TestFlight deployment for RFC within 2 weeks of Apple Developer approval.

---

## Project Structure

**Git Root:** `D:\AGF Files\Local - CoatingPro360_CLEAN\backend`

| Folder | Full Path | Notes |
|--------|-----------|-------|
| Backend | `D:\AGF Files\Local - CoatingPro360_CLEAN\backend\CP360 Backend` | No src subfolder. Run: `npm start` (port 3001) |
| App Frontend | `D:\AGF Files\Local - CoatingPro360_CLEAN\backend\frontend-app\JobFlow-dashboard-main` | Has `src` folder. Run: `npm run dev` (port 5173) |
| Estimator Frontend | `D:\AGF Files\Local - CoatingPro360_CLEAN\backend\frontend-estimator` | Separate frontend |

---

## Tech Stack

- **Frontend:** React 18 + Vite, deployed on Vercel
- **Backend:** Node.js + Express, deployed on Render
- **Database:** PostgreSQL on Railway
- **CRM Integration:** GoHighLevel API v2
- **Mobile Wrapper:** Capacitor (iOS + Android)
- **Push Notifications:** Firebase Cloud Messaging (FCM)
- **Apple Distribution:** TestFlight (via Apple Developer Program - $99/year personal account)

---

## Development Workflow Rules

**Troy is not a coder. Always follow these rules:**

1. **CLI-First:** Provide exact grep/find commands before touching code
2. **One Step at a Time:** Give ONE action per response. Troy replies "n" to proceed
3. **Complete Code Blocks:** Always show the FULL exact code — never partial snippets
4. **Show Before/After:** Show the current code first, then the replacement
5. **File Paths First:** Always state the filename and full path before any code edit
6. **No Explanations:** Skip the "why" — just give the fix
7. **Final Steps Together:** Bundle save/restart/push/test with the last code edit

---

## Mobile App — Capacitor Setup (Completed Steps)

Capacitor was initialized inside the App Frontend folder:

```
Package ID: com.epoxyprofit.coatingpro360
App Name: CoatingPro360
Web Asset Directory: dist
Config File: capacitor.config.json (created in frontend-app/JobFlow-dashboard-main)
```

Firebase service account key downloaded and placed at:
```
D:\AGF Files\Local - CoatingPro360_CLEAN\backend\CP360 Backend\firebase-service-account.json
```

> ⚠️ This file is SECRET. It is (or should be) in `.gitignore`. Never commit it.

---

## Apple Developer Program

- **Account Type:** Personal ($99/year) — enrolled and waiting for approval
- **Distribution Method:** TestFlight (up to 10,000 testers, 90-day build expiry)
- **Future Plan:** Migrate to Business Apple Developer account once EIN arrives
- **APNs:** Apple Push Notification certificate must be created in Apple Developer portal, downloaded as `.p8` file, and uploaded to Firebase once account is approved

---

## Apple App Store Review — Demo Account Strategy

The Apple reviewer will log in using the **ProShield Floors** account:
- ProShield Floors has a real GHL connection but contains only dummy/test data
- This gives the reviewer a fully functional app experience including live push notification triggers
- No harmful automations can fire since all data is test data
- This is cleaner than building a disconnected demo account with no GHL

---

## Push Notifications — 6 Types

All triggered by GoHighLevel automations firing webhooks to the backend.

| # | Type | Trigger | Default |
|---|------|---------|---------|
| 1 | **New Lead** | Lead received via GHL webhook (contact created) | ✅ ON |
| 2 | **New Estimator Lead** | Lead submitted via JobFlow estimator form | ✅ ON |
| 3 | **Appointment Reminder** | GHL workflow fires X hours before appointment | ✅ ON |
| 4 | **Job Marked Sold** | Opportunity stage moved to Won in GHL | ✅ ON |
| 5 | **Install Reminder** | GHL workflow fires X hours before install appointment | ✅ ON |
| 6 | **New Message** | Incoming SMS or contact message received in GHL | ✅ ON |

### How Notifications Are Delivered
- GHL automation → webhook hits backend → backend checks company notification preferences → if enabled, sends push via Firebase → device receives notification
- If the contractor doesn't tap the notification live, it stacks in the **iOS Notification Center** (swipe down from top of screen) — standard iOS behavior, no extra code required
- Tapping a missed notification opens the app

### GHL Automations Required (one per notification type)
Each notification type needs a GoHighLevel workflow built:
- New Lead → fires on `contact.create`
- New Estimator Lead → fires when estimator form webhook hits backend (already exists), backend triggers push
- Appointment Reminder → GHL wait step until X hours before appointment, then webhook
- Job Marked Sold → fires when opportunity stage = Won
- Install Reminder → GHL wait step until X hours before install, then webhook
- New Message → fires on inbound message event

---

## Notification Settings — Location in App

**Settings → Notifications** (inside the mobile app only)

- 6 checkboxes, one per notification type — all default ON
- "Test Notification" button so contractors can verify push is working
- This settings section is **only visible inside the native app**
- Web browser users see a message: *"Install the mobile app to receive push notifications"*

---

## Database — New Tables Required

```sql
-- Device tokens for push notifications
CREATE TABLE device_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  company_id INTEGER REFERENCES companies(id),
  device_token TEXT NOT NULL UNIQUE,
  platform VARCHAR(10), -- 'ios' or 'android'
  created_at TIMESTAMP DEFAULT NOW(),
  last_used TIMESTAMP DEFAULT NOW()
);

-- Company-level notification preferences
CREATE TABLE notification_preferences (
  company_id INTEGER PRIMARY KEY REFERENCES companies(id),
  notify_new_lead BOOLEAN DEFAULT true,
  notify_new_estimator_lead BOOLEAN DEFAULT true,
  notify_appointment_reminder BOOLEAN DEFAULT true,
  notify_job_sold BOOLEAN DEFAULT true,
  notify_install_reminder BOOLEAN DEFAULT true,
  notify_new_message BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Backend — New Endpoints Required

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/register-device` | Save FCM device token for a user/company |
| GET | `/api/notification-preferences` | Get company's current notification preferences |
| PUT | `/api/notification-preferences` | Update notification preferences |
| POST | `/api/test-notification` | Send a test push (authenticated) |

### Push Notification Service
A shared service file: `CP360 Backend/services/pushNotificationService.js`

Responsibilities:
- Accept `companyId` + notification object
- Look up device tokens for that company
- Check notification preferences before sending
- Send via Firebase Admin SDK (`sendMulticast`)
- Clean up stale/invalid tokens on failure

### Firebase Config File
`CP360 Backend/config/firebase.js`
- Initialize Firebase Admin SDK using environment variables (not the raw JSON file in production)
- Export `getMessaging()` for use in push service

### Environment Variables Needed (Backend)
```
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=        ← newline-escaped (\n)
```
These come from the `firebase-service-account.json` file. Extract values and store in Render environment variables — do NOT deploy the JSON file itself.

---

## Frontend — New Features Required

### 1. Platform Detection Utility
File: `src/utils/platform.js`
```javascript
export const isNativeApp = () => {
  return window.Capacitor?.isNative === true;
};
```

### 2. Conditional UI Rendering
- **In native app:** Show desktop/full layout (different from mobile Safari)
- **In mobile browser (Safari):** Show standard mobile web layout
- This satisfies Apple's App Store requirement that the app experience must differ from the website

### 3. Push Notification Registration (App Startup)
- On app load, if `isNativeApp()` → request push permission → get FCM token → POST to `/api/register-device`

### 4. Notification Settings Page
- Only rendered when `isNativeApp()` returns true
- Shows 6 checkboxes (one per notification type)
- Shows "Test Notification" button
- Web users see: *"Install the mobile app to receive push notifications"*

### 5. Biometric Auth (Face ID / Touch ID)
- Persistent login using Capacitor's biometric plugin
- Eliminates need to re-enter credentials on each app open

---

## Development Testing Strategy

| Environment | Use For | Push Notifications? |
|-------------|---------|---------------------|
| Browser (`npm run dev`) | All UI/logic development | ❌ No |
| iOS Simulator (Xcode) | Layout, navigation, native feel | ❌ No |
| Real iOS Device | Final push notification testing | ✅ Yes (once APNs set up) |
| Android Emulator | Android layout testing | ✅ Yes (Firebase works in emulator) |

---

## What's Done vs. What Still Needs to Be Built

### ✅ Completed
- Capacitor initialized (`com.epoxyprofit.coatingpro360`)
- Firebase project created, service account key downloaded
- Apple Developer Program enrolled (personal $99 account, pending approval)

### 🔲 Still Needs to Be Built
- Firebase config file + push notification service on backend
- Device token registration endpoint
- Notification preferences table (run migration) + API endpoints
- 6 GHL automations (one per notification type)
- Frontend: platform detection utility
- Frontend: push notification registration on app startup
- Frontend: Settings → Notifications page with 6 checkboxes + test button
- Frontend: conditional UI (desktop layout in app vs. mobile layout in browser)
- Biometric auth (Face ID / Touch ID)
- APNs `.p8` certificate (once Apple approves account) uploaded to Firebase
- First TestFlight build
- ProShield Floors account verified as Apple reviewer login

---

## Development Timeline

| Phase | Tasks |
|-------|-------|
| **Now (Apple pending)** | Firebase backend config, push service, device token endpoint, notification preferences API |
| **Day 3–5** | Frontend platform detection, push registration on startup, Settings → Notifications UI |
| **Day 6–7** | Build 6 GHL automations, test full webhook → push flow in browser |
| **Day 8–10 (Apple approved)** | Connect APNs `.p8` cert to Firebase, iOS platform build, first TestFlight deploy |
| **Day 11–14** | Real device testing, invite RFC to TestFlight, iterate on feedback |

---

## Key Decisions

| # | Decision |
|---|----------|
| 1 | Apple reviewer uses ProShield Floors account (real GHL, dummy data) |
| 2 | Company-level notification preferences for MVP (not user-level) |
| 3 | Desktop layout served inside native app to differ from Safari |
| 4 | Notification settings page hidden from web browser users |
| 5 | Personal Apple Developer account to start; migrate to business when EIN arrives |
| 6 | RFC not being charged extra — treated as a growth partnership |
| 7 | "Test Notification" button in settings so contractors can verify push works |
| 8 | Missed notifications stack in iOS Notification Center automatically |
| 9 | All 6 notification types default ON |
| 10 | JobFlow is source of truth; GHL is secondary CRM backend |

---

## Core Principles

- **JobFlow is source of truth** — GHL is secondary CRM backend
- **One appointment and one install event per lead** — event IDs are immutable once stored
- **Mobile-first design** — contractors access from job sites
- **Surgical code changes** — incremental improvements, never rewrites
- **Field naming:** always handle both `snake_case` and `camelCase` when reading company data (backend returns snake_case, frontend API auto-converts to camelCase)
