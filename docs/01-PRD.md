# FieldSync — Product Requirements Document (PRD)

Version: 1.0 — Planning draft, 2026-10-27
Status: Approved for planning; no code yet.

## 1. Problem

Small field service companies (5–50 staff) run dispatch in a mix of phone calls, texts, spreadsheets, and paper. That breaks in exactly the places that matter:

- A technician in a basement, rural site, or new build has no signal, so updates, photos, and signatures are lost or re-entered late.
- A dispatcher cannot see who is actually en route, on site, or stuck — only who last texted back.
- Two people edit the same job (dispatcher reschedules, technician adds notes) and one change silently overwrites the other.
- Proof of work (photos, signature, time on site) lives in someone's camera roll, not attached to the job.

Result: missed appointments, double-bookings, disputes about whether work was done, and hours of admin chasing.

## 2. Product in one sentence

FieldSync is an offline-first, real-time dispatch and job-tracking app that lets dispatchers assign and monitor field jobs, and lets technicians complete jobs from a phone even without signal, with photos, signatures, and proof that syncs correctly when they reconnect.

## 3. Target users

| User | Who they are | Primary need |
|------|--------------|--------------|
| Admin / Owner | Runs the company, 1–3 people | Set up company, invite staff, see completion and ageing, export job sheets |
| Dispatcher | Office-based, assigns and monitors work | Board + map view, assign/reassign fast, see live status and presence, spot overdue jobs |
| Technician | In the field, phone-first, often offline | Today's jobs, one-tap status, navigation, photos, signature, notes that work offline |

Explicitly NOT a target in MVP: the end customer (homeowner/business). They do not log in. They only appear as a job contact.

## 4. MVP scope — IN

### 4.1 Company and team
- Company signup, company profile (name, timezone, working hours).
- Invite by email link; roles: Admin, Dispatcher, Technician.
- Admin can deactivate a user; deactivated users cannot log in or sync.

### 4.2 Jobs (core entity)
- Create, edit, assign, reassign, cancel, and complete jobs.
- Job fields: title, description, customer name, phone, address, scheduled date/time window, priority (Low / Normal / High / Urgent), status, assigned technician(s), job type/tags, internal notes, customer-visible notes.
- Job statuses: `SCHEDULED → EN_ROUTE → ON_SITE → IN_PROGRESS → COMPLETED`, plus `ON_HOLD` and `CANCELLED` from any active status. See state machine in `03-DATA-MODEL.md`.
- Search jobs by customer, address, title, technician, status, and date.
- Filter by date, status, technician, priority.

### 4.3 Dispatcher board and map
- Kanban-style board grouped by status, with drag-and-drop to change status (with confirmation for COMPLETED/CANCELLED).
- Map view showing today's jobs and technician last-known locations (only while on shift / job active — see Privacy in §8).
- Overdue and unassigned queues highlighted at the top.
- Live updates: board and map update without refresh when any user changes a job.

### 4.4 Technician mobile workflow
- "My Day" list: today's jobs in scheduled order, plus overdue.
- Job detail: customer, address with navigation link (Google/Apple Maps), contact tap-to-call, status buttons, notes, checklist.
- Simple per-job checklist (custom per job type in MVP: a free-form list the dispatcher can add).
- Photo capture/upload: up to 20 photos per job, with caption, GPS tag, and timestamp. Compressed on device before upload.
- Signature capture on completion (customer signature on the technician's device).
- Time tracking: automatic check-in on ON_SITE and check-out on COMPLETED, plus manual correction by dispatcher.

### 4.5 Offline-first (the differentiator)
- Technician app works fully for assigned jobs offline: view jobs, change status, add notes/checklist, take photos, capture signature.
- All offline changes go to a durable outbox and sync in order on reconnect.
- Clear offline UI: banner, per-item "Pending sync" state, sync progress, and failed-item retry.
- Conflict handling per `07-OFFLINE-SYNC-SPEC.md` — never silently lose a change.

### 4.6 Realtime collaboration
- Live job status, assignment, and presence updates via WebSocket.
- Collaborative job notes using Yjs (shared notes field only in MVP).
- "Who is viewing/editing this job" presence indicators.

### 4.6b Admin reopen
An Admin can reopen a completed job with a required, logged reason. The job returns to In Progress, the previous signature is superseded (not deleted), and re-completion updates the existing job sheet. This is an Admin-only correction path, not a normal status transition.

### 4.7 Job sheet (proof of work)
- On completion, generate a PDF job sheet: job details, customer, times, technician, checklist, photos (thumbnails), signature, and notes.
- Downloadable by Admin/Dispatcher; shareable link is OUT of MVP (see §5).

### 4.8 Audit and history
- Immutable job activity log: who changed what, when, from what to what (for status, assignment, and completion fields).
- Job history timeline viewable on job detail.

## 5. MVP scope — OUT (non-goals, do not build)

- Payments, invoicing, quotes/estimates, Stripe.
- Customer portal or customer login.
- Recurring jobs / scheduling automation / route optimisation engine.
- In-app chat, SMS, or phone calls (tap-to-call via device only).
- Inventory / parts management.
- Multi-company / franchise hierarchy, or a public marketplace.
- Native iOS/Android apps — PWA only in MVP.
- AI features (auto-summaries, smart scheduling) — explicitly deferred; the AI story for interviews is the sync/realtime architecture, not a chatbot bolt-on.
- Custom reporting builder — only the fixed dashboard in §6.

## 6. Success metrics (MVP demo + portfolio)

Product metrics (to show with seeded demo data):
- Time from job creation to assignment (target demo: < 2 minutes in the happy path).
- Offline-to-synced success rate in the sync test suite: 100% of queued changes applied or surfaced as a conflict — 0% silently dropped.
- Live update latency in demo: job status visible to dispatcher in < 2 seconds on a normal connection.
- Completed job sheet generated in < 10 seconds for a job with 10 photos.

Portfolio metrics (what a recruiter should be able to verify):
- Deployed live demo + seeded demo company (login instructions in README).
- README with architecture diagram, sync explanation, and tradeoffs.
- Test coverage for sync/conflict logic and the job state machine (see `09-TESTING-DEPLOYMENT.md`).
- 2-minute demo video: dispatcher assigns → technician goes offline → completes job → syncs → dispatcher sees PDF.

## 7. User journeys (summary; full flows in `06-UX-FLOWS.md`)

1. **Admin setup:** Sign up → create company → invite dispatcher + technicians → technicians accept → ready to create jobs.
2. **Dispatch:** Dispatcher creates job → assigns technician → technician gets it on My Day → dispatcher watches live status on board/map.
3. **Field completion (offline):** Technician opens job before leaving signal → drives to site → loses signal → marks ON_SITE, completes checklist, takes photos, gets signature → returns to signal → syncs → dispatcher sees COMPLETED + PDF.
4. **Conflict:** Dispatcher reschedules a job while technician is offline editing notes → on sync, both changes are preserved per the field-level rules (status change wins for status; notes merge; user is shown what happened).

## 8. Privacy, safety, and constraints

- Technician location is shown ONLY while they are on an active job (EN_ROUTE / ON_SITE / IN_PROGRESS) or have explicitly toggled "On shift". No 24/7 tracking. Location history is not stored beyond last-known point for active jobs in MVP.
- Photos may contain customers' homes — store them in private storage with signed URLs, never public buckets. Delete on job deletion request (admin action, logged).
- Signatures are proof-of-work data — store as images, do not use them for any other purpose.
- No customer payment data is collected in MVP, by design.
- Accessibility: technician screens must work one-handed, with large tap targets (≥ 44px), high contrast, and no hover-only actions.

## 9. Assumptions

- Users have modern smartphones and a modern browser; PWA install is encouraged but not required.
- One company = one timezone for scheduling in MVP (company timezone setting).
- Demo data is clearly labelled as demo; real companies start empty.
- Internet is intermittent, not permanently absent — sync assumes eventual reconnection within the same day for the demo story.
