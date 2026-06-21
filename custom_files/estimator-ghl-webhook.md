# Estimator GHL Webhook — Feature Documentation

**Feature:** `POST /api/webhooks/estimate`
**Built:** 2026-06-20
**Branch:** fix-from-prod
**Commits:** `fd667b5f`, `08edecb9`

---

## Overview

Allows GoHighLevel to send Facebook lead ad data directly to CoatingPro360 for price
calculation and lead creation. The result is identical to a homeowner filling out the
embedded iframe estimator form — same lead record, same GHL tags, same custom fields,
same push notification — with one exception: the GHL contact already exists, so CP
skips creating a new GHL contact and instead links to the existing one by contact ID.

---

## Full Flow

```
Facebook Lead Ad
      ↓
GHL receives contact (native FB integration)
      ↓
Normalization step (GHL automation — if/else branches to clean up field values)
      ↓
Custom Webhook Action fires → POST /api/webhooks/estimate
      ↓
CP validates required fields
      ↓
CP looks up company via locationId → ghl_location_id
      ↓
CP loads estimator_configs + estimator_pricing_configs for that company
      ↓
CP calculates estimate (same calculateEstimate engine as iframe)
      ↓
CP finds existing CP lead (by ghl_contact_id → phone → email)
  OR creates new CP lead with ghl_contact_id already set
      ↓
CP saves estimate to estimator_leads table
CP sets has_estimate = true on lead
      ↓
CP applies GHL tags:
  - estimator_lead  (new leads only)
  - submitted_estimate (all)
      ↓
CP updates GHL custom fields (EST1 or EST2 depending on estimate count)
      ↓
CP fires push notification to contractor's phone (new leads only)
      ↓
CP returns estimate JSON to GHL automation
      ↓
GHL branches: got prices → send homeowner results / missing fields → flag for manual review
```

---

## Endpoint

```
POST /api/webhooks/estimate
```

No authentication required (public webhook, same as all other GHL webhooks).
Registered via `server.js` → `/api/webhooks` → `webhookRoutes.js`.

---

## Required Inputs

| Field | Required? | Expected Values |
|---|---|---|
| `locationId` | Always | GHL location ID |
| `contactId` | Strongly recommended | GHL contact ID |
| `phone` | Fallback if no contactId | Any format — CP normalizes |
| `email` | Fallback if no contactId/phone | Standard email |
| `first_name` | For new lead creation | Text |
| `last_name` | For new lead creation | Text |
| `full_name` | Alternative to first/last | Text |
| `floor_type` | Always | `garage` `basement` `patio` `commercial` `custom` |
| `garage_size` | If floor_type = garage | `1` `2` `3` `4` |
| `condition` | Always | `good` `minor` `major` |
| `square_feet` | Non-garage (option A) | Number |
| `length` + `width` | Non-garage (option B) | Numbers — multiplied for sq ft |
| `lead_source` | Optional | Defaults to `facebook` |

**If any required field is missing → CP returns `manual_review_required` and does nothing else.**

**If no contact identifier (contactId + phone + email all missing) → same result.**

---

## Response — Success

```json
{
  "calculatedSf": 480,
  "selectedQuality": "flake",
  "displayPriceMin": 2400,
  "displayPriceMax": 3200,
  "minimumJobApplied": false,
  "allPriceRanges": {
    "solid":    { "min": 1680, "max": 2160, "minimumApplied": false },
    "flake":    { "min": 2400, "max": 3200, "minimumApplied": false },
    "metallic": { "min": 3360, "max": 4320, "minimumApplied": false }
  }
}
```

`allPriceRanges` is the field to use in GHL for sending prices back to the homeowner.
`displayPriceMin` / `displayPriceMax` is for the first enabled finish type only.

## Response — Missing Fields

```json
{ "status": "manual_review_required", "message": "Manual review required" }
```

---

## What CP Does After Calculating

### Lead Lookup Order
1. Match by `ghl_contact_id`
2. Match by phone (normalized — digits only comparison)
3. Match by email

### New Lead (not found in CP)
- Creates lead record with `ghl_contact_id` set immediately
- `lead_source` = value from payload (default `facebook`)
- `status` = `status_pre_lead`
- No GHL contact sync — contact already exists

### Existing Lead (found in CP)
- Stamps `ghl_contact_id` onto CP lead if it wasn't already linked
- Proceeds to save estimate

### Estimate Save Rules
- Max 2 estimates per lead (same as iframe rule)
- If 2 already exist — skips save, still returns the calculation to GHL
- Estimate number 1 → EST1 GHL fields; number 2 → EST2 GHL fields

---

## GHL Fields Updated by CP

### EST1 (first estimate)
| GHL Custom Field Key | Value |
|---|---|
| `est_project_type` | e.g. `garage_2` |
| `est_square_footage` | e.g. `480 sq ft` |
| `est_floor_condition` | `Good` / `A Few Cracks` / `A Lot of Cracks` |
| `est_solid_price_range` | e.g. `$1,680 – $2,160` |
| `est_flake_price_range` | e.g. `$2,400 – $3,200` |
| `est_metallic_price_range` | e.g. `$3,360 – $4,320` |
| `est_custom_finish_range` | e.g. `$3,000 – $4,000` (if offered) |

### EST2 (second estimate — returning customer)
| GHL Custom Field Key | Value |
|---|---|
| `est2_square_footage` | Raw number as string |
| `est2_floor_condition` | Same label format as EST1 |
| `est2_solid_price_range` | Same format as EST1 |
| `est2_flake_price_range` | Same format as EST1 |
| `est2_metallic_price_range` | Same format as EST1 |
| `est2_custom_finish_range` | Same format as EST1 |

### GHL Tags Applied by CP
| Tag Key | When |
|---|---|
| `estimator_lead` | New CP leads only |
| `submitted_estimate` | Every estimate save |

---

## GHL Automation Setup

### Trigger
- **Contact Created**
- Filter: source = Facebook Lead Ad (to avoid firing on every new contact)

### Step 1 — Normalization (if/else branches)
Run before the webhook. Purpose: ensure values going into the webhook payload match
exactly what CP expects. CP will return `manual_review_required` if values don't match.

**floor_type must output:** `garage` `basement` `patio` `commercial` `custom`
**garage_size must output:** `1` `2` `3` `4` (not "2 Car" or "Two-Car")
**condition must output:** `good` `minor` `major`

If your Facebook form answer options already output these exact lowercase values into
GHL custom fields, this step can be skipped. If not, use GHL if/else branches to
update the custom field to the normalized value before Step 2.

### Step 2 — Custom Webhook Action

**URL:** `https://your-backend-domain/api/webhooks/estimate`
**Method:** POST
**Headers:** `Content-Type: application/json`

**Custom Data (JSON body — map each key to its GHL merge field):**

| JSON Key | GHL Merge Field |
|---|---|
| `locationId` | `{{location.id}}` |
| `contactId` | Contact ID merge field |
| `phone` | Contact phone merge field |
| `email` | Contact email merge field |
| `first_name` | Contact first name merge field |
| `last_name` | Contact last name merge field |
| `floor_type` | Custom field: floor type (normalized) |
| `garage_size` | Custom field: garage size (normalized) |
| `condition` | Custom field: floor condition (normalized) |
| `square_feet` | Custom field: square footage (if collected) |
| `lead_source` | `facebook` (hardcoded string) |

For garage leads, `square_feet` can be omitted — CP uses the company's average sq ft
config for that garage size (pulled from estimator_configs table).

For non-garage leads without sq ft, include both `length` and `width` custom fields
if your form collects dimensions instead of total square footage.

### Step 3 — Branch on Webhook Response
GHL reads the response body after the webhook action fires.

**Branch A — Response contains `status = manual_review_required`:**
- Internal notification to contractor: "New FB lead needs manual estimate — {{contact.full_name}}"
- Apply tag: `needs-manual-estimate` (optional)
- Send to manual review pipeline stage (optional)

**Branch B — Response does not contain `manual_review_required`:**
- CP has already handled everything (lead created, tags applied, push sent, GHL fields updated)
- Optional: Send homeowner an email/SMS with their price ranges using the EST1 custom
  fields that CP just populated (e.g. `{{contact.est_flake_price_range}}`)

---

## Comparison: Webhook vs Iframe

| Action | Iframe | Webhook |
|---|---|---|
| Source | Homeowner fills out embedded form | GHL automation fires after FB lead |
| GHL contact | CP creates via syncLeadToGhl | Already exists — CP links by ID |
| CP lead created | Yes (if new) | Yes (if new) |
| Estimate saved | Yes | Yes |
| `has_estimate = true` | Yes | Yes |
| Max 2 estimates | Yes | Yes |
| `estimator_lead` tag | Yes (via sync) | Yes (new leads only) |
| `submitted_estimate` tag | Yes | Yes |
| EST1/EST2 GHL fields | Yes | Yes — same field keys |
| Push notification | Yes (new leads, estimator_only plan) | Yes (new leads, all plans) |

**One behavioral difference:** The iframe push fires only for `estimator_only` plan companies
(they don't have GHL automations to alert them). The webhook push fires for all plan types
because the FB lead is a net-new estimator submission regardless of plan.

---

## Files Modified

| File | Change |
|---|---|
| `CP360 Backend/routes/webhookRoutes.js` | Added `POST /estimate` endpoint, imported `calculateEstimate`, `applyStatusTags`, `updateContactCustomFields`, `query`, added `formatProjectTypeForPush` helper |

No other files were changed. The endpoint reuses existing functions exactly — no duplicate logic.

---

## Future Iterations / Claude Notes

### Not yet built — consider for v2

**Address / city / state / zip from GHL contact:**
CP already accepts `address`, `city`, `state`, `zip` in the webhook payload and will
store them on the new lead. GHL just needs to include those merge fields in the custom
data payload. No backend change needed — just add the fields to the GHL webhook action.

**Square footage for garage (override):**
CP currently falls back to company config averages for garage sq ft if `square_feet`
is not in the payload. If you want to collect actual sq ft from FB form instead, just
add `square_feet` to the webhook payload. No backend change needed.

**Existing coating flag:**
The `calculateEstimate` engine supports `project.existingCoating` boolean and
`existing_coating_multiplier` from config. The webhook does not currently pass this.
If you add an "existing coating?" question to the FB form, pass it as `existing_coating`
in the payload and add `engineInput.project.existingCoating = payload.existing_coating === 'true'`
in `webhookRoutes.js` before the engine call. One line change.

**Opportunity / pipeline creation:**
Currently CP creates the lead record but does not create a GHL opportunity/pipeline card.
This could be done inside the webhook (via GHL API call to create opportunity) or handled
by a GHL automation step after the webhook fires. The GHL automation step is simpler.

**SMS/email to homeowner with their prices:**
Not done by CP. Handled in GHL automation Branch B using the EST1 custom fields CP
populated. CP intentionally leaves this to GHL so each company can customize the message.

**UTM fields:**
The iframe captures `utm_source`, `utm_medium`, `utm_campaign`. The webhook does not.
If you want to track which FB ad campaign generated the lead, add those as custom fields
in GHL and map them in the webhook payload. CP already has the DB columns — just need
to add them to the INSERT in the webhook route.

**Webhook signature verification:**
The endpoint is currently open (no `verifyGHLWebhook` middleware). The other GHL
contact webhook also uses this middleware. Consider adding it for security once the
automation is tested and stable — requires matching the GHL webhook secret in the
custom webhook action headers.

**plan_type push behavior:**
The webhook fires push for all plan types. The iframe only fires for `estimator_only`.
If this causes duplicate notifications for estimator_only companies running both the
iframe and webhook paths, add the `company.plan_type` check to the webhook push block
to match iframe behavior.
