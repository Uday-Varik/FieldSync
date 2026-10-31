# FieldSync — Implementation Plan

**Rule for the whole build:** No code before Phase 0 is complete. No phase is "done" until its Definition of Done (DoD) is met, including tests. Estimates are for a solo builder working part-time, focused, with the stack already familiar at a basic level — treat them as planning estimates, not promises. If a phase slips, cut scope from later phases, never from tests for the phase you're in.

Total MVP estimate: **5–7 weeks part-time (15–20 hrs/week)**, or **3–4 weeks full-time**. Do not compress the sync phase — it is the portfolio value.

## Phase 0 — Setup & design (Week 1, ~10–12 hrs)

Tasks:
- [x] Monorepo scaffold: `apps/web` (Next.js), `apps/api` (NestJS), `packages/shared` (types/constants).
- [~] Tooling: TypeScript strict, ESLint, Prettier, Husky pre-commit (lint + typecheck), GitHub repo with branch protection on main. (Husky outstanding — see 16-PROJECT-TRACKING.md; branch protection done.)
- [~] Docker Compose: Postgres + Redis locally. Clerk dev project. R2/S3 dev bucket. (Compose file exists; live run used apt Postgres/Redis in this VM; Clerk + R2 outstanding.)
- [x] Prisma schema v1 (Company, User, Invite, Job, ChecklistItem, Photo, Signature, JobActivity, SyncMutation, JobSheet, JobNoteDocument) + first migration + seed script (demo company, see data model).
- [x] Low-fidelity wireframes for S20/S21 (technician mobile) and S11 (dispatcher board) — paper or Figma, reviewed before coding screens. (Text wireframes in 11-WIREFRAMES-PHASE0.md.)
- [x] README skeleton: product, architecture diagram, how to run locally, demo logins (seed only).

DoD: `docker compose up` + `npm run dev` runs web + API (npm workspaces — the plan previously said pnpm, corrected in the Phase 0 audit to match the scaffold and this environment, where pnpm is not installed); seed creates the full demo company (users + 18 jobs, see data model); README explains how to run it, includes the architecture diagram and demo logins; wireframes exist for mobile + board; tooling configs exist (TypeScript strict, ESLint, Prettier, .gitignore) and the shared package is non-empty. Git repo + branch protection and Clerk dev project creation are external setup steps, not code, and must be done by the user before Phase 0 can be called fully verified — see audit doc.

## Phase 1 — Auth, companies, jobs CRUD (Week 1–2, ~15 hrs)

Tasks:
- [x] Clerk integration (web + API verification), company creation, invite flow, role guard, company scoping on every query. (PR #2, #3, #6; live verification pending real keys.)
- [x] Jobs CRUD + state machine (server-enforced) + assignment + search/filter + Admin-only reopen endpoint (`POST /jobs/:id/reopen`, reason required, signature supersede, job sheet update on re-completion). (PR #7; job sheet update on re-completion is Phase 2 PDF work.)
- [x] Checklist CRUD. (PR #8.)
- [x] Audit log (interceptor/event) for job actions. (Service-level JobActivity events, displayed on job detail — see 15-DECISIONS.md, 2026-10-29.)
- [x] Dispatcher dashboard + board (desktop, no map yet, no realtime yet — manual refresh is acceptable in this phase only, and must be replaced in Phase 3). (PR #10.)
- [x] Technician My Day list (read-only in this phase, online only). (PR #10.)

DoD: Admin can invite, Dispatcher can create/assign/search jobs, Technician sees My Day, invalid status transitions are rejected server-side, audit timeline shows on job detail, unit tests for state machine + guards pass.

## Phase 2 — Technician mobile workflow + photos + signature (Week 2–3, ~18 hrs)

Tasks:
- [x] Mobile job detail: status action bar, call/navigate, checklist toggles, notes (plain text first — Yjs comes in Phase 3). (PR #12.)
- [x] Photo capture: signed upload URL flow, confirm, photo grid, soft delete, thumbnail job (BullMQ), client compression. (PRs #16, #18.)
- [x] Signature capture + completion flow (signature required, dispatcher override with reason). (PR #13.)
- [x] PWA setup: manifest, service worker for app shell, install prompt. (PR #14.)
- [x] Job sheet PDF (pdf-lib), download endpoint. (PR #15. Generated on demand at download, not at completion.)

DoD: A technician can complete a job online end-to-end on a phone (emulated + real device test), PDF downloads with photos + signature, photos are private (signed URLs, not public).

## Phase 3 — Realtime + collaborative notes [x] DONE (code + tests + typecheck), 2026-10-30 (PRs #20, #21, #22; live verification outstanding) (Week 3–4, ~15 hrs)

Tasks:
- [ ] Socket.io gateway, company/job rooms, auth on connect, presence (job viewing/editing, technician on-job status).
- [ ] Live board/map updates: job events invalidate TanStack Query + update board without refresh.
- [ ] Map view (Mapbox): today's jobs + active technicians, click → job drawer.
- [ ] Yjs notes: shared notes document, snapshot persistence, presence in notes editor.
- [ ] Live latency check: manual test that a technician status change appears on dispatcher board in < 2s on a normal connection.

DoD: Two browsers (dispatcher + technician) stay in sync live; notes merge when both edit; presence indicators work; map shows live positions for active jobs only.

## Phase 4 — Offline-first + sync [x] DONE (code + tests + typecheck), 2026-10-30 (PRs #24, #25, #26; live verification outstanding) (Week 4–6, ~20–25 hrs) — DO NOT RUSH THIS

Tasks:
- [x] Dexie schema: jobs, outbox, photoBlobs, syncMeta. Auto-cache today's/tomorrow's assigned jobs on login/My Day open. (PR #25.)
- [x] Outbox writer: every technician mutation writes local + outbox in one transaction. Optimistic UI + pending badges + offline banner. (PR #25.)
- [x] Sync worker: online event, app start, 30s interval; per-job FIFO, max 3 concurrent jobs; idempotency keys. (PR #25.)
- [x] Server `/sync` endpoint: authorise → idempotency → validate → field-level conflict rules → audit → broadcast. Per §07. (PR #24.)
- [x] Photo offline: Blob storage, upload-after-metadata flow, retry UI. (PR #26.)
- [x] Conflict UX: dispatcher timeline notes + technician banner + rejected-status notice. (PR #26.)
- [x] Full sync test suite (see §07.8 + testing doc) — all 7 must-pass cases green server-side; live end-to-end demo flow still outstanding with live verification. (PRs #24, #26.)

DoD: The demo flow works end-to-end offline (see PRD §6): technician completes a job fully offline, syncs on reconnect, dispatcher sees COMPLETED + PDF, and the conflict demo (reschedule vs notes) preserves both changes. No silent data loss in any test case.

## Phase 5 — Polish, demo, deploy (Week 6–7, ~12 hrs)

Tasks:
- [ ] Staging + production deploys (Vercel + Fly.io + Neon + Upstash + R2), env vars, health checks, Sentry.
- [ ] Demo data reset script, demo login instructions in README, 2-minute demo video (script below).
- [ ] README final: architecture diagram, sync explanation with diagram, tradeoffs (ADR summaries), what was cut and why, how to run tests.
- [ ] Accessibility pass: tap targets, contrast, keyboard navigation on desktop, screen-reader labels on status buttons.
- [ ] Performance pass: board query indexes verified, photo compression verified, bundle check, Lighthouse PWA check.
- [ ] Final E2E suite green in CI (see testing doc).

DoD: Live demo URL works for a stranger with seed logins; demo video exists; README answers "what did you build, why is it hard, what would you do next?" without needing the builder in the room.

## Demo video script (2 minutes, record in Phase 5)

0:00–0:20 — Dispatcher creates a job, assigns it, board + map.
0:20–0:50 — Technician phone: My Day, En route, On site.
0:50–1:20 — Go offline (show banner + airplane mode): checklist, photos, signature, Complete. Show "Pending sync (5)".
1:20–1:45 — Go back online: pending clears, dispatcher board updates live to COMPLETED.
1:45–2:00 — Dispatcher downloads PDF job sheet; show conflict case briefly (reschedule preserved + notes merged) if time, otherwise link to a second short clip.

## Task tracking during build

- Use GitHub Issues (or a simple PROJECTS.md) with one issue per task above, labelled by phase. Close an issue only when its DoD + tests are met.
- Keep a `DECISIONS.md` log during build: every deviation from this pack, with date + reason. Interviewers love this, and it prevents "why did you do it that way?" from becoming a guess.
- If stuck for > 2 hours on one task, timebox it, write the blocker in the issue, and move to an independent task — do not let sync or Yjs block the whole build.

Tracking status, 2026-10-29: this plan's check marks now mirror `16-PROJECT-TRACKING.md`. Phase 0 is partial (Husky, Clerk dev project, R2 outstanding); Phase 1 is DONE (code + tests + typecheck, PR #10), with live verification with real Clerk keys still outstanding. Deviations are logged in `15-DECISIONS.md`.

## What to build first if time is short

Cut in this order (never cut sync tests): Map view → Yjs notes (fall back to plain notes + last-write-wins with audit) → PDF thumbnails → Dashboard counts → PWA install polish. Do NOT cut: authz, state machine, offline outbox, conflict rules, audit, PDF job sheet.
