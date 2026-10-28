# FieldSync — UX Flows & Screen Spec

Design principles (non-negotiable for MVP):
1. **Technician screens are phone-first, one-handed, and offline-tolerant.** Large tap targets (≥ 44px), primary action at thumb reach, no hover-only controls, no multi-step modals for status changes.
2. **Dispatcher screens are desktop-first, dense, and glanceable.** Board + map + queues on one screen where possible; no more than 2 clicks to assign or reschedule.
3. **Sync state is always visible, never hidden.** Offline banner, pending counts, and per-job sync badges are part of the layout, not toasts that disappear.
4. **Destructive actions confirm.** Cancel, deactivate user, delete photo, and complete-with-override all require explicit confirmation + reason where specified.

## Screen list

### Shared / Auth
- S01 Sign up / Log in (Clerk) — role/company selection after invite accept.
- S02 Accept invite — success / expired / revoked states.
- S03 App shell — top bar (company name, sync status, user menu), navigation by role.

### Admin / Dispatcher (desktop)
- S10 Dashboard — counts: today's jobs, unassigned, overdue, in progress, completed today. Links to board filtered by each count.
- S11 Board — Kanban by status (SCHEDULED, EN_ROUTE, ON_SITE, IN_PROGRESS, ON_HOLD, COMPLETED). Cards show: customer, address (short), time window, technician avatar, priority badge, photo count, sync/conflict flag.
- S12 Map — Mapbox, today's jobs as pins coloured by status, active technicians as separate markers, click pin → job drawer (not a full page navigation).
- S13 Job detail (desktop) — header (status, priority, assignment), customer + address + contact actions, timeline, checklist, notes (collaborative), photos grid, signature, job sheet download, activity log.
- S14 Job create/edit — form with validation, address autocomplete (Mapbox geocoding), technician picker, checklist builder.
- S15 Team — user list, invite form, role change, deactivate.
- S16 Company settings — name, timezone, working hours.

### Technician (mobile PWA)
- S20 My Day — list grouped: Overdue, Today (in window order), Later. Each row: time window, customer, address short, status pill, pending-sync dot if applicable.
- S21 Job detail (mobile) — sticky status action bar at bottom (valid next statuses only), customer card (call / navigate), checklist, photos (capture button prominent), notes, signature step on completion.
- S22 Photo capture — camera/file picker, caption field, preview + compress indicator, "Add another" flow.
- S23 Signature — full-width canvas, clear/confirm, signed-by name field.
- S24 Sync status — list of pending/failed outbox items with retry, last synced time.

## Key flows (step-by-step)

### F1 — Dispatcher creates + assigns (happy path)
Dashboard → New Job → fill customer/address/window → pick technician → Save → job appears on board (SCHEDULED) + on technician's My Day + live event to technician if online.

### F2 — Technician day (online)
Open app → My Day → tap first job → En route → Navigate → On site (auto time capture) → In progress → checklist → photos → Complete → Signature → Confirm → job moves to COMPLETED on dispatcher board + PDF queued.

### F3 — Technician day (offline) — the demo flow
Before leaving signal: open My Day (jobs + job details cached to IndexedDB) → go offline (banner appears) → update statuses, checklist, photos, notes, signature (all queued, UI shows "Pending sync") → return to signal → sync runs automatically → pending badges clear one by one → if a conflict occurs, see F4.

### F4 — Conflict on sync (see sync spec for rules)
Sync applies dispatcher reschedule + technician notes (both preserved) → job timeline notes "Sync resolved: schedule updated by dispatcher, notes merged" → technician sees a non-blocking notice on next job open: "This job was updated by [Dispatcher] while you were offline — [what changed]." → technician can review and continue. No data is silently overwritten.

### F5 — Dispatcher handles overdue
Dashboard overdue count → Board filtered to overdue → tap job → Reassign or Reschedule → reason logged → technician sees updated job on next sync / live.

### F7 — Admin reopens a completed job
Job detail (desktop, Admin only) → Reopen → enter required reason → Confirm → job returns to IN_PROGRESS, timeline logs "Reopened by [Admin]: [reason]", previous signature shows as superseded, job sheet shows as superseded pending re-completion. Technician sees the job back on My Day on next sync / live update.

### F6 — Job completion without signature (override)
Technician tries Complete without signature → blocked with explanation → Dispatcher (desktop) can override with a required reason → job completes, timeline logs "Completed by dispatcher override: [reason]", job sheet notes "Signature missing — override by [name]".

## Empty, loading, and error states (must be designed, not left as blank screens)

- No jobs today: "No jobs scheduled today" + "Create job" (dispatcher) / "You're clear — check tomorrow" (technician).
- No search results: show what was searched + "Clear filters" button.
- Offline + no cached job: "This job isn't available offline yet — open it while online to cache it." (Technicians must be taught to open My Day before leaving signal; the app should also auto-cache today's jobs on login when online.)
- Photo upload fails: photo stays in outbox as FAILED with Retry; job completion is blocked only if the photo is required — in MVP photos are not required for completion, signature + checklist are.
- Sync fails (server error): outbox items stay PENDING, banner shows "Sync failed — will retry", manual Retry button, no data loss on reload.

## Visual / interaction notes for build

- Status colours must be consistent everywhere (board, map pins, My Day pills, job header). Define a single `STATUS_STYLES` constant in shared code — do not hardcode colours per screen.
- Priority: URGENT = red badge + top of lists; HIGH = amber; NORMAL/LOW = neutral.
- Photos: grid thumbnails, tap to full view, caption + taken-at + GPS (if present) shown on full view.
- Do not build a custom design system in MVP — Tailwind + a small set of shared components (Button, Card, Badge, JobCard, StatusPill, SyncBadge) is enough. Consistency beats novelty here.
- Wireframes are NOT in this pack as images — build low-fidelity wireframes in Figma or on paper from the screen list above during Phase 1, and attach screenshots to the Phase 1 review before coding screens in Phase 2. Do not skip this step for the technician mobile screens.
