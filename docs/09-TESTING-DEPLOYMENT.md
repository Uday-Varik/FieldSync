# FieldSync — Testing, Deployment & Operations

## 1. Test pyramid (what to test, and what not to over-test)

- **Unit (Vitest, most coverage here):** job state machine, conflict rules (every row in sync spec §4), outbox ordering, idempotency, role/field authorisation, PDF data assembly (not PDF rendering).
- **Integration (API + test DB):** `/sync` batch apply + replay, photo upload URL → confirm flow, Socket.io room authorisation (technician cannot join another company's room), invite accept flow.
- **E2E (Playwright):** dispatcher creates → technician completes (online); offline demo flow (Playwright offline mode + IndexedDB inspection); conflict demo flow; PDF download.
- **Manual (real device, at least once per phase):** technician flow on a real Android + iOS phone, offline in airplane mode, photo capture, signature canvas, PWA install. Emulators alone are not enough for the offline story.

Do NOT chase 100% coverage. Target: 80%+ on `sync`, `jobs` (state machine), and `auth` modules; E2E green for the 5 "done" flows in the index. Coverage elsewhere is a bonus.

## 2. Must-pass test cases (sync — repeat of sync spec, with test IDs)

- SYNC-01 Offline full job completion syncs in order → COMPLETED.
- SYNC-02 Dispatcher reschedule + technician notes offline → both preserved.
- SYNC-03 Dispatcher cancel + technician offline completion → completion rejected, job CANCELLED, notice shown.
- SYNC-04 Same mutation replayed twice → applied once, one audit entry.
- SYNC-05 Two users toggle different checklist items offline → both preserved.
- SYNC-06 App reload mid-sync → no duplicates, no lost items.
- SYNC-07 Photo taken offline → appears on dispatcher view after sync, correct job/caption/timestamp.
- AUTH-01 Technician A cannot read/update Technician B's job (403/404).
- AUTH-02 Technician cannot fetch another company's job or photo URL.
- AUTH-03 Deactivated user cannot sync (403) and cannot log in.
- REOPEN-01 Admin reopens a COMPLETED job with a reason → job is IN_PROGRESS, `completedAt` cleared, old signature superseded, audit shows REOPENED with reason; re-completion captures a new current signature and updates (not duplicates) the job sheet.
- REOPEN-02 Non-Admin reopen attempt is rejected (403); reopen without a reason is rejected (400).
- STATE-01 Every invalid status transition returns 422 with allowed list.

Each test case needs a name, setup, steps, and expected result in the test file — not just an assertion with no context.

## 3. CI/CD (GitHub Actions)

On every PR:
- Install, lint, typecheck (web + API).
- Unit + integration tests (with Postgres + Redis services in CI).
- Prisma migration check (no drift: `prisma migrate diff` clean).

On merge to main:
- Build Docker image for API, deploy to Fly.io (staging first, then production demo on manual approval in Phase 5).
- Deploy web to Vercel (preview on PR, production on main).
- Run Playwright E2E against staging, not production demo, on merge.

Secrets: GitHub Secrets only. No secrets in code, logs, or screenshots in the README/demo video (blur demo keys if they appear).

## 4. Environments & data

| Env | Web | API | DB | Redis | Storage |
|-----|-----|-----|----|-------|---------|
| Local | localhost:3000 | localhost:3001 | Docker Postgres | Docker Redis | Dev R2/S3 bucket |
| Staging | Vercel preview / staging | Fly.io staging | Neon staging branch | Upstash staging | Staging bucket |
| Production demo | Vercel prod | Fly.io prod | Neon prod | Upstash prod | Prod bucket (demo data only) |

- Seed script: `npm run db:seed --workspace=fieldsync-api` (npm workspaces, corrected from pnpm in the Phase 0 audit) — idempotent, demo company only, never runs if `NODE_ENV=production` without `ALLOW_DEMO_SEED=true`.
- Demo reset: a script that wipes demo company data and re-seeds, for when a recruiter/demo user messes up the demo. Document it in README, do not expose it as a public endpoint.

## 5. Monitoring & debugging (MVP, lightweight)

- Structured logs (pino) with `requestId`, `companyId`, `userId`, `jobId` where relevant. Sync failures log `clientMutationId` + reason.
- Sentry for unhandled errors (web + API).
- Health endpoints: `GET /health` (API up), `GET /health/db` (DB + Redis reachable, internal only / not public detailed).
- Sync metrics (log-based in MVP, no dashboard needed): sync requests/day, applied vs conflict vs rejected counts, average batch size. Review these after the demo video — they are good interview numbers if real.
- On-call for a portfolio demo = the builder. Document known limitations in README (single API instance, Yjs snapshot persistence) so a recruiter doesn't mistake a known tradeoff for a bug.

## 6. Release checklist (before sharing the demo link)

- [ ] Seed demo logins work, demo data is realistic and clearly labelled.
- [ ] Offline demo flow recorded and verified on a real phone.
- [ ] No real personal data, no real customer addresses, no secrets in seed or screenshots.
- [ ] README, architecture diagram, sync explanation, and "what I'd do next" are up to date with what was actually built (not what was planned).
- [ ] E2E suite green in CI on the release commit.
- [ ] PDF job sheet downloads for a completed demo job.
