# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is **CoatingPro360 / JobFlow** — a multi-tenant SaaS platform for coating/epoxy contractors. It consists of three sub-projects:

| Directory | Purpose |
|---|---|
| `CP360 Backend/` | Node.js/Express REST API (main backend) |
| `frontend-app/JobFlow-dashboard-main/src/` | React CRM dashboard (leads, calendar, settings) |
| `frontend-estimator/src/estimator/` | React embeddable estimator widget |

---

## Backend (`CP360 Backend/`)

### Running Locally

```bash
cd "CP360 Backend"
npm install
npm run dev        # nodemon server.js — hot reload on port 3001
npm start          # node server.js — production start
```

Requires `.env.local` (development) or `.env.production`. Copy from `env.example`.

Key env vars:
- `DATABASE_URL` — Railway PostgreSQL connection string
- `JWT_SECRET` — 64-byte hex secret
- `ENCRYPTION_KEY` — 32-byte hex secret for GHL API key encryption
- `DEV_AUTH_BYPASS=true` — skips JWT in dev; send `x-company-id` header to set company context
- `KEY_MONITOR_ENABLED=true` — enables hourly cron key monitoring with email alerts
- `CORS_ORIGINS` — comma-separated allowed origins

### Architecture

**Entry point:** `server.js` — loads dotenv first (`.env.local` vs `.env.production` based on `NODE_ENV`), registers all routes, initializes Firebase Admin SDK, starts monitoring cron.

**Route layout:**
- Public (no auth): `/auth`, `/webhooks/ghl`, `/api/webhooks`, `/estimator/preview`, `/api/estimator-pricing`
- Protected (JWT): `/leads`, `/users`, `/companies`, `/ghl`, `/estimator`, `/api/push`, `/api/drive`

**Auth flow** (`middleware/auth.js`):
- `authenticateToken` — validates JWT, loads fresh user from DB on every request
- `DEV_AUTH_BYPASS=true` sets `req.user` as `role: "master"` with optional `x-company-id` header
- `requireRole(...roles)` — role gate middleware
- `requireSameCompany` — blocks cross-company access; master role bypasses

**Roles:** `master` (platform owner), `admin` (company admin), `user` (standard)

**Database** (`config/database.js`): PostgreSQL via `pg` pool. Use `pool.connect()` for transactions, `query()` helper for simple queries. SSL enabled with `rejectUnauthorized: false` for Railway.

**GHL (GoHighLevel) sync:**
- `mappers/dbTghlMapper.js` — canonical DB→GHL field/tag/event mapping. Edit this file when GHL field keys or status tags change.
- `controllers/webhookController.js` — receives GHL contact webhooks; matches leads by `ghl_contact_id` → phone → email; 2-minute cooldown prevents echo loops (`sync_source` + `ghl_last_synced` fields)
- `controllers/calendarWebhookController.js` — handles calendar event sync
- `routes/ghlWebhook.js` and `routes/webhookRoutes.js` — two separate GHL webhook entry points

**Estimator engine** (`estimator/calculateEstimate.js`): Pure function. Takes `config` (DB pricing row), `input` (project/sqft/quality), and optional `pricingByFinish` map. Returns price ranges. The `defaultEstimatorConfig.js` provides fallback values.

**Firebase** (`config/firebase.js`): Firebase Admin SDK for push notifications. Requires `firebase-service-account.json` at backend root.

**Google Drive** (`controllers/googleDrive.js`): Uses service account from `keys/google-drive.json`.

**Monitoring** (`monitoring/`): `scheduler.js` runs `keyMonitor.js` hourly + daily via `node-cron`. Controlled by `KEY_MONITOR_ENABLED` env var.

### Key Patterns

- **Multi-tenancy**: All lead/user queries must scope by `company_id`. The `ghl_location_id` on the `companies` table is how inbound webhooks resolve which tenant they belong to.
- **GHL status tags**: Tags are **additive only** from this system. GHL automations are responsible for removing conflicting tags. The canonical list is in `mappers/dbTghlMapper.js` → `STATUS_TAGS`.
- **`lead_source` write-once**: Once set on a lead, `lead_source` is not overwritten by GHL webhooks (intentional business rule in `webhookController.js`).

---

## Frontend Dashboard (`frontend-app/JobFlow-dashboard-main/src/`)

React 18 SPA. Key context providers:
- `AuthContext.jsx` — JWT auth state
- `CompanyContext.jsx` — active company for master admin switching

Key screens: `LeadsHome.jsx`, `LeadDetails.jsx`, `CalendarView.jsx`, `CompanyManagement.jsx`, `UserManagement.jsx`, `SettingsModal.jsx`

---

## Frontend Estimator (`frontend-estimator/`)

Standalone embeddable React widget. Entry: `src/main.jsx` → `src/estimator/`. Uses Vite + Tailwind.

```bash
cd frontend-estimator
npm install
npm run dev      # port 5173
npm run build
```

---

## Deployment

Backend deploys to **Railway** (auto-deploy on git push). Build: `npm install`. Start: `npm start`.

The `package.json` at the repo root belongs to `frontend-estimator` (not the backend).
