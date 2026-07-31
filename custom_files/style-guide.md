# CoatingPro360 / JobFlow — Design Style Guide
**Mobile-First. Desktop-Compatible.**
Last updated: 2026-07-30

---

## 1. Design Philosophy

- **Mobile-first:** Every screen is designed for a 390px wide phone first. Desktop is an extension, not a rethink.
- **Field-ready:** Contractors use this on job sites. Tap targets are large. Text is readable in sunlight. No tiny controls.
- **Card-based:** Information lives in white cards on a light gray background. Cards contain one logical unit of content.
- **One primary action per screen:** Green = do the thing. Everything else is secondary.
- **Data is the hero:** Key numbers (time, cost, profit) are large and bold. Labels are small and muted.

---

## 2. Color System

### Primary
| Name | Hex | Usage |
|---|---|---|
| Green 600 (Primary) | `#00875A` | Primary buttons, active states, clocked-in status, positive values |
| Green 500 | `#00A86B` | Hover states, outlined button borders |
| Green 100 | `#E6F7F1` | Light green backgrounds, success banners |
| Green 50 | `#F0FAF6` | Subtle green tint on active cards |

### Neutrals
| Name | Hex | Usage |
|---|---|---|
| Gray 50 | `#F8F9FA` | App background (the "canvas") |
| Gray 100 | `#F1F3F5` | Alternate row backgrounds, disabled fields |
| Gray 200 | `#E9ECEF` | Borders, dividers, card outlines |
| Gray 400 | `#ADB5BD` | Placeholder text, inactive icons |
| Gray 600 | `#6C757D` | Secondary / label text |
| Gray 900 | `#1A1D23` | Primary body text, headings |

### Semantic
| Name | Hex | Usage |
|---|---|---|
| Red 500 | `#E03131` | Danger, clock out button, delete actions, loss values |
| Red 100 | `#FFE3E3` | Error banners, destructive backgrounds |
| Amber 500 | `#F59F00` | Warning states, "pending" status |
| Amber 100 | `#FFF3BF` | Warning banners |
| Blue 500 | `#1971C2` | Schedule section icon, informational |
| Blue 100 | `#D0EBFF` | Schedule section background tint |
| Purple 500 | `#7048E8` | Crew section icon |
| Purple 100 | `#E5DBFF` | Crew section background tint |

### Section Icon Colors (consistent across all screens)
| Section | Icon Color |
|---|---|
| Job Info / General | Green 600 |
| Location | Green 600 |
| Schedule / Dates | Blue 500 |
| Crew | Purple 500 |
| Financial / Budget | Green 600 |
| Notes | Gray 600 |
| Documents | Gray 600 |
| Time / Clock | Green 600 |

### White / Surfaces
- Card background: `#FFFFFF`
- Modal background: `#FFFFFF`
- App canvas: `#F8F9FA`

---

## 3. Typography

**Font:** Inter (Google Fonts). Fallback: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

### Scale
| Name | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| Display | 40px | 700 Bold | 1.1 | Live timer (time clock screen) |
| H1 | 24px | 700 Bold | 1.2 | Page titles |
| H2 | 20px | 600 SemiBold | 1.3 | Card titles, section names |
| H3 | 17px | 600 SemiBold | 1.4 | Sub-section headers |
| Body | 15px | 400 Regular | 1.5 | Standard body text, form values |
| Body Small | 13px | 400 Regular | 1.4 | Secondary info, addresses, meta |
| Label | 12px | 500 Medium | 1.3 | Form field labels, table column headers |
| Caption | 11px | 400 Regular | 1.3 | Timestamps, legal line, "last updated" |

### Rules
- Never go below 12px on mobile
- Primary text: Gray 900
- Secondary/label text: Gray 600
- Placeholder text: Gray 400
- Positive financial numbers: Green 600
- Negative financial numbers: Red 500

---

## 4. Spacing System

Base unit: **4px**

| Token | Value | Common Use |
|---|---|---|
| xs | 4px | Icon gaps, tight label spacing |
| sm | 8px | Internal card padding (tight), icon margins |
| md | 12px | Between form fields |
| lg | 16px | Standard card padding, section gaps |
| xl | 20px | Card padding on larger screens |
| 2xl | 24px | Between cards |
| 3xl | 32px | Section separators, page top padding |

**Mobile card padding:** 16px horizontal, 16px vertical
**Desktop card padding:** 20px horizontal, 20px vertical

---

## 5. Border Radius

| Element | Radius |
|---|---|
| Cards | 12px |
| Buttons (primary/secondary) | 10px |
| Input fields | 8px |
| Status badges / pills | 100px (fully round) |
| Modal | 16px (top corners only on mobile sheet) |
| Section icon container | 8px |
| Bottom nav bar | 16px top corners |
| Color swatches (crew) | 50% (circle) |

---

## 6. Shadows / Elevation

Mobile uses minimal shadow — mostly borders. Desktop can use more elevation.

| Level | CSS | Use |
|---|---|---|
| None | `none` | Cards on gray background (border is enough) |
| Low | `0 1px 3px rgba(0,0,0,0.08)` | Cards, inputs on focus |
| Medium | `0 4px 12px rgba(0,0,0,0.10)` | Modals, floating action buttons |
| High | `0 8px 24px rgba(0,0,0,0.14)` | Bottom sheets, popovers |

On mobile, prefer **Gray 200 border** over shadow for cards. Shadows cause rendering issues on some Android devices.

---

## 7. Component Library

### 7.1 Cards

```
White background (#FFFFFF)
Border: 1px solid #E9ECEF
Border radius: 12px
Padding: 16px
Margin between cards: 12px
```

Card variants:
- **Default** — white, bordered
- **Active/Highlighted** — Green 50 background, Green 600 left border (4px)
- **Clickable** — add chevron right icon at trailing edge
- **Disabled** — Gray 100 background, Gray 400 text

---

### 7.2 Buttons

**Primary (Solid Green)**
```
Background: Green 600 (#00875A)
Text: White, 15px, 600 weight
Height: 52px mobile / 44px desktop
Border radius: 10px
Padding: 0 24px
Full width on mobile by default
```

**Secondary (Outlined Green)**
```
Background: White
Border: 1.5px solid Green 600
Text: Green 600, 15px, 600 weight
Height: 52px mobile / 44px desktop
Border radius: 10px
```

**Danger (Outlined Red)**
```
Background: White
Border: 1.5px solid Red 500
Text: Red 500, 15px, 600 weight
Same sizing as secondary
```

**Ghost / Text Button**
```
No background, no border
Text: Gray 600, 14px, 500 weight
Used for: Cancel, secondary nav links
```

**Destructive Solid (rare)**
```
Background: Red 500
Text: White
Used only for: permanent delete confirmations
```

Tap target minimum: **44px height, 44px width** on all interactive elements.

---

### 7.3 Input Fields

```
Height: 48px (mobile), 44px (desktop)
Border: 1.5px solid Gray 200
Border radius: 8px
Background: White
Padding: 0 14px
Font: 15px, Gray 900
```

States:
- **Focus:** border → Green 600, subtle green glow (`0 0 0 3px rgba(0,135,90,0.12)`)
- **Error:** border → Red 500, error message below in Red 500 at 12px
- **Disabled:** background → Gray 100, text → Gray 400
- **Filled:** no change from default

Label: 12px, Gray 600, 500 weight, 6px above the field
Helper text: 12px, Gray 400, 4px below the field

**Textarea:**
Same as input, min-height 80px, resize: vertical only

**Select / Dropdown:**
Same as input, trailing chevron-down icon in Gray 400

---

### 7.4 Status Badges / Pills

```
Border radius: 100px
Padding: 4px 10px
Font: 12px, 600 weight
Display: inline-flex, items centered
```

| Status | Background | Text |
|---|---|---|
| In Progress | Green 100 | Green 600 |
| Clocked In | Green 600 | White |
| Clocked Out | Gray 100 | Gray 600 |
| Completed | Blue 100 | Blue 500 |
| Pending | Amber 100 | Amber 500 |
| Cancelled | Red 100 | Red 500 |
| Lead | Green 100 | Green 600 |
| Member | Gray 100 | Gray 600 |

---

### 7.5 Section Headers (within cards or pages)

Pattern: Colored icon in a soft background square + label text

```
Icon container: 28px x 28px, border-radius 7px
Icon size: 16px
Label: 14px, 600 weight, Gray 900
Row: flex, gap 10px, align-center
Margin bottom: 14px before section content
```

Example: Location section → Green 600 map pin icon in Green 50 square + "Location" label

---

### 7.6 Avatar / User Chips

Crew member list items:
```
Circle avatar: 36px, colored background (crew color), white initials, 13px 600 weight
Name: 15px Gray 900
Role: 12px Gray 600
Row height: 52px minimum
Trailing: role badge + remove X (if editable)
```

---

### 7.7 List Rows (clickable)

```
Height: 56px minimum
Padding: 0 16px
Border bottom: 1px solid Gray 200 (last item: none)
Trailing: chevron-right in Gray 400
Leading: optional icon or avatar
```

---

### 7.8 Dividers

```
Height: 1px
Color: Gray 200
Margin: 0 (full bleed within card) or 0 16px (inset)
```

---

## 8. Navigation

### Mobile — Bottom Tab Bar

5 tabs: Today / Jobs / Time Clock / Schedule / More

```
Height: 60px + safe area inset
Background: White
Border top: 1px solid Gray 200
Icon size: 22px
Label: 10px, 500 weight
Active: Green 600 icon + label
Inactive: Gray 400 icon + label
```

Active tab has NO background pill or highlight — just color change. Clean.

### Mobile — Top Bar (Screen Header)

```
Height: 56px
Background: White
Border bottom: 1px solid Gray 200
Title: 17px, 600 weight, Gray 900, centered
Left slot: back arrow (Gray 900) or hamburger menu
Right slot: action icon (export, add, history) or text button ("Save" in Green 600)
```

### Mobile — Back Navigation

Always a left-pointing chevron. Never text "Back." Label is the parent screen name if space allows.

### Desktop — Sidebar

Left sidebar: 240px wide, White, right border Gray 200
Nav items: icon + label, 44px height, 16px padding
Active: Green 50 background, Green 600 text + icon, 3px green left border
Hover: Gray 50 background

### Desktop — Page Header

Breadcrumb above H1: `Jobs > Smith Residence`
Breadcrumb: 12px, Gray 600, `>` separator
H1: 24px, 700, Gray 900
Actions: top-right corner, primary button + secondary button

### Desktop — Tab Strip (within a record)

Tabs: Details / Crew / Schedule / Budget / Notes / Documents
```
Height: 44px
Font: 14px, 500 weight
Active: Green 600 text, Green 600 2px bottom border
Inactive: Gray 600 text
Border bottom (strip): 1px solid Gray 200
```

---

## 9. Mobile-Specific Patterns

### Bottom Sheet (modal on mobile)
```
Bottom-anchored, slides up
White background
Top corners: 16px radius
Handle bar: 4px x 36px, Gray 300, centered, 12px from top
Max height: 90vh
Scrollable content inside
```

Use bottom sheets instead of centered modals on mobile for: confirmations, pickers, crew assignment, add note.

### Full-Screen Form (mobile)
When a form has more than 5 fields, it gets its own screen (not a modal).
Header: back arrow + title + "Save" button
Content: scrollable
Bottom: fixed "Save" button above safe area

### Pull-to-Refresh
Standard on all list screens (jobs list, time entries, etc.)

### Empty States
Centered icon (Gray 300) + H3 message + optional green CTA button
Example: "No jobs today" + "Add Job" button

### Loading States
Skeleton screens only — no spinners on cards. Spinner only for button actions (shows inside the button on tap).

---

## 10. Desktop-Specific Patterns

### Two-Column Form Layout
Fields in logical pairs side-by-side on screens wider than 768px.
Full-width fields: Description, Notes, Address line 1
Half-width fields: City/State/Zip, Start Date/End Date, Hourly Rate/Overtime Rate

### Data Tables (desktop)
```
Header: 12px, Gray 600, 500 weight, uppercase, 40px row height
Body rows: 52px height, alternating white / Gray 50
Hover: Gray 100 background
Border: 1px solid Gray 200 (horizontal only)
```

---

## 11. Icons

Library: **Lucide React** (already in use in the project)
Size: 20px standard / 16px in dense contexts / 24px in navigation
Color: inherits from context (Gray 400 inactive, Green 600 active, section colors per Section Icon Colors table)

Common icon assignments:
| Concept | Icon |
|---|---|
| Location / Address | `map-pin` |
| Schedule / Date | `calendar` |
| Crew / Team | `users` |
| Time Clock | `clock` |
| Financial / Budget | `dollar-sign` |
| Notes | `file-text` |
| Documents | `paperclip` |
| Job | `briefcase` |
| Photo | `camera` |
| Materials | `package` |
| Add | `plus` |
| Export / Print | `download` |
| Settings | `settings` |
| Alert | `bell` |

---

## 12. Financial Display Rules

These apply everywhere P&L numbers appear:
- **Gross Profit** (positive): Green 600, H2 size, bold
- **Gross Profit** (negative / loss): Red 500, H2 size, bold
- **Margin %**: same color as profit, H3 size
- **Revenue / Costs**: Gray 900, Body size
- **Per-person labor breakdown**: indented, Body Small, Gray 600
- **"View [X] Entries"** links: Green 600, 14px, with trailing chevron

---

## 13. Responsive Breakpoints

| Name | Width | Layout |
|---|---|---|
| Mobile | < 768px | Single column, bottom nav, bottom sheets |
| Tablet | 768px–1023px | Single column, sidebar nav, centered modals |
| Desktop | 1024px+ | Sidebar + content area, two-column forms, data tables |

Mobile is the design target. Tablet and desktop are **progressively enhanced** — the same components stretch and reflow, they don't get rebuilt.

---

## 14. Tone of Writing (UI Copy)

- Greet by first name on dashboard: "Good morning, Rocky!"
- Use plain contractor language: "Clock In" not "Begin Time Entry"
- Confirm before destructive actions: "Delete this job? This can't be undone."
- Error messages say what to do, not just what went wrong: "Phone number required — add one above to continue."
- Date format: MM/DD/YYYY everywhere
- Time format: 12-hour with AM/PM
- Currency: always USD, always `$X,XXX.XX` format

---

*This document is the law for all new screens. When in doubt, match what's here.*
