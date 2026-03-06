# CP360 Communications — Master Reference Document
**Status: Authoritative. All decisions locked. Do not deviate without explicit instruction.**

---

## Project Overview

Build a full communications layer inside CP360/JobFlow so contractors can read messages, reply to customers, listen to call recordings, view transcripts, and make outbound calls — all without leaving the app.

GoHighLevel (GHL) remains the source of truth for all message data. CP360 is the display and notification layer only. CP360 stores no message content in its own database.

---

## Tech Stack

| Layer | Technology | Location |
|-------|-----------|----------|
| Frontend | React/Vite | `D:\AGF Files\Local - CoatingPro360_CLEAN\backend\frontend-app\JobFlow-dashboard-main` |
| Backend | Node.js/Express | `D:\AGF Files\Local - CoatingPro360_CLEAN\backend\CP360 Backend` |
| Database | PostgreSQL on Railway | — |
| CRM | GoHighLevel API v2 | GHL location ID per company |
| Mobile | Capacitor (iOS/Android) | Wraps the React app |
| Push Notifications | Firebase | Already configured |
| Calling | Twilio Voice SDK | To be added |

**Backend runs on port 3001. Frontend runs on port 5173.**

---

## Absolute Rules (Never Break These)

1. **GHL is source of truth for all messages.** CP360 never stores message content, conversation history, or contact communication data in its own database.
2. **One change at a time.** Provide complete file contents, never partial snippets.
3. **Always state the full file path before any code block.**
4. **Surgical edits only.** Show the exact current code, then the replacement.
5. **Field naming:** Always handle both `snake_case` and `camelCase` using nullish coalescing — backend returns `snake_case`, frontend API auto-converts to `camelCase`.
6. **Event IDs are immutable** once stored in the database. Never regenerate or overwrite.
7. **Mobile-first design.** All new UI must work on a phone screen first.
8. **Do not modify existing lead screen behavior.** The `ConversationModal.jsx` in lead detail continues to work exactly as it does today throughout this entire build.

---

## What Already Exists (Do Not Rebuild)

| Item | File Path | Notes |
|------|-----------|-------|
| Conversation display component | `src/leadModalParts/ConversationModal.jsx` | Will be refactored in Phase 2 to extract shared `MessageList.jsx` |
| Conversations API endpoint | `CP360 Backend/routes/leads.js` — `GET /leads/:id/conversations` | Reuse as-is |
| GHL conversation fetch | `CP360 Backend/controllers/ghlAPI.js` — `getConversationMessages()` | Reuse as-is |
| Message bubble rendering | Inside `ConversationModal.jsx` | SMS, Email, Call, Workflow types with inbound left / outbound right |
| Pagination (load more) | Inside `ConversationModal.jsx` | Reuse logic |
| Webhook receiver | `CP360 Backend/controllers/webhookController.js` | Extend, do not replace |
| Firebase push infrastructure | Already wired in backend | Extend for message events |

---

## Architecture Decisions (Locked)

| Decision | Resolution |
|----------|-----------|
| Message storage | GHL only. CP360 stores nothing. |
| Thread navigation | Full-page conversation list. Clicking contact opens modal overlay on top. Does not navigate away from list. |
| Reply channels | All 4 built together: SMS, Email, Facebook Messenger, Instagram DM |
| Polling interval | 60 seconds while thread is open |
| Polling replacement | Webhook sync (Phase 5B) replaces polling after it's stable |
| GHL WebView approach | **Rejected.** GHL web app is desktop-only, not mobile responsive. WebView injection of CSS does not produce a usable mobile UI. |
| Softphone approach | Twilio Voice SDK (WebRTC). Outbound calls only. |
| Inbound calls | Not part of this build. LC app / forwarding handles inbound. No change. |
| Call logging to GHL | Post-call via GHL Log External Call API. Includes recording URL and duration. |
| Screen wake during calls | Capacitor KeepAwake plugin. Activates on call start, releases on hang up. |
| Navigation during calls | Supported. Call state in global React context. Call bar persists across all screens. |
| Call bar controls | Mute, Speaker toggle (earpiece / speaker / Bluetooth auto-route), Hang Up |
| Unread badge source | GHL exposes unread count per conversation. Pull from GHL, display on list rows and nav item. |

---

## GHL API Endpoints Used

### Already in use
```
GET /conversations/messages                          — fetch conversation history
```

### To be added
```
GET  /conversations/search                           — list all conversations for a location
POST /conversations/messages                         — send SMS / Email / FB / IG reply
GET  /conversations/messages/:messageId/locations/:locationId/recording   — call recording (returns audio bytes, NOT a URL — must proxy through CP360 backend)
GET  /conversations/locations/:locationId/messages/:messageId/transcription — call transcript
POST /calls/log                                      — log external call record after Twilio call ends
```

### Recording Proxy Note
GHL recording endpoint returns raw audio bytes with Bearer auth — it cannot be used directly in an HTML `<audio>` tag. The CP360 backend must proxy the request: fetch from GHL with auth header, stream bytes back to frontend. Frontend uses the CP360 proxy URL in the audio player.

---

## Phase Breakdown

---

### PHASE 1 — Conversations List Screen + Nav Item
**Dependency:** None. Start here.
**Estimated sessions:** 2–3

#### What to build

**New file:** `src/pages/MessagesPage.jsx`
- Full-page layout matching existing app page style
- Fetches all conversations for the current company from GHL via new backend endpoint
- Renders a scrollable list of contacts
- Each row shows: contact name, phone number, last message preview (text) or event label (for calls), timestamp, unread badge (red dot or count) if unread > 0
- Clicking a row opens the thread overlay (Phase 2 — leave as a stub/console.log for now)
- Loading state while conversations fetch
- Empty state if no conversations exist

**New backend endpoint:** `GET /api/messages/conversations`
- File: `CP360 Backend/routes/messages.js` (new file)
- Controller: `CP360 Backend/controllers/messagesController.js` (new file)
- Calls GHL `GET /conversations/search` with the company's GHL location ID
- Returns array of conversations with: `id`, `contactId`, `contactName`, `phone`, `lastMessageBody`, `lastMessageDate`, `unreadCount`, `lastMessageType`
- Register route in `CP360 Backend/server.js`

**Nav item:**
- File: wherever the main navigation is defined (confirm path before editing)
- Add "Messages" nav item with speech bubble icon
- Show unread badge on nav item when any conversation has unread > 0
- Unread count for nav badge = sum of all unread counts across all conversations

#### Acceptance criteria
- Messages page loads and shows a list of real conversations from GHL
- Each row shows correct contact name, message preview, and timestamp
- Unread badge appears on rows and nav item when applicable
- Clicking a row logs the conversation ID to console (thread is Phase 2)
- Page works on mobile screen width

---

### PHASE 2 — Thread Overlay + MessageList Refactor
**Dependency:** Phase 1 complete
**Estimated sessions:** 2–3

#### What to build

**New file:** `src/messages/MessageList.jsx`
- Extracted from `ConversationModal.jsx`
- Accepts `messages` array as prop
- Renders all message types: SMS, Email, Call (card), Workflow
- Inbound messages aligned left, outbound right
- Call cards show: direction icon, duration, timestamp, "Play Recording" button (stub for Phase 4), "View Transcript" button (stub for Phase 4)
- Pagination: "Load More" button at top, fetches older messages

**Refactor:** `src/leadModalParts/ConversationModal.jsx`
- Replace the internal message rendering with `<MessageList messages={messages} />`
- All existing lead screen behavior must remain identical after refactor
- Test this before moving on

**New file:** `src/messages/ConversationThread.jsx`
- Modal overlay component
- Header bar: back arrow + "Messages" label (left), contact name + phone (center), "Go to Lead →" button (right — links to lead record by contactId)
- If no matching lead found for contactId, hide "Go to Lead" button
- Body: `<MessageList />` for the full thread
- Footer: reply box stub (Phase 3)
- Overlay sits on top of MessagesPage — MessagesPage stays mounted underneath
- Dismiss only via back arrow, not by tapping outside

**Wire up in MessagesPage:**
- Clicking a conversation row opens `<ConversationThread />` with that conversation's data
- Back arrow closes thread, returns to list

#### Acceptance criteria
- Tapping a contact row opens the thread overlay
- Full message history renders correctly with correct bubble direction
- Call cards render with placeholder buttons
- "Go to Lead" button appears when lead exists, hidden when it does not
- Back button closes overlay, list is still there underneath
- Existing lead screen ConversationModal works identically — zero regression

---

### PHASE 3 — Reply Interface (All 4 Channels)
**Dependency:** Phase 2 complete
**Estimated sessions:** 3–4

#### What to build

**New file:** `src/messages/ReplyBox.jsx`
- Channel selector: SMS (default), Email, Facebook Messenger, Instagram DM
- SMS tab: text area, expands up to 4 lines, Send button
- Email tab: Subject field + body text area
- Facebook Messenger tab: text area. If 24-hour messaging window expired, disable input and show "24-hour window expired" message
- Instagram DM tab: same rules as Facebook
- Send button calls new backend endpoint
- Optimistic update: append message to thread immediately on send, before API confirms
- If API call fails, remove the optimistic message and show error

**New backend endpoint:** `POST /api/messages/send`
- File: `CP360 Backend/controllers/messagesController.js`
- Accepts: `{ conversationId, type, message, subject? }`
- type values: `SMS`, `Email`, `FB`, `IG`
- Calls GHL `POST /conversations/messages`
- Returns the created message object

**Wire ReplyBox into ConversationThread:**
- Replace footer stub with `<ReplyBox conversationId={id} onMessageSent={handleNewMessage} />`

#### Acceptance criteria
- All 4 channel tabs render and are selectable
- SMS send posts to GHL and message appears in thread immediately
- Email send works with subject field
- FB and IG tabs show disabled state when window expired
- Failed sends roll back the optimistic message and show an error indicator
- Works on mobile keyboard — text area doesn't get hidden behind keyboard

---

### PHASE 4 — Call Card: Audio Player, Transcript, Actions
**Dependency:** Phase 2 complete (can run parallel to Phase 3)
**Estimated sessions:** 1–2

#### What to build

**Backend proxy endpoint:** `GET /api/messages/recording/:messageId`
- File: `CP360 Backend/controllers/messagesController.js`
- Calls GHL recording endpoint with Bearer auth
- Streams audio bytes back to frontend as `audio/wav`
- Frontend uses this CP360 URL in `<audio src="..." />`

**Backend transcript endpoint:** `GET /api/messages/transcript/:messageId`
- Calls GHL transcription endpoint
- Returns transcript text

**Update `MessageList.jsx` call cards:**
- "Play Recording" button: fetches from proxy endpoint, renders HTML5 `<audio>` player inline. Show loading spinner while fetching.
- "View Transcript" button: fetches transcript, displays below call card with truncation at 3 lines. "Show More" expands full transcript.
- "Call Back" button: `tel:` link with the contact's phone number
- "Send SMS" button: pre-fills the ReplyBox with SMS tab selected (emit event or use shared state)

#### Acceptance criteria
- Play button fetches and plays the call recording inline
- Transcript renders with truncation and show more
- Call Back opens native phone dialer with correct number
- Send SMS shortcut pre-selects SMS tab and focuses the text area

---

### PHASE 5A — 60-Second Polling Sync
**Dependency:** Phase 2 complete
**Estimated sessions:** 1–2

#### What to build

**Inside `ConversationThread.jsx`:**
- `setInterval` polling every 60 seconds while thread is mounted
- Fetches latest messages from GHL for this conversation
- Deduplicates by message ID — never renders the same message twice
- New messages append to bottom
- `clearInterval` on component unmount

**Inside `MessagesPage.jsx`:**
- `setInterval` polling every 60 seconds
- Refreshes the conversation list (unread counts, last message preview)
- Only while MessagesPage is mounted

#### Acceptance criteria
- New inbound message appears in open thread within 60 seconds without manual refresh
- No duplicate messages appear after polling
- Intervals clear when navigating away — no memory leaks
- No visible flash or re-render of existing messages on each poll

---

### PHASE PUSH — Webhook to Firebase Push Notifications
**Dependency:** Phase 1 complete
**Estimated sessions:** 1–2

#### What to build

**Extend `CP360 Backend/controllers/webhookController.js`:**
- Handle `InboundMessage` webhook event from GHL
- Extract: `contactId`, `contactName`, `messageBody`, `locationId`
- Look up which CP360 company matches the `locationId`
- Look up which user(s) belong to that company
- Send Firebase push notification to those user(s)
- Notification payload:
  - Title: contact name (e.g., "John Smith")
  - Body: message preview (first 100 chars of messageBody)
  - Data: `{ type: "new_message", conversationId: "...", contactId: "..." }`

**GHL Webhook configuration:**
- `InboundMessage` event must be added to the webhook in GHL dashboard for each location
- Document which webhook events are currently configured vs newly added

**Frontend deep link handler:**
- When app opens from a push notification with `type: "new_message"`, navigate to MessagesPage and open the thread for that `conversationId`
- File location: wherever push notification tap handlers are currently wired (confirm path)

#### Acceptance criteria
- Inbound SMS from a customer triggers a push notification to the contractor's device within 5 seconds
- Notification shows customer name and message preview
- Tapping notification opens CP360 directly to the correct conversation thread
- No duplicate notifications for the same message
- Works when app is in background and when app is closed

---

### PHASE 5B — Webhook Real-Time Sync (Replaces Polling)
**Dependency:** Phase 5A stable and tested
**Estimated sessions:** 2–3

#### What to build

**Extend webhook handler for message events:**
- `InboundMessage` — new message received from customer
- `OutboundMessage` — message sent by contractor (from GHL or another source)
- `CallStatus` — call completed (used to trigger call card update in thread)

**WebSocket or SSE connection from frontend to CP360 backend:**
- When ConversationThread is open, maintain a persistent connection
- Backend pushes new message events down this connection
- Frontend appends new messages to thread in real time
- Fallback: if connection drops, fall back to 60-second polling (Phase 5A remains as fallback)

**Remove or disable polling intervals** once webhook sync is confirmed stable.

#### Acceptance criteria
- New inbound message appears in open thread within 2 seconds
- No polling requests firing while WebSocket/SSE connection is active
- Polling resumes automatically if real-time connection drops
- No duplicate messages

---

### PHASE SF1 — Twilio Account Setup (Configuration, No Code)
**Dependency:** Business decision on account ownership (see Open Items)
**Estimated sessions:** 0 (configuration only)

#### Steps
1. Create Twilio account (CP360-owned or contractor-owned — per business decision)
2. Migrate tracking numbers from LC Phone to Twilio via GHL Support request (1–2 business days)
3. Confirm numbers still appear in GHL conversations after migration
4. Note Twilio Account SID and Auth Token for backend environment variables
5. Note Twilio phone number(s) and which company/location each belongs to
6. Add mapping to CP360 database: `company_id` → `twilio_number`

#### Environment variables to add
```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_API_KEY=
TWILIO_API_SECRET=
```

---

### PHASE SF2 — Twilio Voice SDK: Backend Token + TwiML
**Dependency:** SF1 complete
**Estimated sessions:** 3–4

#### What to build

**New backend endpoint:** `POST /api/calls/token`
- File: `CP360 Backend/routes/calls.js` (new file)
- Controller: `CP360 Backend/controllers/callsController.js` (new file)
- Generates a Twilio Access Token scoped to Voice
- Token includes the TwiML App SID (configured in Twilio console)
- Returns token to frontend
- Register route in `CP360 Backend/server.js`

**New backend endpoint:** `POST /api/calls/twiml`
- Receives Twilio webhook when call connects
- Returns TwiML `<Response><Dial callerId="{{trackingNumber}}"><Number>{{customerPhone}}</Number></Dial></Response>`
- `callerId` must be the correct tracking number for this company
- Requires lookup: company → tracking number mapping

**Twilio console setup:**
- Create TwiML App pointing to `POST /api/calls/twiml`
- Note TwiML App SID for Access Token generation

**Frontend:** `src/calls/SoftphoneProvider.jsx` (new file)
- React context provider wrapping the entire app
- Initializes Twilio Device on mount using token from `/api/calls/token`
- Refreshes token before expiry (tokens expire after 1 hour by default)
- Exposes: `{ device, callStatus, activeCall, startCall, hangUp, mute, setSpeaker }`
- Add `<SoftphoneProvider>` to root `App.jsx` wrapping all routes

#### Acceptance criteria
- Token endpoint returns a valid Twilio Access Token
- TwiML endpoint returns valid TwiML XML when Twilio calls it
- Twilio Device initializes in the browser/app without errors
- Device registers as ready (Twilio status: "registered")

---

### PHASE SF3 — Persistent Call Bar + Global Call State
**Dependency:** SF2 complete
**Estimated sessions:** 2–3

#### What to build

**New file:** `src/calls/CallBar.jsx`
- Persistent bar pinned to bottom of screen, above bottom nav if applicable
- Only renders when `callStatus === 'active'` (from SoftphoneProvider context)
- Shows: contact name, live call duration timer (counts up from 00:00)
- Controls: Mute button, Speaker button, Hang Up button
- Hang Up calls `hangUp()` from context
- Mute toggles `mute()` from context, button shows active state when muted
- Speaker toggle cycles: earpiece → speaker → (Bluetooth if connected)

**Wire into app layout:**
- File: main layout component (confirm path before editing)
- `<CallBar />` renders at layout level, below all page content, above nothing
- Visible from every screen while call is active

**"Call Back" button on lead screen and call cards:**
- Calls `startCall({ contactName, phone, companyId })` from SoftphoneProvider
- `startCall` looks up the correct Twilio number for this `companyId`
- Initiates outbound call via Twilio Device

#### Acceptance criteria
- Tapping Call Back on any lead initiates a real outbound call
- Customer sees the correct tracking number on their caller ID
- Call bar appears immediately when call connects
- Duration timer counts up in real time
- Contractor can navigate to any screen (leads, appointments, etc.) during the call
- Call bar stays visible on every screen during the call
- Call ends only when Hang Up is tapped, not when navigating

---

### PHASE SF4 — Mute, Speaker, and Wake Lock
**Dependency:** SF3 complete
**Estimated sessions:** 1–2

#### What to build

**Mute:**
- Already wired in SF3 via Twilio Device `activeCall.mute(true/false)`
- Verify behavior: muted state persists when navigating between screens
- Mute button shows clear visual active state (filled icon or color change)

**Speaker toggle:**
- Use Capacitor `@capacitor/device` or native audio routing API
- Cycle: earpiece (default on call start) → speakerphone → back to earpiece
- If Bluetooth device is connected, audio routes to Bluetooth automatically; speaker toggle still works for earpiece ↔ speaker
- Button shows current state clearly

**Screen Wake Lock:**
- Install Capacitor KeepAwake plugin: `npm install @capacitor-community/keep-awake`
- Call `KeepAwake.keepAwake()` when call starts (in `startCall` function)
- Call `KeepAwake.allowSleep()` when call ends (in `hangUp` function and on unexpected disconnect)
- Wrap in try/catch — plugin may not be available in web browser during dev

#### Acceptance criteria
- Mute button silences microphone and shows active state
- Speaker button switches audio output, persists when navigating
- Screen does not dim or lock during an active call
- Screen returns to normal timeout behavior after hang up

---

### PHASE SF5 — Post-Call GHL Log Entry
**Dependency:** SF3 complete (can run parallel to SF4)
**Estimated sessions:** 1–2

#### What to build

**In `callsController.js`:**
- New function: `logCallToGHL(params)`
- Called automatically when Twilio fires call completion webhook (`POST /api/calls/status`)
- Params: `contactId`, `locationId`, `direction: 'outbound'`, `duration` (seconds), `recordingUrl`, `startTime`
- Calls GHL `POST /calls/log` (external call log API)
- On success: call appears in GHL conversation history with recording attached
- On failure: log error but do not surface to contractor — silent failure

**New backend endpoint:** `POST /api/calls/status`
- Twilio calls this webhook when a call ends
- Extract: call SID, duration, recording URL (if recording enabled on the number)
- Look up contact and location from call metadata stored at call start
- Call `logCallToGHL()`

**At call start (`startCall`):**
- Store call metadata: `{ callSid, contactId, locationId, companyId, startTime }` in memory (or Redis if available)
- Used to reconstruct the log entry when the status webhook fires

#### Acceptance criteria
- After a call ends, a call record appears in GHL conversations within 30 seconds
- Record shows correct duration, direction (outbound), and timestamp
- Recording URL is attached if recording is enabled on the Twilio number
- GHL shows the call in the contact's conversation timeline

---

### PHASE 6 — Mobile Polish + Push Notification Deep Links
**Dependency:** All phases complete
**Estimated sessions:** 2–3

#### What to build

- Verify all new screens work correctly at 390px width (iPhone 14 viewport)
- Confirm keyboard does not cover ReplyBox text area on iOS (scroll behavior or keyboard avoidance)
- Confirm thread overlay scroll behavior is correct (messages at bottom, scroll up for history)
- Confirm call bar does not overlap bottom navigation
- Test all push notification deep link scenarios:
  - App open: navigate to Messages + open thread
  - App in background: resume + navigate to Messages + open thread
  - App closed: cold launch + navigate to Messages + open thread
- Add haptic feedback on message send (Capacitor Haptics)
- Confirm ConversationThread header renders cleanly at all name lengths (truncate if needed)
- Final pass on loading states, empty states, and error states across all new screens

---

## Database Changes (Run in TablePlus)

Two new tables are required for the Softphone phases. No other phases require database changes — messages are never stored in CP360.

Run these SQL statements in TablePlus connected to your Railway PostgreSQL database. Run them in order.

---

### Table 1 — company_twilio_numbers
Maps each CP360 company to their Twilio tracking number(s). Used by the softphone to determine which caller ID to use for outbound calls.

**When to run:** Before starting Phase SF1.

```sql
CREATE TABLE IF NOT EXISTS company_twilio_numbers (
  id                SERIAL PRIMARY KEY,
  company_id        INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  twilio_number     VARCHAR(20) NOT NULL,
  label             VARCHAR(100),
  is_primary        BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_company_twilio_numbers_company_id
  ON company_twilio_numbers(company_id);

COMMENT ON TABLE company_twilio_numbers IS
  'Maps CP360 companies to their Twilio outbound caller ID numbers. Used by softphone to match correct tracking number per company.';

COMMENT ON COLUMN company_twilio_numbers.twilio_number IS
  'E.164 format required. Example: +17085551234';

COMMENT ON COLUMN company_twilio_numbers.is_primary IS
  'When a company has multiple numbers, the primary number is used as default outbound caller ID.';
```

**After running:** Manually insert one row per company using their tracking number:
```sql
-- Example: insert tracking number for a company
-- Replace 1 with the actual company id from your companies table
-- Replace +17085551234 with the actual Twilio number in E.164 format
INSERT INTO company_twilio_numbers (company_id, twilio_number, label, is_primary)
VALUES (1, '+17085551234', 'Main Tracking Number', true);
```

---

### Table 2 — active_calls
Temporary storage for in-flight call metadata. When a call starts, a row is inserted. When the Twilio status webhook fires after the call ends, this row is looked up to get the contactId and locationId needed to log the call back to GHL. Rows are deleted after the call is logged.

**When to run:** Before starting Phase SF2.

```sql
CREATE TABLE IF NOT EXISTS active_calls (
  id              SERIAL PRIMARY KEY,
  call_sid        VARCHAR(64) NOT NULL UNIQUE,
  company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id      VARCHAR(100) NOT NULL,
  location_id     VARCHAR(100) NOT NULL,
  contact_name    VARCHAR(255),
  contact_phone   VARCHAR(20),
  twilio_number   VARCHAR(20) NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_active_calls_call_sid
  ON active_calls(call_sid);

COMMENT ON TABLE active_calls IS
  'Temporary in-flight call metadata. Row inserted when call starts, deleted after GHL call log is posted. Allows Twilio status webhook to reconstruct call context.';

COMMENT ON COLUMN active_calls.call_sid IS
  'Twilio Call SID (starts with CA...). Used to match the status webhook back to the original call.';

COMMENT ON COLUMN active_calls.contact_id IS
  'GHL contact ID. Used to post the call log back to GHL after the call ends.';

COMMENT ON COLUMN active_calls.location_id IS
  'GHL location ID (same as company ghl_location_id). Used to authenticate GHL API call for the correct sub-account.';
```

---

### Verify Tables Created
After running both statements, confirm in TablePlus:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('company_twilio_numbers', 'active_calls')
ORDER BY table_name;
```
Expected result: 2 rows returned.

---

### No Other DB Changes Required
- Messages Phase (1–5B): No DB changes. All message data lives in GHL.
- Push Notifications Phase: No DB changes. Firebase tokens already stored.
- Phase 6 Mobile Polish: No DB changes.

---

## Twilio Setup Instructions

Complete these steps in order before starting Phase SF1. This is manual configuration — no code involved.

---

### Step 1 — Create Twilio Account
1. Go to [twilio.com](https://www.twilio.com) and sign up or log in
2. If creating new: verify your email and phone number
3. From the Twilio Console dashboard, note your **Account SID** (starts with `AC...`)
4. From the Twilio Console dashboard, note your **Auth Token** (click to reveal)
5. Keep these — they go into your backend `.env` file

---

### Step 2 — Create an API Key (More Secure Than Auth Token for SDK)
The Twilio Voice SDK uses an API Key + Secret instead of the main Auth Token.

1. In Twilio Console: go to **Account → API Keys & Tokens**
2. Click **Create API Key**
3. Friendly name: `CP360 Voice SDK`
4. Key type: **Standard**
5. Click **Create API Key**
6. **Copy the SID and Secret immediately** — the Secret is only shown once
7. Note:
   - API Key SID (starts with `SK...`) → this is `TWILIO_API_KEY` in your `.env`
   - API Key Secret → this is `TWILIO_API_SECRET` in your `.env`

---

### Step 3 — Add Your Tracking Numbers
If migrating numbers from LC Phone to Twilio:
1. Open a support ticket with **GoHighLevel Support**
2. Request: "Migrate our LC Phone numbers to Twilio. We want to manage them directly in our own Twilio account."
3. Provide them your Twilio Account SID
4. Timeline: 1–2 business days
5. After migration, verify numbers appear in Twilio Console under **Phone Numbers → Manage → Active Numbers**
6. Verify the numbers still show in GHL conversations (they should — GHL supports external Twilio numbers)

If purchasing new numbers directly in Twilio:
1. Twilio Console → **Phone Numbers → Manage → Buy a Number**
2. Search by area code or zip code matching your service area
3. Purchase the number(s) needed

---

### Step 4 — Configure Each Number for Recording
For each tracking number in your Twilio account:
1. Twilio Console → **Phone Numbers → Manage → Active Numbers**
2. Click on the number
3. Under **Voice & Fax** → **A Call Comes In**: leave as-is (inbound not used here)
4. Under **Call Recording**: set to **Record from Ringing** or **Record from Answer**
5. Save

---

### Step 5 — Create a TwiML App
The TwiML App tells Twilio where to ask for call instructions when CP360 initiates an outbound call.

1. Twilio Console → **Voice → TwiML Apps**
2. Click **Create new TwiML App**
3. Friendly name: `CP360 Softphone`
4. **Voice Request URL**: `https://your-render-backend-url.onrender.com/api/calls/twiml`
   - Method: **HTTP POST**
5. **Status Callback URL**: `https://your-render-backend-url.onrender.com/api/calls/status`
   - Method: **HTTP POST**
6. Click **Save**
7. Note the **TwiML App SID** (starts with `AP...`) — this goes into your backend `.env` as `TWILIO_TWIML_APP_SID`

---

### Step 6 — Add Environment Variables to Render Backend
In your Render dashboard → CP360 Backend service → **Environment**:

```
TWILIO_ACCOUNT_SID        = ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN         = your_auth_token
TWILIO_API_KEY            = SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_SECRET         = your_api_key_secret
TWILIO_TWIML_APP_SID      = APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

After adding variables, Render will redeploy the backend automatically.

---

### Step 7 — Verify Setup (Before Writing Any Code)
In the Twilio Console, confirm:
- Account SID and Auth Token are visible on the dashboard
- API Key appears under Account → API Keys
- At least one active phone number is in your account
- TwiML App exists and points to your Render backend URL
- Recording is enabled on your numbers

---

## GHL Webhook Configuration

CP360 already receives some GHL webhooks. These steps add the message-related events needed for push notifications and real-time sync.

---

### Where to Configure in GHL
1. Log into GHL as Agency Admin
2. Go to **Settings → Integrations → Webhooks** (at the sub-account/location level, not agency level)
3. You need to configure webhooks **per location** for each contractor company
4. If you have a universal webhook URL already configured, you are adding events to it — not creating a new webhook

---

### Your Webhook Receiver URL
The CP360 backend already has a webhook endpoint. It is:
```
https://your-render-backend-url.onrender.com/api/webhooks/ghl
```
Confirm the exact path by checking `CP360 Backend/server.js` and `webhookController.js` for the registered route.

---

### Events to Add (Phase Push — Push Notifications)
Add these events to the webhook for **each contractor location**:

| Event Name in GHL | Purpose |
|-------------------|---------|
| `InboundMessage` | Fires when a customer sends any message (SMS, Email, FB, IG). Triggers push notification to contractor. |

### Events to Add (Phase 5B — Real-Time Sync)
Add these after Phase Push is working:

| Event Name in GHL | Purpose |
|-------------------|---------|
| `OutboundMessage` | Fires when a message is sent to a customer (from GHL or CP360). Updates thread in real time. |
| `CallStatus` | Fires when a call ends. Updates call card in thread. |

---

### How to Add Events Per Location
1. In GHL, navigate to the sub-account (location) for a contractor
2. Go to **Settings → Integrations → Webhooks**
3. If no webhook exists: click **Add New Webhook**, enter the CP360 receiver URL above
4. If webhook already exists: click **Edit** on the existing webhook
5. Check the boxes for the events listed above
6. Click **Save**
7. Repeat for each contractor location

---

### Verify Webhooks Are Firing
After configuring:
1. Have a test SMS sent to one of the contractor's tracking numbers
2. Check your Render backend logs — you should see the incoming webhook payload logged
3. The payload will include `type: "InboundMessage"`, `locationId`, `contactId`, and `body`
4. If nothing appears in logs, double-check the webhook URL is correct and the event is checked in GHL

---

### GHL Webhook Payload — InboundMessage
For reference when writing the webhook handler code (Phase Push):
```json
{
  "type": "InboundMessage",
  "locationId": "cgSrmTZnB7MqQUUaWvgq",
  "contactId": "xyz123",
  "conversationId": "abc456",
  "messageType": "SMS",
  "body": "Hey can you come out tomorrow?",
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+17085551234",
  "attachments": []
}
```

---

## Open Items (Not Yet Decided)

| Item | Decision Needed | Impact |
|------|----------------|--------|
| Twilio account ownership | CP360 owns numbers (retention) vs contractor owns numbers (portability) | Affects SF1 setup only. Zero impact on code. |

---

## File Map — New Files This Project Creates

```
frontend-app/JobFlow-dashboard-main/src/
├── pages/
│   └── MessagesPage.jsx                  (Phase 1)
├── messages/
│   ├── MessageList.jsx                   (Phase 2 — extracted from ConversationModal)
│   ├── ConversationThread.jsx            (Phase 2)
│   └── ReplyBox.jsx                      (Phase 3)
├── calls/
│   ├── SoftphoneProvider.jsx             (Phase SF2)
│   └── CallBar.jsx                       (Phase SF3)

CP360 Backend/
├── routes/
│   ├── messages.js                       (Phase 1)
│   └── calls.js                          (Phase SF2)
└── controllers/
    ├── messagesController.js             (Phase 1)
    └── callsController.js                (Phase SF2)
```

## Files Modified (Not Replaced)

```
frontend-app/JobFlow-dashboard-main/src/
├── leadModalParts/ConversationModal.jsx  (Phase 2 — refactor to use MessageList)
├── App.jsx                               (Phase SF2 — add SoftphoneProvider wrapper)
└── [main layout component]               (Phase SF3 — add CallBar)

CP360 Backend/
├── server.js                             (Phase 1 + SF2 — register new routes)
└── controllers/webhookController.js      (Phase Push — add InboundMessage handler)
```

---

## Session Protocol

When starting any session, state which phase is being worked on. Claude will:
1. Confirm the phase and what will be built in this session
2. Provide file path before every code block
3. Show current code before showing replacement code
4. Give one complete action at a time
5. Wait for "n" (next) before proceeding to the next step

Never skip steps. Never combine multiple file edits into one response unless explicitly asked.
