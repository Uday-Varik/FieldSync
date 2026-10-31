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

- [x] Mobile job detail: status action bar, call/navigate, checklist toggles, notes (plain text first). (PR #12.)
- [x] Photo capture: signed upload URL flow, confirm, photo grid, soft delete, thumbnail job (BullMQ), client compression. (PRs #16, #18.)

Phase 2 verdict: DONE (code + tests + typecheck), 2026-10-29. Caveat, kept explicit: live end-to-end verification with real Clerk keys, a running Postgres/Redis, and an S3/R2 bucket is still outstanding.
- [x] Signature capture + completion flow (signature required, dispatcher override with reason). (PR #13.)
- [x] PWA setup: manifest, service worker for app shell, install prompt. (PR #14. PNG icons outstanding for full Android installability.)
- [x] Job sheet PDF (pdf-lib), download endpoint. (PR #15. Generated on demand at download, not at completion — see 15-DECISIONS.md. Admin reopen was already in Phase 1.)

## Phase 4 — Offline-first + sync (DO NOT RUSH)

- [x] Dexie schema: jobs, outbox, photoBlobs, syncMeta. Auto-cache today's/tomorrow's assigned jobs. (PR #25.)
- [x] Outbox writer: every technician mutation writes local + outbox in one transaction. Optimistic UI + pending badges + offline banner. (PR #25.)
- [x] Sync worker: online event, app start, 30s interval; per-job FIFO, max 3 concurrent jobs; idempotency keys. (PR #25.)
- [x] Server `/sync` endpoint: authorise → idempotency → validate → field-level conflict rules → audit → broadcast. (PR #24.)
- [x] Photo offline: Blob storage, upload-after-metadata flow, retry UI. (PR #26.)
- [x] Conflict UX: dispatcher timeline notes + technician banner + rejected-status notice. (PR #26.)
- [x] Full sync test suite — all 7 must-pass cases green server-side (46→47 API tests). Live end-to-end demo flow outstanding with live verification. (PRs #24, #26.)

Timebox note: if sync blocks, write the blocker here, move to an
independent task, and return — do not let sync block the whole build.

## Phase 5 — Polish, demo, deploy

- [x] Health endpoints: GET /health (public) + GET /health/db (Clerk-guarded, 503 when the DB is down). (PR #28.)
- [ ] Staging + production deploys (Vercel + Fly.io + Neon + Upstash + R2), env vars, Sentry.
- [ ] Demo data reset script, demo login instructions in README, 2-minute demo video.
- [ ] README final: architecture diagram, sync explanation with diagram, tradeoffs (ADR summaries), what was cut and why, how to run tests.
- [ ] Accessibility pass: tap targets, contrast, keyboard navigation, screen-reader labels on status buttons.
- [ ] Performance pass: board query indexes verified, photo compression verified, bundle check, Lighthouse PWA check.
- [ ] Final E2E suite green in CI.

Status, 2026-10-31: health endpoints done (PR #28, 53 API tests). Live core verification passed Oct 31 (see 15-DECISIONS.md); remaining: deploys, demo reset, README, accessibility, performance, E2E, plus the browser sign-in journey, Yjs server, live photo/PDF, and offline demo flow.

## Open blockers (all pending, none faked)

- Browser sign-in journey with a real Clerk test user, Yjs websocket server, live photo upload/PDF download, full offline demo flow (live core verification — Neon seed, API guards, web boot — passed Oct 31; see 15-DECISIONS.md).
- Husky pre-commit (Phase 0 tooling; Phase 5 slice pending).
- PNG PWA icons (Phase 5 slice pending).
- Running Postgres/Redis in this VM (wiped by VM restarts; live verification uses Neon/Upstash via a loopback TLS proxy — see 15-DECISIONS.md; Docker on a developer machine is the intended route).

## Phase 3 — Realtime + map + Yjs notes

- [x] Socket.io gateway: Clerk auth on connect, company rooms, presence, job:updated emits after DB transactions. (PR #20.)
- [x] Live board: socket.io-client refresh on job:updated, presence list, graceful degradation. (PR #20.)
- [x] Map view: Mapbox map, client geocoding for jobs without coordinates, job drawer, server geocoding on create (MAPBOX_TOKEN, best-effort). (PR #21.)
- [x] Yjs notes: editor with y-websocket provider when configured, Awareness presence, snapshot save/load via /jobs/:id/notes/snapshot to JobNoteDocument.yjsSnapshot. (PR #22; files landed via GitHub web upload after connector push approval cards timed out five times — see DECISIONS.md. package-lock.json not updated in that slice; regenerate with npm install before npm ci.)

Phase 3 verdict: DONE (code + tests + typecheck), 2026-10-30. All API tests 38 passing, API + web typecheck pass. Caveat, kept explicit: live end-to-end verification with real Clerk keys, a running Postgres/Redis, an S3/R2 bucket, a Mapbox token, and a Yjs websocket server is still outstanding (deferred by the user to the next day).

## Phase 4 — Offline-first + sync

- [x] Server /sync: per-mutation transactions, idempotency before authorisation (see DECISIONS.md), field-level conflict rules, audit with offline:true + clientMutationId, job:updated broadcast. (PR #24.)
- [x] Dexie outbox + sync worker + offline caching, offline-capable status/checklist/notes actions, offline banner + pending counts. (PR #25; reconcile() pure functions verified in plain Node.)
- [x] Conflict UX: technician dismissible banner from conflictDetails, persistent rejected notices with Discard, dispatcher timeline entries. Offline photos: Blob storage (warn 200 MB, block 500 MB), ADD_PHOTO_META, upload-after-metadata with storageKey reuse. (PR #26.)

Phase 4 verdict: DONE (code + tests + typecheck), 2026-10-30. All API tests 47 passing, API + web typecheck pass. Caveat, kept explicit: live end-to-end verification with real Clerk keys, a running Postgres/Redis, an S3/R2 bucket, a Mapbox token, and a Yjs websocket server is still outstanding (deferred by the user to the next day), including the full offline demo flow (technician completes a job fully offline, syncs on reconnect, dispatcher sees COMPLETED + PDF) and the live photo upload.

Update, 2026-10-31: live core verification passed (Neon migrate + seed with exact counts, API guards return 401, web returns 200; see 15-DECISIONS.md for the VM-only proxy workaround). Browser sign-in journey, Yjs server, live photo/PDF, and the offline demo flow remain outstanding.
