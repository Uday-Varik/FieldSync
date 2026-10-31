# FieldSync — Planning Pack Index

**Project:** FieldSync — offline-first, real-time dispatch and job tracking for field service teams (electricians, HVAC, solar installers, plumbers).
**Status:** BUILDING — Phases 1–4 DONE (code + tests + typecheck; PRs #2–#26, main at `4feb50e2`); live end-to-end verification outstanding. See `16-PROJECT-TRACKING.md` for the current task status; the original planning-only note is superseded by the build.
**Chosen from:** Project 1 of the 3 standout portfolio projects (FieldSync / ClauseWise / FixMap).
**Goal of this pack:** Anyone (including a future build session) can start building without re-deciding scope, stack, data model, or sync rules.

## How to use this pack

1. Read this index, then `01-PRD.md` for what we are building and what we are NOT building.
2. Read `02-ARCHITECTURE.md` and `07-OFFLINE-SYNC-SPEC.md` before writing any sync, queue, or realtime code — those are the hard parts and the interview talking points.
3. Build in the order in `08-IMPLEMENTATION-PLAN.md`. Do not jump to maps, PDF generation, or payments before Phase 1–2 are done and tested.
4. Open questions are in `10-RISKS-OPEN-QUESTIONS.md`. Nothing in the "Decisions needed before build" section should be guessed during coding — ask the user first.

## Documents in this pack

| # | File | What it answers |
|---|------|-----------------|
| 01 | `01-PRD.md` | Problem, users, MVP scope, non-goals, success metrics |
| 02 | `02-ARCHITECTURE.md` | System diagram in text, services, stack, auth, infra, ADRs |
| 03 | `03-DATA-MODEL.md` | Tables, fields, indexes, enums, seed data |
| 04 | `04-API-SPEC.md` | REST endpoints, WebSocket events, errors, pagination, auth |
| 05 | `05-USER-STORIES.md` | User stories with acceptance criteria, by role |
| 06 | `06-UX-FLOWS.md` | Screens, flows, offline states, mobile-first rules |
| 07 | `07-OFFLINE-SYNC-SPEC.md` | Offline queue, conflict resolution, CRDT scope, recovery |
| 08 | `08-IMPLEMENTATION-PLAN.md` | 5 phases, tasks, estimates, definition of done, demo script |
| 09 | `09-TESTING-DEPLOYMENT.md` | Test pyramid, sync test cases, CI/CD, environments, monitoring |
| 10 | `10-RISKS-OPEN-QUESTIONS.md` | Risks, mitigations, decisions still open |
| 15 | `15-DECISIONS.md` | Every deviation from this pack, with date + reason |
| 16 | `16-PROJECT-TRACKING.md` | One task per plan task, phase-labelled, DoD/test status (PROJECTS.md alternative to GitHub Issues) |

## Locked decisions (do not change without noting why)

- **Product:** One company (tenant) with 3 roles: Admin, Dispatcher, Technician. No multi-tenant billing, no customer portal in MVP.
- **Frontend:** Next.js (App Router) + TypeScript + Tailwind, mobile-first PWA.
- **Backend:** NestJS (Node.js + TypeScript) — separate from the frontend, so the API is a real product API, not Next.js route handlers only.
- **Database:** PostgreSQL + Prisma. Redis for presence, realtime fan-out, and job queues.
- **Realtime:** Socket.io (WebSocket) for presence and job updates. Yjs only for collaborative job notes (see sync spec).
- **Offline:** IndexedDB on the client + a durable outbox queue + service worker caching for app shell and assigned jobs.
- **Maps:** Mapbox for dispatcher map and technician navigation links (no custom routing engine in MVP).
- **Files:** S3-compatible object storage (R2/S3) for photos, with signed upload URLs and image compression on the client.
- **Auth:** Clerk for MVP speed (Auth.js NOT chosen, confirmed 2026-10-27), with roles stored in our own database as source of truth for authorization.
- **PDF engine:** pdf-lib (confirmed 2026-10-27) — lighter, manual layout, no Chromium in Docker.
- **Completed jobs:** Admin can reopen a completed job, with a required reason logged in the audit trail (confirmed 2026-10-27).
- **Technician visibility:** Technicians see only their assigned jobs, not the unassigned queue (confirmed 2026-10-27).
- **Geocoding:** Mapbox (chosen as best for MVP, 2026-10-27) — same provider as the map, so geocoding, autocomplete, and map pins stay consistent; free-tier scale is enough for a demo.
- **Sync batch transactions:** Per-mutation transactions, applied sequentially within a batch (chosen as best for MVP, 2026-10-27) — one bad mutation must not wipe earlier good offline work; see `07-OFFLINE-SYNC-SPEC.md` §3.
- **Deployment (MVP):** Frontend on Vercel, API on Fly.io, Postgres on Neon, Redis on Upstash. Docker for the API, GitHub Actions for CI/CD.
- **Payments:** OUT of MVP. No Stripe, no invoicing. Job completion generates a PDF job sheet only.

## What "done" means for MVP

A stranger can, without help from the builder:
1. Sign up a company, invite a dispatcher and 2 technicians.
2. Create jobs, assign them, and see them on a dispatcher map/board.
3. As a technician on a phone, go offline, update a job, take photos, collect a signature, and have it sync correctly when back online — including a conflict case.
4. See live status/presence updates without refreshing.
5. Download a completed job sheet as PDF.

If any of those 5 fails, MVP is not done, even if the UI looks finished.

## Naming

- Product: FieldSync
- Repo (suggested): `fieldsync`
- App folders (suggested, to be created at build time only): `apps/web`, `apps/api`, `packages/shared` (types + constants only).
