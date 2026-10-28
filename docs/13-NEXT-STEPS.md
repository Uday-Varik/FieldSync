# FieldSync — Next Steps After the Push (do not skip)

**Current state, verified 2026-10-28:**
- Repo: https://github.com/Uday-Varik/FieldSync
- Main HEAD: `5502396` — "Phase 0 scaffold: planning docs, monorepo shape, Prisma schema and demo seed" (36 files), after a provider initial commit.
- Phase 1 feature code is NOT started, per the manager audit gate.

## Step 1 — Branch protection: DONE

Created 2026-10-28 via the browser, rule 85465258 for `main`:
Require a pull request before merging ON, Require approvals OFF,
Require status checks OFF, Do not allow bypassing ON, all other
options OFF. All later work goes through PRs.

## Step 2 — Live run: DONE in this VM, with documented deviations

Run 2026-10-28 in this VM (not Docker, not the user's computer):
- System Postgres 16 + Redis 7 installed via apt, started manually
  (Docker is not available in this VM; versions match docker-compose).
- Prisma engines downloaded via curl and served from a local mirror
  (`PRISMA_ENGINES_MIRROR=http://localhost:8765`), because Node's
  download through the proxy kept resetting. This is a VM workaround
  only, not a repo change.
- `prisma validate`: **passes, engine-verified** ("The schema at
  prisma/schema.prisma is valid").
- `prisma migrate dev --name init`: **passes**, migration
  `20261028072140_init` created by Prisma (not hand-written),
  Prisma Client generated (v5.22.0). First attempt failed P3014
  (shadow DB); fixed by granting the local DB user CREATEDB.
- Seed with `ALLOW_DEMO_SEED=true`: **passes**,
  "Seeded demo company: BrightSpark Electrical — Demo with 5 users
  and 18 jobs", verified in the DB: 5 users, 18 jobs
  (SCHEDULED 5, EN_ROUTE 2, ON_SITE 1, IN_PROGRESS 3, ON_HOLD 1,
  COMPLETED 4, CANCELLED 2; unassigned 3; urgent 2; current
  signatures 1; job sheets 1).
- Typecheck passes for web, API, and shared.
- Dev servers: web :3000 returns 200; API :3001 starts and responds
  (404 for `/` is expected — placeholder AppModule has no routes).
- Scaffold bug found and fixed locally (not yet in the repo):
  `@nestjs/platform-express` was missing from
  `apps/api/package.json`, causing "No driver (HTTP) has been
  selected". It must go in via a PR, not direct to `main`.

Still outstanding (not blockers for the Phase 0 run itself):
- The platform-express fix, the migration folder, and docs 13/14
  are local only and need a PR.
- Husky pre-commit is not installed yet.
- Real Clerk keys are still needed for Phase 1 auth; Mapbox from
  Phase 1/3, S3/R2 from Phase 2. No real keys are in git.

## Step 3 — Next

1. Update `docs/12-PHASE0-AUDIT.md` to mark Phase 0 DONE with the run evidence above.
2. Start Phase 1 as PR 1, in this order, not all at once:
   - Clerk auth + guards + company membership checks
   - Company creation + invite flow
   - Jobs CRUD + state machine + search/filter
   - Admin-only reopen endpoint (reason required, signature supersede)
   - Tests for state machine, guards, and reopen (REOPEN-01/02)

## What NOT to do next

- Do not start Phase 1 code before Step 2 passes — that would bypass the gate you set.
- Do not push directly to `main` after Step 1 — use a branch + PR.
- Do not put real Clerk/Mapbox keys in git, and do not hand-write a migration to "make it work".
