# Permissions Roadmap

## Purpose

This document defines the long-term permissions architecture for Coating Pro.

Only Financial Information is implemented initially.

All other categories are planned for future implementation.

Permissions should be built using access levels rather than separate View/Edit checkboxes.

---

# Access Level Model

Possible values:

* hide
* view
* edit

Rules:

hide

* Feature not accessible.
* Related UI hidden.

view

* User can access and view.
* Read-only.

edit

* User can access and modify.
* Includes view rights automatically.

Not all categories require all three access levels.

---

# Default Permission Level

When a user is created or a new permission category is added, the default is **hide**.

Admins must explicitly grant access.

---

# Permission Storage

Permissions are stored as a JSONB column (`permissions`) on the `users` table.

Example:
```json
{ "financial_information": "edit" }
```

Missing keys are treated as `hide`.

---

# Company-Wide Feature Settings

Company-wide settings act as a master override for user permissions.

Location:

Company Info tab
(bottom of page)

Features:

* Reports
* Conversation Log
* Estimator *(master-only — not visible or editable by admin or user roles)*
* Bidder
* Service Calls

If a company-wide feature is disabled:

* Hide feature access
* Hide related UI
* Hide the related user-level permission option in the Permissions modal

Notes:

* Service Calls requires a `service_calls_enabled` column on the `companies` table (new).
* `show_conversations` (Conversation Log) moves from the GHL tab to the Company Info tab.
* `estimator_enabled` is controlled by master-role users only. It is not exposed in the Permissions modal or visible to admin/user roles.

---

# Financial Information

Access Levels

* hide
* view
* edit

Controls

## Contact / Lead Record

* Contract Price

## Online Estimator

* Online Estimator button on Lead Edit page

## Bidder Saved Bid List

* Saved bid pricing (bid_total shown per bid card)

## Bidder Detail Screen

* Individual line item pricing
* Discounts
* Subtotals
* Bid Total

Keep visible:

* Item descriptions
* Quantities
* Non-financial bidder information

## Payment Schedule

* Entire Payment Schedule section

## Create Documents (Bidder Detail screen)

* "Create Documents" button that opens the proposal/invoice PDF modal
* When hidden: user cannot access proposal PDFs or invoice PDFs through the UI

## Contact Financial Data

* Balance Due

Behavior

Hide

* Financial values hidden
* Financial buttons hidden

View

* Financial values visible as read-only text (no input boxes)
* Financial buttons visible but non-editable where applicable

Edit

* Financial values visible
* Editable

---

# Lead Management

Access Levels

* hide
* manage

Controls

* Move To Status buttons
* Change Lead Status
* Pause Contact
* Mark as Junk
* Delete Contact

Not Controlled

* Status visibility
* Add Prelead
* Sync Contacts

Hide

* Remove related buttons/actions

Manage

* Full lead management access

---

# Bidder

Access Levels

* hide
* view
* edit

Hide

* Remove View Bids button from lead modal

View

* User can access bidder
* User can view existing bidder content
* User cannot modify bidder data

Edit

* User can use bidder normally

Notes

* Financial values inside bidder are controlled by Financial Information
* Online Estimator is NOT controlled by Bidder
* Online Estimator is controlled by Financial Information

---

# Contact Editing

Access Levels

* view
* edit

View

* Contact record is read-only
* No save buttons
* No save and exit buttons
* No unsaved changes warnings
* Exit/Close only

Edit

* Normal contact editing experience

Includes

* Existing contact fields
* Existing contact settings
* Photos
* Files
* Future contact fields

---

# Customer Communications

Access Levels

* hide
* view
* edit

Hide

* Remove View Convo History button
* Remove Messages button from bottom navigation
* User cannot access communications

View

* View communication history
* View message log
* Cannot send messages

Edit

* View communications
* Send messages
* Use communication functions

Notes

* Service Calls are controlled separately

---

# Calendar

Access Levels

* hide
* view
* edit

Hide

* Remove Calendar button from Home screen
* Hide Appointment Date
* Hide Install Date

View

* View Calendar
* View appointments
* View scheduled events
* View Appointment Date
* View Install Date

Edit

* View Calendar
* Edit Appointment Date
* Edit Install Date

Notes

* Calendar button is the only access point to Calendar
* Calendar screen itself currently has no editable functions

---

# Service Calls

Access Levels

* hide
* view
* manage

Company-Wide Dependency

* Service Calls must be enabled at the company level (`service_calls_enabled` on `companies` table) before the user-level permission option is shown.
* If disabled company-wide, the Service Calls permission row is hidden from the Permissions modal entirely.

Hide

* Remove Service Call button from lead modal
* Hide service call appointments from Calendar

View

* View service call list
* View service call details
* View service call appointments on Calendar

Manage

* View service calls
* Create/manage service calls
* View service call appointments on Calendar

Notes

* Service Calls are separate from Customer Communications

---

# Reports

Access Levels

* hide
* view

Hide

* Remove Reports button from bottom navigation

View

* Access Reports screen

Notes

* Reports button is the only access point to Reports
* No Edit level currently planned
