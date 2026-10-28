# FieldSync — User Stories & Acceptance Criteria

Format: As a [role], I want [goal], so that [benefit]. Acceptance criteria are testable — if a criterion cannot be demonstrated in the demo, the story is not done.

Priority: P0 = MVP must-have, P1 = MVP should-have (cut only with user approval), P2 = post-MVP.

## Admin / Owner

**US-A1 (P0) — Create company and invite team**
As an Admin, I want to create my company and invite staff by email, so that dispatchers and technicians can start using FieldSync the same day.
- AC: Company created with name + timezone; invite link works once and expires after 7 days; invited user lands in the correct company with the invited role; expired/revoked invites show a clear error, not a blank page.

**US-A2 (P0) — Deactivate a user**
As an Admin, I want to deactivate a leaver, so that they lose access immediately.
- AC: Deactivated user cannot log in, cannot sync (sync returns 403), and their assigned jobs appear in the unassigned queue for reassignment.

**US-A4 (P0) — Reopen a completed job**
As an Admin, I want to reopen a job completed by mistake, so that it can be corrected without deleting proof of work.
- AC: Only Admin can reopen; a reason is required and is logged in the audit timeline and stored as `reopenReason`; the job returns to IN_PROGRESS with `completedAt` cleared; the previous signature is superseded (not deleted) and a new signature can be captured on re-completion; the next completion updates the existing job sheet record, it does not create a second one.

**US-A3 (P0) — Download job sheet**
As an Admin, I want to download a completed job's PDF sheet, so that I have proof of work for the customer or for records.
- AC: PDF contains job details, times, checklist, photo thumbnails, signature, and technician name; generation status is visible (QUEUED → READY); failed generation can be retried and shows an error, not a broken link.

## Dispatcher

**US-D1 (P0) — Create and assign a job**
As a Dispatcher, I want to create a job and assign it to a technician in under 2 minutes, so that field work starts without phone tag.
- AC: Job appears on the technician's My Day immediately (online) or on their next sync (offline); required fields are validated with field-level errors; unassigned jobs are visible in a dedicated queue.

**US-D2 (P0) — See live board and map**
As a Dispatcher, I want a board and map that update live, so that I know who is en route, on site, or overdue without refreshing or calling.
- AC: Status change by a technician appears on the dispatcher's board in < 2s on a normal connection (demo); map shows active technicians only (privacy rule); overdue jobs are visually distinct.

**US-D3 (P0) — Reassign and reschedule**
As a Dispatcher, I want to reassign or reschedule a job, so that sick leave or delays don't strand a customer.
- AC: Reassignment notifies the new technician (in-app, live) and removes it from the old technician's My Day; reschedule preserves photos, notes, and checklist; both actions are in the audit timeline.

**US-D4 (P0) — Spot problems fast**
As a Dispatcher, I want overdue and unassigned jobs highlighted, so that nothing slips through.
- AC: Board has persistent "Overdue" and "Unassigned" filters/counts; a job past its window end without completion is flagged overdue automatically.

**US-D5 (P1) — Search and filter**
As a Dispatcher, I want to search by customer, address, or technician and filter by date/status/priority, so that I can answer "where is that job?" in seconds.
- AC: Search returns results across title, customer, and address; filters combine (e.g. status + technician + date); empty results state explains what to change.

## Technician (phone-first)

**US-T1 (P0) — See My Day**
As a Technician, I want today's jobs in scheduled order, so that I know my day at a glance.
- AC: My Day shows today's + overdue jobs first, with time window, priority, address, and status; tapping a job opens detail without a full page reload; works offline for jobs already opened/synced to the device.

**US-T2 (P0) — Update status with one tap**
As a Technician, I want one-tap status buttons (En route / On site / In progress / Complete), so that I don't fumble with forms on site.
- AC: Only valid next statuses are shown (state machine); status change is optimistic online and queued offline; invalid transitions are blocked server-side with a clear message.

**US-T3 (P0) — Navigate and contact**
As a Technician, I want navigation and tap-to-call from the job, so that I don't retype addresses or numbers.
- AC: Address opens Google/Apple Maps; phone opens the dialer; both work from the job detail screen.

**US-T4 (P0) — Complete a job offline with proof**
As a Technician, I want to complete a job offline with checklist, photos, and a signature, so that lack of signal never blocks completion.
- AC: All three work offline and are queued; on reconnect they sync in order; the job is not marked COMPLETED on the server until signature + required checklist are present (or a logged dispatcher override exists); user sees per-item sync status.

**US-T5 (P0) — Know what is pending**
As a Technician, I want to see exactly what hasn't synced yet, so that I don't leave site thinking work is saved when it isn't.
- AC: Persistent offline banner when offline; "Pending sync (3)" badge on My Day and job detail; failed items show a retry button and an error reason; a successful sync clears the badge.

**US-T6 (P1) — Collaborative notes**
As a Technician, I want to add notes that the dispatcher can see and edit live, so that context doesn't live in separate texts.
- AC: Notes edited by two users merge (Yjs) without losing either edit; presence shows who else is viewing/editing the job.

**US-T7 (P1) — Checklist**
As a Technician, I want a checklist per job, so that I don't miss steps.
- AC: Checking an item persists offline and syncs; dispatcher-added items appear on next sync; checked-by and checked-at are recorded.

## Cross-cutting

**US-X1 (P0) — Audit trail**
As any authorised user, I want to see a job's history, so that disputes can be resolved from facts.
- AC: Timeline shows actor, action, from → to, and timestamp for status, assignment, completion, and cancellation; timeline is read-only.

**US-X2 (P0) — No silent data loss**
As any user, I want conflicts to be shown, not hidden, so that I trust the system.
- AC: See sync spec §5 for the exact conflict UX; at minimum, a resolved conflict produces a visible note on the job timeline and, for status conflicts, a prompt to the technician on next open.

**US-X3 (P1) — PWA install**
As a Technician, I want to install FieldSync on my home screen, so that it feels like an app.
- AC: Install prompt works on Chrome Android and Safari iOS (within PWA limits); installed app opens to My Day; app shell loads offline.

## Post-MVP backlog (P2, do not start in MVP)

- Customer portal / shareable job sheet link, SMS notifications, recurring jobs, route optimisation, inventory, invoicing/payments, custom reports, native apps, AI summaries.
- Each P2 item needs its own mini-PRD before it is built — do not add them informally during MVP.
