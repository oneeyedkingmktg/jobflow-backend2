# Claude Code Implementation Prompt

We need to implement Phase 1 of a user permissions system.

IMPORTANT

This is NOT a one-off "hide contract price" change.

Build the foundation of a permissions system that will support additional permission categories later.

However, only implement the Financial Information permission category at this time.

---

# Roadmap File

Before making any code changes:

Read and understand:

/docs/permissions-roadmap.md

This document defines the long-term permissions architecture.

Implement only the Financial Information permission category described in this Phase 1 document.

Do not implement any future permission categories at this time.

---

# Decisions Made (Pre-Implementation Q&A)

## "View Documents" = "Create Documents" button in BidderForm

The button labeled **"Create Documents"** at `BidderForm.jsx:989` opens a modal for generating/viewing proposal PDFs and invoice PDFs. This is the button controlled by the Financial Information permission. When hidden, the user cannot access proposal or invoice PDFs through the UI.

## `show_conversations` moves from GHL tab to Company Info tab

Currently `show_conversations` is part of `ghlForm` state and saved via `handleSaveGHLKeys()` in `CompanyModal.jsx`. Move it cleanly to the main `form` state and save it with the main company info save path. Remove the checkbox from the GHL tab entirely.

## Service Calls: new company-level column

Add a `service_calls_enabled` BOOLEAN column to the `companies` table (DEFAULT false).

If Service Calls is disabled company-wide:
- The Service Calls permission option is hidden from the user-level Permissions modal.
- The existing per-user `service_calls_enabled` field on the `users` table remains for user-level control.
- The company-level toggle acts as a master override: if OFF, no users in that company can have Service Calls access regardless of their user-level setting.

## `estimator_enabled` is master-only

The `estimator_enabled` column exists in the DB. Add it to the Company Info tab but make it **visible and editable only by master-role users**. It must not appear in the Permissions modal or be accessible by admin or user roles.

## Permissions button location

When a master or admin user opens a **user's modal** (UserModal.jsx), a new **"Permissions"** button appears. Clicking it opens a new **Permissions modal**. The Permissions modal contains the permission configuration for that user. It does not live inside UserModal itself — it is a separate modal layered on top.

## Default permission level

When a user is created or a new permission category is first introduced, the default is **hide** for all permission categories. Admins must explicitly grant access.

## Contract Price in view mode (Financial Information = view)

When a user has `view` access, Contract Price is displayed as **read-only text only**. No input box is rendered. This applies to the contract price field in `LeadDetailsEdit.jsx`.

---

# Company-Wide Feature Settings Cleanup

Move all company-wide feature checkboxes to:

Company Info tab
(bottom of page)

Remove duplicate company-wide feature checkboxes from any other tabs.

Company-wide feature settings:

* Reports
* Conversation Log (`show_conversations`) ← currently in GHL tab, move to Info tab
* Estimator (`estimator_enabled`) ← master-only; add to Info tab, hidden from admin/user
* Bidder (`bidder_enabled`) ← currently in Bidder admin settings tab, add to Info tab
* Service Calls ← new `service_calls_enabled` column on `companies` table, add to Info tab

Company-wide feature settings act as a master override.

If a company-wide feature is disabled:

* Hide feature access
* Hide related UI
* Hide related permissions option in the Permissions modal
* Block access to that feature

---

# User Permissions UI

In the user's modal (UserModal.jsx):

Add a **"Permissions"** button.

Clicking Permissions opens a separate Permissions modal.

For now only Financial Information should be active/editable.

Future permissions are documented in the roadmap and should be shown as coming-soon / grayed out in the modal so the structure is visible.

Permission categories use a single access level value:

* hide
* view
* edit

Do NOT use separate View/Edit checkboxes.

Edit automatically includes View.

Only Admin and Master users may open the Permissions modal and manage permissions.

---

# Phase 1 Implementation

Implement:

Financial Information

Access Levels:

* hide
* view
* edit

Only Admin/Master users may manage permissions.

Default for all users (new and existing): **hide**

---

# Financial Information Permission

Financial Information controls:

## Contact / Lead Record

* Contract Price

View: rendered as read-only text
Hide: field not rendered

## Online Estimator

* Online Estimator button on Lead Edit page (`LeadDetailsView.jsx:221`)

Hide:

* Remove button completely

View/Edit:

* Show button

## Bidder - Saved Bid List

Hide bid_total pricing displayed on saved bid cards (`BidderPanel.jsx:163`).

The bid card itself remains visible — only the dollar amount is hidden.

## Bidder - Bid Detail Screen

Hide/show:

* Individual line item pricing
* Discounts
* Subtotals
* Bid Total

Keep visible regardless of permission level:

* Item descriptions
* Quantities
* Non-financial bidder information

## Payment Schedule

Hide/show entire Payment Schedule section (`BidderForm.jsx`).

## Create Documents (Bidder Detail screen)

The **"Create Documents"** button (`BidderForm.jsx:989`) opens the proposal/invoice PDF modal.

When hidden:

* Button is not rendered
* User cannot access proposal PDFs or invoice PDFs through the UI

When view or edit:

* Button is visible and functional

## Balance Due

Hide/show Balance Due (`BidderForm.jsx` — calculated as `bidTotal - payTotal`).

---

# Financial Information Behavior

Hide

* Remove financial values from UI.
* Remove financial buttons where defined above.
* Hide financial sections where defined above.

View

* Show financial information as read-only text (no input boxes).
* Financial buttons visible but read-only where applicable.

Edit

* Show financial information.
* Allow editing and saving where editing currently exists.

---

# Important Design Requirement

Do not hardcode Financial Information as a special-case permission.

Build it as the first permission category in a structure that can support:

* Financial Information
* Lead Management
* Bidder
* Contact Editing
* Customer Communications
* Calendar
* Service Calls
* Reports

Those categories are documented in the roadmap file but should not be implemented now.

---

# Implementation Checklist

Before making changes:

1. Read and understand existing permission/user structures.
2. Implement DB changes (migrations):
   - Add `permissions JSONB DEFAULT '{}'` column to `users` table.
   - Add `service_calls_enabled BOOLEAN DEFAULT false` column to `companies` table.
3. Update backend:
   - Return `permissions` field with user objects.
   - Add endpoint or extend existing user update to save permissions.
   - Validate that only admin/master can write permissions.
4. Company Info tab cleanup:
   - Move `show_conversations` from GHL tab to Info tab.
   - Add `service_calls_enabled` (company-level) to Info tab.
   - Add `bidder_enabled` toggle to Info tab (in addition to or replacing Bidder settings tab toggle).
   - Add `estimator_enabled` to Info tab — visible to master only.
5. Implement Permissions modal (new component):
   - Opened from a "Permissions" button inside UserModal.jsx.
   - Financial Information row: hide / view / edit selector.
   - Future categories shown as grayed-out/coming-soon.
   - Save to `permissions` JSONB via API.
6. Enforce Financial Information permission on all 7 affected screens:
   - Contract Price (view + edit forms)
   - Online Estimator button
   - Bidder saved bid list total
   - Bidder detail line items / discounts / subtotals / bid total
   - Payment Schedule section
   - Create Documents button
   - Balance Due
7. Verify all affected screens with hide / view / edit levels.
8. Report back with files changed, DB changes, and permission enforcement locations.
