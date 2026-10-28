# FieldSync — Technical Architecture

## 1. System overview (text diagram)

```
[ Technician phone / Dispatcher desktop ]
        |  HTTPS + WebSocket (Socket.io)
        v
[ Next.js web app (Vercel) ]  -- PWA, IndexedDB outbox, service worker
        |  REST + WebSocket
        v
[ NestJS API (Fly.io) ]
   |        |        |         |
   v        v        v         v
[Postgres] [Redis] [S3/R2] [Socket.io rooms]
  Prisma    presence   photos    per-company
            queues     signed    + per-job
                       URLs
```

Why separate the API from Next.js: the API is the product. It owns authz, the job state machine, sync, and audit. The frontend is a replaceable client. That is also the story that survives a "why not just Next.js API routes?" interview question: separation lets the same API serve a future mobile app and makes sync/queue logic testable in isolation.

## 2. Stack — locked for MVP

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | Next.js 14+ App Router, TypeScript (strict), Tailwind CSS, PWA (next-pwa or Workbox) | Mobile-first, server components for dispatcher views, PWA for install + offline shell |
| Client state | TanStack Query + Zustand (UI/offline state only) | Query cache = server state; Zustand = outbox/sync UI state, not a second database |
| Client offline | IndexedDB via Dexie, service worker | Durable outbox survives reloads; Dexie is a sane IndexedDB wrapper |
| Backend | NestJS, TypeScript, Prisma | Structured modules (jobs, sync, realtime, files), guards/interceptors for authz + audit |
| Database | PostgreSQL (Neon in MVP), Prisma ORM | Relational jobs + PostGIS-ready later; Prisma migrations are reviewable |
| Cache / queues / presence | Redis (Upstash in MVP), BullMQ | Presence TTL, realtime fan-out, PDF + thumbnail background jobs |
| Realtime | Socket.io, rooms per company + per job | Presence, live board, job updates; rooms keep fan-out scoped |
| Collaboration | Yjs for the shared job-notes document only | CRDT merge for free text; structured job fields use the custom rules in the sync spec, not Yjs |
| Maps | Mapbox GL JS | Dispatcher map + geocoding; no routing engine in MVP |
| Files | S3-compatible (Cloudflare R2 or AWS S3), signed URLs | Private storage, client-direct upload after API authorisation |
| Auth | Clerk (MVP) | Email invite + sessions fast; our DB is the authorisation source of truth (role + company membership checked on every request) |
| PDF | Background job with pdf-lib (decided 2026-10-27) | Keeps API request fast; PDF is generated async and attached to the job; no Chromium dependency in Docker |
| Testing | Vitest (unit), Playwright (E2E), MSW for API mocks in frontend tests | Sync logic must be unit-testable without a phone |
| CI/CD | GitHub Actions, Docker for API | Lint + typecheck + unit tests on PR; deploy on merge to main |
| Observability | Structured logs (pino), Sentry (errors), simple health + sync metrics endpoint | Sync failures must be visible, not silent |

## 3. Module map (NestJS)

- `auth` — Clerk webhook/session verification, company membership guard, role guard.
- `companies` / `users` — company, membership, invites.
- `jobs` — CRUD, state machine, assignment, search/filter, history.
- `checklists` — checklist items per job.
- `photos` — signed upload URLs, metadata, delete.
- `signatures` — signature capture storage + attachment to completed job.
- `sync` — outbox intake, idempotency, conflict resolution, sync status. This is a first-class module, not an afterthought in `jobs`.
- `realtime` — Socket.io gateway, rooms, presence.
- `notes` — Yjs document persistence for shared notes (snapshot + updates).
- `job-sheets` — PDF job (BullMQ) + download.
- `audit` — append-only activity log writer used by other modules via an interceptor/event.

Frontend modules mirror this loosely: `jobs/`, `board/`, `map/`, `my-day/`, `sync/` (outbox UI + Dexie layer), `files/` (photo capture/compress/upload).

## 4. Key architectural decisions (ADRs, short form)

**ADR-1: Server is authoritative, client is optimistic.**
The client shows changes immediately, but the server's version + vector clock decides the final state. The client reconciles on sync response. Rationale: a phone can be wrong, offline, or tampered with; the audit log must reflect server truth.

**ADR-2: Field-level conflict rules, not whole-record last-write-wins.**
Different fields have different merge rules (see sync spec). A dispatcher's reschedule must not wipe a technician's photos, and a technician's notes must not wipe a status change.

**ADR-3: Yjs only for free-text notes.**
Using Yjs for every job field would hide business rules (state machine, assignment) inside a CRDT. Structured fields stay in Postgres with explicit rules; Yjs handles the one field where character-level merge is genuinely the right tool.

**ADR-4: Outbox pattern, not direct API retries.**
Every offline mutation is first written to IndexedDB as an outbox item with a client-generated idempotency key. Sync replays the outbox in order. Retrying a raw HTTP call cannot guarantee order or exactly-once semantics.

**ADR-5: No customer data in realtime payloads beyond what the viewer is authorised for.**
Socket rooms are per-company, but every event is filtered by role + assignment: a technician only receives events for jobs they are assigned to (or unassigned jobs in their company if a dispatcher chooses to broadcast availability — OFF by default in MVP).

**ADR-7: Sync batches are per-mutation, not all-or-nothing (decided 2026-10-27).**
Each mutation in a `/sync` batch runs in its own transaction, in client order. A rejected mutation (e.g. an invalid status after a job was cancelled) does not roll back earlier applied mutations in the same batch, and the client retries only the failed items. This matches the per-mutation results in the API spec. Tradeoff: a batch can partially succeed, so partial success must be surfaced in sync UX — it already is, via per-item status and conflict banners.

**ADR-6: Photos go direct to storage, metadata goes through the API.**
The API authorises and signs an upload, the client uploads to storage, then confirms with the API. The API never proxies large photo bytes in the hot path.

## 5. Data flow — the 3 flows that matter

**Online job update:** Client → REST (optimistic UI) → Postgres + audit → Socket.io room broadcast → other clients update via TanStack Query invalidation.

**Offline job update:** Client writes to IndexedDB (local job copy + outbox item) → UI shows "Pending sync" → on reconnect, sync worker sends outbox in order with idempotency keys → server applies/conflicts → client reconciles local copy → UI clears pending state.

**Photo upload:** Client compresses → API returns signed URL + photo record (PENDING) → client uploads to storage → client confirms → API marks READY → thumbnail job queued → dispatcher sees photo.

## 6. Environments

- `local`: Docker Compose for Postgres + Redis; Clerk dev keys; R2/S3 local or dev bucket.
- `staging`: Same shape as production, seeded demo company, used for the demo video.
- `production (demo)`: Vercel + Fly.io + Neon + Upstash + R2. This is the portfolio demo, not a paid SaaS — rate limits and demo-data reset are acceptable and should be documented in the README.

## 7. Security checklist (MVP, must be done, not "later")

- Clerk session verified on every API request; company membership + role checked by guards, not by trusting a client-sent role.
- IDOR tests: Technician A cannot read/update Technician B's job, cannot fetch another company's photos via signed URL guessing (signed URLs are short-lived and scoped).
- Signed upload URLs expire (15 min) and are scoped to one job + one user.
- Audit log is append-only in code (no update/delete endpoint).
- Secrets only via environment variables; no secrets in the repo, no Clerk keys in client code beyond the publishable key.
- Rate limiting on auth, invite, and sync endpoints.

## 8. What will NOT scale in MVP (and that's fine, say so in interviews)

- Single NestJS instance + single Redis in MVP; Socket.io rooms will need a Redis adapter for multi-instance scale later. Name this tradeoff in the README.
- Yjs persistence is snapshot-based in MVP, not a full Yjs history server.
- Map rendering is client-side; no server-side geospatial queries beyond basic distance sorting in Phase 5 (stretch).
