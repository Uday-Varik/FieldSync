# FieldSync — Project Tracking (PROJECTS.md alternative)

One task per task in `08-IMPLEMENTATION-PLAN.md`, labelled by
phase. Status legend:

- `[x]` Done — DoD + tests met, merged to `main` (PR linked).
- `[~]` Partial — code exists, but DoD is not fully met; do not
  close this task until the listed gap is cleared.
- `[ ]` Not started.

A task is closed only when its DoD + tests are met. This file is
updated in the same PR as the work it tracks, and phase check
marks in `08-IMPLEMENTATION-PLAN.md` mirror it.

## Phase 0 — Setup & design

- [x] Monorepo scaffold: `apps/web`, `apps/api`, `packages/shared`.
  Merged: PR #1 (scaffold) + PR #2 (auth module shape). Typecheck passes.
- [~] Tooling: TypeScript strict, ESLint, Prettier, Husky, branch protection.
  Gap: Husky pre-commit is NOT installed (see `15-DECISIONS.md`).
  Branch protection IS done (rule 85465258, main).
- [~] Docker Compose: Postgres + Redis locally. Clerk dev project. R2/S3 dev bucket.
  Gap: `docker-compose.yml` exists, but Docker is not available in
  this VM, so the live run used apt Postgres/Redis instead. Clerk
  dev project and R2/S3 bucket are NOT created (keys outstanding).
- [x] Prisma schema v1 + first migration + seed script.
  Merged: PR #1, migration `20261028072140_init`, seed verified
  (5 users, 18 jobs, documented breakdown).
- [x] Low-fidelity wireframes for technician mobile + dispatcher board.
  In `11-WIREFRAMES-PHASE0.md` (text wireframes, reviewed in audit).
- [x] README skeleton: product, architecture diagram, how to run, demo logins.
  In repo README, merged via PR #1.

Phase 0 verdict: PARTIAL, not fully done — Husky, Clerk dev
project, and R2/S3 bucket are still open, even though the live
run itself was verified.

## Phase 1 — Auth, companies, jobs CRUD

- [x] Clerk integration (web + API verification), company creation, invite flow, role guard, company scoping.
  Merged: PR #2 (API auth + `GET /me`, 7 tests), PR #3 (companies/invites, 12 tests total), PR #6 (web auth, typecheck).
  Gap for live verification only: real Clerk keys + running Postgres outstanding.
- [x] Jobs CRUD + state machine + assignment + search/filter + Admin-only reopen.
  Merged: PR #7 (rebased jobs, supersedes closed PR #4), 6 jobs tests, REOPEN-01/02.
- [x] Checklist CRUD.
  Merged: PR #8 (rebased checklist, supersedes closed PR #5), 3 checklist tests.
- [x] Audit log (interceptor/event) for job actions.
  Implemented as service-level events, not a global HTTP
  interceptor (see `15-DECISIONS.md`, 2026-10-29): JobActivity
  rows are written in the same transaction as the job change on
  create, status change, assign/unassign, cancel, reopen, and
  checklist toggle, and `GET /jobs/:id/activity` is displayed on
  the job detail page. A post-response interceptor would duplicate
  rows and would not be transactional, so it was not built.
- [x] Dispatcher dashboard + board (desktop, no map yet, no realtime yet; manual refresh acceptable in this phase only).
  Merged: PR #10, `/board` grouped by status, search + status filter, manual refresh.
- [x] Technician My Day list (read-only in this phase, online only).
  Merged: PR #10, `/my-day` for today's jobs, read-only; job
  detail shows checklist + audit timeline, with actions hidden
  for technicians in Phase 1.

Phase 1 verdict: DONE (code + unit tests + typecheck), 2026-10-29.
Caveat, kept explicit: live end-to-end verification with real
Clerk keys and a running Postgres is still outstanding (see open
blockers). That does not reopen the code tasks, but Phase 1 must
not be presented as live-verified until that run passes.

## Phase 2 — Technician mobile workflow + photos + signature

- [ ] Mobile job detail: status action bar, call/navigate, checklist toggles, notes (plain text first).
- [ ] Photo capture: client compression, signed upload URL flow, confirm, thumbnail job (BullMQ), photo grid.
- [ ] Signature capture + completion flow (signature required, dispatcher override with reason).
- [ ] PWA setup: manifest, service worker for app shell, install prompt.
- [ ] Job sheet PDF (pdf-lib), generate on COMPLETED, download endpoint. Admin reopen in the completion flow.

## Phase 3 — Realtime + collaborative notes

- [ ] Socket.io gateway, company/job rooms, auth on connect, presence.
- [ ] Live board/map updates: job events invalidate TanStack Query + update board without refresh.
- [ ] Map view (Mapbox): today's jobs + active technicians, click → job drawer.
- [ ] Yjs notes: shared notes document, snapshot persistence, presence in notes editor.
- [ ] Live latency check: technician status change appears on dispatcher board in < 2s.

Timebox note: if Yjs blocks, fall back per the plan (plain notes
+ last-write-wins with audit) and move on — do not let Yjs block
the whole build.

## Phase 4 — Offline-first + sync (DO NOT RUSH)

- [ ] Dexie schema: jobs, outbox, photoBlobs, syncMeta. Auto-cache today's/tomorrow's assigned jobs.
- [ ] Outbox writer: every technician mutation writes local + outbox in one transaction. Optimistic UI + pending badges + offline banner.
- [ ] Sync worker: online event, app start, 30s interval; per-job FIFO, max 3 concurrent jobs; idempotency keys.
- [ ] Server `/sync` endpoint: authorise → idempotency → validate → field-level conflict rules → audit → broadcast.
- [ ] Photo offline: Blob storage, upload-after-metadata flow, retry UI.
- [ ] Conflict UX: dispatcher timeline notes + technician banner + rejected-status notice.
- [ ] Full sync test suite — all 7 must-pass cases green.

Timebox note: if sync blocks, write the blocker here, move to an
independent task, and return — do not let sync block the whole build.

## Phase 5 — Polish, demo, deploy

- [ ] Staging + production deploys (Vercel + Fly.io + Neon + Upstash + R2), env vars, health checks, Sentry.
- [ ] Demo data reset script, demo login instructions in README, 2-minute demo video.
- [ ] README final: architecture diagram, sync explanation with diagram, tradeoffs (ADR summaries), what was cut and why, how to run tests.
- [ ] Accessibility pass: tap targets, contrast, keyboard navigation, screen-reader labels on status buttons.
- [ ] Performance pass: board query indexes verified, photo compression verified, bundle check, Lighthouse PWA check.
- [ ] Final E2E suite green in CI.

## Open blockers (all pending, none faked)

- Real Clerk keys (Phase 1 live auth, web sign-in).
- Mapbox token (Phase 1/3 map).
- S3/R2 bucket (Phase 2 photos/PDF).
- Husky pre-commit (Phase 0 tooling).
- Running Postgres/Redis in this VM (wiped by VM restarts; Docker on a developer machine is the intended route).
