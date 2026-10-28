# FieldSync — Phase 0 Scaffold

**Status: SCAFFOLD ONLY, not a running app yet.**
Planning is complete in `docs/` (PRD, architecture, data model, API spec, sync spec, implementation plan). This scaffold is Phase 0 from `docs/08-IMPLEMENTATION-PLAN.md`: repo shape, tooling, Docker Compose, Prisma schema, and env templates.

## Locked decisions (2026-10-27)

Next.js + TypeScript (web) / NestJS + TypeScript (API) / PostgreSQL + Prisma / Redis / Socket.io / Yjs for notes only / Mapbox for map + geocoding / Clerk (not Auth.js) / pdf-lib for job sheets / Admin-only reopen with logged reason / Technicians see assigned jobs only / Sync batches are per-mutation transactions, applied sequentially.

## Architecture (text diagram — see docs/02 for the full version)

```
[ Technician phone / Dispatcher desktop ]
        |  HTTPS + WebSocket (Socket.io)
        v
[ Next.js web app ] -- PWA, IndexedDB outbox, service worker
        |  REST + WebSocket
        v
[ NestJS API ]
   |        |        |         |
   v        v        v         v
[Postgres] [Redis] [S3/R2] [Socket.io rooms]
  Prisma    presence   photos    per-company
            queues     signed    + per-job
                       URLs
```

## Demo logins (seed only — replace Clerk ids in Phase 1)

Demo company: BrightSpark Electrical — Demo (America/Chicago).
- Admin: ava@demo.fieldsync
- Dispatcher: dan@demo.fieldsync
- Technicians: tina@demo.fieldsync, tom@demo.fieldsync, tara@demo.fieldsync

These are seed emails only. Real login requires Clerk accounts with those emails; the seed's Clerk ids are placeholders until Clerk is wired up in Phase 1. Do not use these for a real company.

## Run it (requires Docker + keys — not available in this workspace)

1. Copy env templates and fill them in:
   - `cp apps/api/.env.example apps/api/.env`
   - `cp apps/web/.env.example apps/web/.env.local`
2. Start Postgres + Redis: `docker compose up -d`
3. Install: `npm install` (from this root, npm workspaces)
4. Migrate + seed demo data: `npm run db:migrate --workspace=fieldsync-api` then `npm run db:seed --workspace=fieldsync-api`
5. Run: `npm run dev` — web on http://localhost:3000, API on http://localhost:3001

**Still needed before a real run:** Clerk publishable + secret keys, a Mapbox token (needed from Phase 1/3, not for the scaffold itself), and an S3-compatible bucket (R2/S3) for photos. None of those are in this repo, and no secrets should ever be committed.

## What's here, and what isn't

Here: monorepo shape, Docker Compose, Prisma schema matching `docs/03-DATA-MODEL.md`, full demo seed (5 users + 18 jobs, 1 fully equipped completed job), wireframes in `docs/11-WIREFRAMES-PHASE0.md`, tooling configs (TypeScript strict, ESLint, Prettier, .gitignore), shared package with status/priority constants and the state machine, and minimal web/API entry points so the shape is real. Phase 0 audit: see `docs/12-PHASE0-AUDIT.md` — it lists what was fixed and what still blocks full verification.

Not here yet (Phase 1+): auth guards, job CRUD, board, realtime, offline outbox, sync endpoint, PDF generation. Do not present this scaffold as a working product — Phase 0's definition of done (running dev + seeded demo) is NOT yet met in this workspace because Docker is not installed here and no Clerk/Mapbox keys have been provided.
