# FieldSync — Phase 0 Wireframes (low-fidelity, text)

These are the Phase 0 wireframes required before coding screens in Phase 2.
They are text layouts, not final designs — build them in Figma or on paper
from these before coding, and review the technician screens on a real phone.

## S20 — Technician My Day (mobile, phone-first)

```
[Sync: Online | Last synced 09:12]   [☰]
MY DAY — Tue 3 Nov
[Overdue (1)]  [Today (6)]

OVERDUE
> 08:00–10:00  URGENT  Priya Sharma — AC not cooling
  12 Maple St, Austin  [Pending sync dot if offline]

TODAY
> 09:00–12:00  Maria Lopez — Panel upgrade
> 13:00–15:00  James Chen — Outlet repair
...
[+ No jobs after 15:00 — you're clear]
```

Rules: one tap opens job detail. Status pill + pending-sync dot on every row.
No hover, no small text links as primary actions.

## S21 — Technician Job Detail (mobile)

```
[< My Day]  [Sync: Pending sync (2)]
AC not cooling — 2nd floor   [HIGH]
Priya Sharma  [Call]  [Navigate]
12 Maple St, Austin, TX 78704
Window: 09:00–12:00

[En route] [On site] [In progress] [Complete]  <- sticky bottom bar,
   only valid next statuses shown

Checklist
[ ] Inspect filter
[x] Check refrigerant

Photos (3)  [+ Add photo]
Notes: [collaborative notes field]

[Signature step appears on Complete]
```

Rules: status bar is sticky at thumb reach. Photo button is prominent.
Offline banner is persistent, not a disappearing toast.

## S11 — Dispatcher Board (desktop)

```
[Dashboard] [Board] [Map] [Team]      Search: [______]  [+ New job]
Today: 12  |  Unassigned: 3  |  Overdue: 2  |  Completed today: 4

SCHEDULED (4)   EN ROUTE (2)   ON SITE (1)   IN PROGRESS (3)   COMPLETED (4)
[Card: Priya — AC]  [Card: ...]  ...
  09:00–12:00, Tina, HIGH, 📷 2
  Drag to change status (confirm for Completed/Cancelled)
```

Rules: overdue + unassigned counts are always visible at the top.
Clicking a card opens the job drawer, not a full page reload.
Status colours are the single STATUS_STYLES constant — see docs/06.
