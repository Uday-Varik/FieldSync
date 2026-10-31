# FieldSync

Offline-first, real-time dispatch and job tracking for field service teams. A dispatcher creates and assigns jobs on a desktop board; technicians work them on a phone, including fully offline, and everything reconciles when the phone comes back online.

**Status:** Phases 0–5 are built, tested, and merged (53 API tests, API + web typecheck green). The live demo URL is not deployed yet — see [Demo](#demo). The planning pack in `docs/` is the spec this was built against; where the build deliberately diverged from the plan, the divergence is logged in `docs/15-DECISIONS.md` and noted below.

## Demo

Live demo URL: **TBD — deployment is the remaining Phase 5 work.** The demo runs on the seeded demo company below once deployed.

Demo company: BrightSpark Electrical — Demo (America/Chicago). Sign in with the Clerk test users for this company:

| Role | Email |
|---|---|
| Admin | ava@demo.fieldsync |
| Dispatcher | dan@demo.fieldsync |
| Technician | tina@demo.fieldsync |
| Technician | tom@demo.fieldsync |
| Technician | tara@demo.fieldsync |

Passwords for the Clerk test users live in the Clerk dashboard. They are never in this repo, and the seed stores placeholder Clerk ids — the demo logins only work once real Clerk test users exist with these emails.

Reset the demo data any time (wipes only the demo company, then re-seeds it):

```sh
ALLOW_DEMO_SEED=true npm run db:reset-demo --workspace=fieldsync-api
```

The 2-minute demo flow: dispatcher creates and assigns a job (board + map) → technician opens My Day, goes En route / On site → phone goes offline (banner shows, checklist + photos + signature + Complete queue up, pending count grows) → phone comes back online (pending clears, dispatcher board updates live to COMPLETED) → dispatcher downloads the PDF job sheet.

## What it does

- **Board** (`/board`): jobs grouped by status, with search and status filter, updating live over Socket.io.
- **My Day** (`/my-day`): a technician's assigned jobs for today, read-only list plus status actions on the job page.
- **Job detail**: checklist, photos, signature capture, job notes (collaborative Yjs notes with snapshot persistence), activity/audit timeline, PDF job sheet download.
- **Map** (`/map`): today's jobs on Mapbox, with server-side geocoding on create (best-effort) and client-side fallback.
- **Offline-first**: status, checklist, notes, and photos queue in an IndexedDB outbox (Dexie) and sync in order when connectivity returns. A job never opened online is not guaranteed offline — caching happens on login and My Day/job open.
- **State machine**: SCHEDULED → EN_ROUTE → ON_SITE → IN_PROGRESS → COMPLETED, with ON_HOLD and CANCELLED from the working states. Invalid transitions return 422. Completed jobs can be reopened by an Admin only, with a required logged reason.
- **Roles**: Admin, Dispatcher, Technician. Technicians see assigned jobs only. Every request checks company membership and role server-side; other-company resources return 404 so existence is not leaked.
- **PWA**: installable (PNG 192/512 icons + SVG fallback), app-shell service worker that never caches API/Clerk/job pages, `/offline` fallback page.
- **Health**: `GET /health` (public liveness) and `GET /health/db` (Clerk-guarded readiness; 503 when the database is down).

## Architecture

```
[ Technician phone / Dispatcher desktop ]
        |  HTTPS + WebSocket (Socket.io)
        v
[ Next.js 14 web app ] -- PWA, Dexie outbox, service worker
        |  REST + WebSocket
        v
[ NestJS 10 API ]
   |        |        |         |
   v        v        v         v
[Postgres] [Redis] [S3/R2] [Socket.io rooms]
  Prisma    BullMQ   photos    per-company
            thumbs   signed    + per-job
                     URLs
```

Stack, as built: Next.js 14 App Router + TypeScript + inline styles (no Tailwind, no TanStack Query — server components + `router.refresh()` cover the views); NestJS + TypeScript + Prisma 5; PostgreSQL; Redis + BullMQ (thumbnail queue only); Socket.io (single instance, no Redis adapter); Yjs for job notes only; Dexie for the offline outbox; Mapbox; Clerk; pdf-lib; Jest + ts-jest for tests; Husky pre-commit hook (typecheck).

API modules: `auth` (Clerk verification, company/role guards), `companies` (creation + invites, SHA-256 hashed, 7-day expiry), `jobs` (CRUD, state machine, assign/cancel/reopen, PDF job sheets), `checklist`, `photos` (signed URLs, thumbnails), `sync` (the outbox intake — a first-class module, not an afterthought in `jobs`), `realtime` (Socket.io gateway, company rooms, presence), `health`.

## Why the sync is hard: how offline sync works

```
Phone offline                     Phone back online
  status/checklist/notes/photo      sync worker (app start,
  -> local job copy + outbox       online event, 30s timer)
     item (uuid idempotency key)     -> POST /sync (max 50,
  UI: "Pending sync (n)"              client order)
                                       -> per-mutation transaction
                                       -> applied / conflict-resolved
                                          / rejected, per item
                                       -> client reconciles
                                       -> pending clears
```

The server is authoritative and the client is optimistic. There is no whole-record last-write-wins. Each field has its own rule:

| Field | Rule |
|---|---|
| Status | Only valid from the current status; CANCELLED wins over a late completion |
| Schedule / assignment / priority | Dispatcher wins |
| Checklist | Merged by item id; different-item toggles both survive |
| Notes | Last write wins, old text kept in the audit trail |
| Photos | Additive, never conflict |
| Signature | First current signature wins, unless an Admin reopened the job |

Idempotency is checked **before** authorisation, on `[userId, clientMutationId]`, so replaying a batch returns the stored result instead of duplicating work or audit entries. Sync batches are per-mutation transactions applied sequentially: one rejected mutation never rolls back earlier good offline work, and partial success is surfaced in the UI (dispatcher timeline entries, technician conflict banner, persistent rejected-status notices with Discard, never Retry — server rejections are not transient).

Photos upload in two steps: the API authorises and signs an upload (upload URLs live 10 minutes, download URLs 1 hour, scoped to one job), the client uploads direct to storage, then confirms. The client compresses before upload (downscale + JPEG 0.8); the server makes 300px thumbnails with Jimp over BullMQ. Redis is best-effort by design: a Redis outage never fails a photo confirm.

## Tradeoffs (short ADRs)

- **Server authoritative, client optimistic.** A phone can be wrong, offline, or tampered with; the audit log reflects server truth.
- **Field-level conflict rules, not whole-record LWW.** A reschedule must not wipe photos; notes must not wipe a status change.
- **Yjs only for free-text notes.** Structured fields stay in Postgres with explicit rules; Yjs handles the one field where character-level merge is the right tool. Persistence is snapshot-based (`JobNoteDocument.yjsSnapshot`); the live `y-websocket` provider is used only when `NEXT_PUBLIC_YJS_WS_URL` is set, and no Yjs server is in this repo.
- **Outbox pattern, not raw retries.** Every offline mutation is written to IndexedDB with a client-generated idempotency key and replayed in order (per-job FIFO, max 3 concurrent jobs).
- **PDF on demand, not a background job.** The job sheet is generated with pdf-lib when downloaded, not at completion. One `JobSheet` row per job; re-completion after an Admin reopen updates it, never duplicates it.
- **Audit as service-level events, not a global interceptor.** Every mutation writes a transactional `JobActivity` row with the actor, field, and before/after values, including `offline: true` + `clientMutationId` for synced work.
- **Single API instance for realtime.** Socket.io rooms are per-company with no Redis adapter in MVP; multi-instance scale needs the adapter later.

Full decision log with dates and reasons: `docs/15-DECISIONS.md`.

## What was cut, and what is next

Cut from the MVP scope (locked in the PRD): payments, invoicing, a customer portal, recurring jobs, route optimisation, inventory, in-app chat/SMS, native apps, and any AI bolt-on. A technician queue/claiming flow was also cut — technicians see assigned jobs only.

Still to do: deploy (Vercel web + Fly.io API + Neon/Upstash/R2 staging and production, GitHub Secrets only), Sentry error reporting (planned, not wired — no Sentry code in the repo yet), a Playwright E2E suite against staging (needs a staging URL + Clerk test credentials), a `y-websocket` server for live multi-user notes, and the demo video. CI runs typecheck, tests, and a migration-drift check on every PR; lint is not in CI yet because neither workspace has an ESLint config.

Known limitations: single NestJS instance (see tradeoffs); the signature canvas is pointer/touch only — keyboard users complete via dispatcher/admin override with a reason; the Neon free tier sleeps when idle, so the first request after idle can be slow; a job never opened online is not guaranteed available offline.

## Run it locally

Prerequisites: Node 20+, npm, and either Docker (Postgres + Redis via `docker-compose.yml`) or hosted equivalents (Neon + Upstash — the values below work with any Postgres/Redis URL). No secrets are in this repo; copy the templates and fill them in.

```sh
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Fill in: DATABASE_URL, REDIS_URL, CLERK_SECRET_KEY,
# CLERK_PUBLISHABLE_KEY / NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
# MAPBOX_TOKEN / NEXT_PUBLIC_MAPBOX_TOKEN,
# S3_ENDPOINT, S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID,
# S3_SECRET_ACCESS_KEY, S3_FORCE_PATH_STYLE
docker compose up -d        # or point DATABASE_URL / REDIS_URL at hosted services
npm install                 # from the repo root (npm workspaces)
npm run db:migrate --workspace=fieldsync-api
ALLOW_DEMO_SEED=true npm run db:seed --workspace=fieldsync-api
npm run dev                 # web http://localhost:3000, API http://localhost:3001
```

Notes: the web app needs `CLERK_SECRET_KEY` in `.env.local` too — the `@clerk/nextjs` middleware requires it, and without it every page returns 500. The seed is idempotent for the company/users and refuses to run without `ALLOW_DEMO_SEED=true`; it never runs demo data against a real company. Mapbox and S3 are optional at boot with graceful degradation (map falls back to a list; photo upload returns 503 `STORAGE_NOT_CONFIGURED`), but the map and photos features need them. `NEXT_PUBLIC_YJS_WS_URL` is optional; snapshot notes work without it.

## Tests

```sh
npm run test --workspace=fieldsync-api   # Jest: 53 tests (state machine, authz, sync rules, photos, health)
npm run typecheck --workspaces --if-present
```

The sync suite covers the seven must-pass cases from `docs/07-OFFLINE-SYNC-SPEC.md` server-side (ordered completion, reschedule-vs-notes, cancel-vs-completion, replay idempotency, checklist merge, reload mid-sync, offline photo). The full offline demo flow (phone in airplane mode, sync on reconnect) is verified manually, not in CI — see Known limitations and the demo section. CI (`.github/workflows/ci.yml`) runs install, typecheck, tests, `prisma migrate deploy`, and a migration-drift check (`prisma migrate diff --exit-code`) against Postgres + Redis services on every PR and push to main. A Husky pre-commit hook runs the workspace typechecks.

## Security notes (as built)

- Clerk session verified on every API request except `GET /health`; company membership and role are checked by guards, never trusted from the client.
- Signed upload/download URLs are short-lived and scoped to one job; upload-url accepts a `storageKey` only for an existing PENDING photo row for that job.
- The audit log has no update/delete path in code.
- Secrets only via environment variables. `.env` files are gitignored and must never be committed. The `S3_*` values sign requests (SigV4) — never paste them into chat or logs.
- No rate limiting is implemented yet; the API spec reserves 429 for it.

## Docs

Full planning pack: `docs/00-INDEX.md` (index) → PRD (`01`), architecture (`02`), data model (`03`), API spec (`04`), wireframes (`11`), testing/deployment (`09`), implementation plan (`08`), offline-sync spec (`07`), decisions (`15`), tracking (`16`).
