# FieldSync — Phase 0 Manager Audit (Quality & Impact Review)

**Auditor role:** Manager obsessed with quality and impact.
**Date:** 2026-10-27
**Scope audited:** All planning docs (00–11) + scaffold in `apps/`, `packages/`, root configs, Docker Compose, Prisma schema, seed script.
**Facebook connector note:** Not relevant to this task — no Facebook work was done or needed, so no Facebook commands were run.

## Verdict: NO-GO for Phase 1 as a fully verified Phase 0 — CONDITIONAL GO to fix the remaining external setup only

Read that carefully. The docs and scaffold are now much stronger after this audit, and I am satisfied with their internal quality. I am NOT satisfied that Phase 0's own definition of done is met, because its definition requires a running dev environment + seeded demo, and that has not been demonstrated. Starting Phase 1 feature code and calling Phase 0 "done" would be exactly the kind of silent quality slip this audit exists to prevent.

Do not start Phase 1 until the 4 blockers in §4 are cleared. Everything else in §2 is already fixed.

## 1. What was already right (kept, not changed)

- Product scope is tight: one company, 3 roles, no payments / customer portal / invoicing / AI in MVP. That focus is the impact story.
- The hard differentiators are specified, not hand-waved: offline outbox, field-level conflict rules, per-mutation sync transactions, Yjs only for notes.
- Locked decisions were consistent across most docs: pdf-lib, Clerk (not Auth.js), assigned-jobs-only, Admin reopen, Mapbox, per-mutation sync.
- Wireframes for S20, S21, and S11 existed and matched the UX spec.
- Docker Compose, Prisma schema shape, and env templates existed.
- No secrets were committed. Env examples contain placeholders only.

## 2. Critical / major findings — ALL FIXED in this audit

### F1 — CRITICAL: Signature unique-on-jobId broke Admin reopen + re-complete
**Found:** `Signature.jobId` was unique, so after an Admin reopen, a re-completion could never capture a new signature. The reopen decision and the schema contradicted each other.
**Fixed:** Schema now allows multiple signatures per job, exactly one current (`isCurrent`, `supersededAt`). Data model, API spec, sync spec, user stories, UX flows, and tests updated to match. New test: REOPEN-01 / REOPEN-02.

### F2 — CRITICAL: No .gitignore — .env could have been committed
**Found:** No `.gitignore` at all, despite env templates instructing users to copy them to `.env` / `.env.local`.
**Fixed:** `.gitignore` added covering node_modules, build outputs, `.env*`, logs, editor files.

### F3 — MAJOR: Seed script did not seed jobs, despite Phase 0 DoD requiring it
**Found:** Seed created 5 users and then deferred all 18 jobs to "Phase 1", with a comment admitting it.
**Fixed:** Seed now creates the full spec: 5 users + 18 jobs (4 past, 9 today, 5 tomorrow; SCHEDULED 5, EN_ROUTE 2, ON_SITE 1, IN_PROGRESS 3, ON_HOLD 1, COMPLETED 4, CANCELLED 2; unassigned 3; urgent 2), with checklists, plus 3 demo photos, a current signature, and a READY job sheet for one completed job. It is idempotent (deletes demo children, then demo jobs, then recreates) and still refuses to run without `ALLOW_DEMO_SEED=true`.
**Also fixed:** The old seed spec claimed "2 overdue" and "every completed job has photos" — both were false / time-fragile. Docs now say: at least 1 guaranteed overdue (past-date SCHEDULED), more as today's windows pass; only the one equipped completed job has demo photos.

### F4 — MAJOR: Reopen was decided but missing from stories, flows, PRD, and tests
**Found:** Reopen existed in the data model and API spec only. No user story, no UX flow, no PRD section, no test case.
**Fixed:** US-A4 (Admin reopen, with all acceptance criteria), UX flow F7, PRD §4.6b, REOPEN-01/02 tests, and a Phase 1 task for the reopen endpoint. Data model now documents `reopenReason` (which was in the schema but not in the doc) and that re-completion updates the existing JobSheet row instead of creating a second one.

### F5 — MAJOR: Scaffold could not run — missing required Next.js / NestJS files
**Found:** No `apps/web/app/layout.tsx` (required by Next App Router), no root or app tsconfigs, no `next.config`, no `nest-cli.json`, and `packages/shared/` was empty despite the plan promising "types + constants only".
**Fixed:** All of the above added. Shared package now has a real `package.json` and `src/index.ts` with `JOB_STATUSES`, `VALID_NEXT_STATUSES` (including the reopen exception), `STATUS_STYLES`, and `PRIORITY_STYLES` — the single source of truth the UX spec already required. TypeScript is strict in all tsconfigs.

### F6 — MAJOR: Tooling promised in Phase 0 was absent
**Found:** No ESLint, Prettier, or Husky config, despite Phase 0 DoD promising them.
**Fixed:** `.eslintrc.json` and `.prettierrc` added. Husky pre-commit hook itself is NOT added here because this workspace is not a git repo (see §4) — adding a fake hook file without git + install would be theatre, not tooling. The hook must be installed when the repo is created (see blocker B3).

### F7 — MEDIUM: pnpm vs npm drift
**Found:** Implementation plan and testing doc said `pnpm`, scaffold and this environment use npm (pnpm is not installed here).
**Fixed:** Docs corrected to npm workspaces throughout. Decision: do not introduce pnpm as a second package manager just to match an old line in the plan. If the user later prefers pnpm, that is a deliberate migration, not a silent drift.

### F8 — MEDIUM: Main README failed its own Phase 0 DoD
**Found:** README had no architecture diagram and no demo logins, both required by Phase 0 DoD.
**Fixed:** README now has the text architecture diagram and the demo login emails, with the explicit warning that seed Clerk ids are placeholders until Clerk is wired up in Phase 1.

## 3. Validation actually performed (not claimed beyond evidence)

- All 10 JSON configs parse: root, web, api, shared package.json, all tsconfigs, ESLint, Prettier, nest-cli.json.
- Seed job count verified by script inspection: 18 unique job ids, SCHEDULED 5, COMPLETED 4, CANCELLED 2 — matching the corrected data model spec.
- File inventory verified: scaffold now contains layout, configs, shared package, seed, schema, Docker Compose, env templates.
- NOT verified (see §4): Prisma engine validation, `npm install`, `docker compose up`, migrate, seed run, or `npm run dev`. A Prisma CLI validation via `npx prisma validate` was attempted and later completed with a network failure, not a schema error: it failed to download the Prisma schema-engine binary from binaries.prisma.sh ("Proxy connection ended before receiving CONNECT response"). The pipeline's exit code 0 is misleading — it is `tail`'s exit code, not Prisma's. So the schema has been reviewed by hand for relations, but NOT by the Prisma engine. That alone blocks a full sign-off, and it must be re-run where the Prisma binary can be downloaded.

## 4. Remaining blockers — these are why the verdict is NO-GO

These cannot be fixed by editing files in this workspace. They require user / environment action:

- **B1 — No Docker here.** Docker is not installed in this workspace, so Postgres + Redis cannot be started, migrate cannot run, and seed cannot run here. Run Phase 0 verification where Docker is installed.
- **B2 — No Clerk keys, no Mapbox token, no S3 bucket.** Clerk dev project has not been created and no keys have been provided. Mapbox token is needed from Phase 1/3, S3/R2 from Phase 2 — do not fake them.
- **B3 — No git repo, no branch protection, no Husky install.** This workspace is not a git repository. Create the repo, push this scaffold, enable branch protection on main, then install Husky + pre-commit (lint + typecheck).
- **B4 — No engine-verified run.** After B1–B3, run in order and keep the output: `docker compose up -d` → `npm install` → `npm run db:migrate --workspace=fieldsync-api` (this generates the first migration — do NOT hand-write SQL for it, or it can drift from the schema) → `npm run db:seed --workspace=fieldsync-api` with `ALLOW_DEMO_SEED=true` → `npm run dev` → open web on :3000 and confirm the placeholder page + API on :3001 respond. Only then is Phase 0's DoD met.

## 5. Impact check (manager view)

If Phase 1 started on the pre-audit scaffold, the first demo would have hit: a reopen that could never re-complete, a seed that showed an empty board, a Next app missing its layout, and no guard against committing `.env`. Those are exactly the bugs that make a portfolio project look unfinished in an interview, even if the "hard" sync code is good later.

After this audit, the story that survives scrutiny is: scope is tight, the hard part (sync + offline) is specified with test cases, the reopen edge case is designed end-to-end, and the demo data actually matches the spec. That is worth more than starting Phase 1 a day earlier on a broken base.

## 6. What "move forward" means now

1. User clears B1–B4 and pastes the run output (or confirms the repo + keys are set up).
2. Re-run this audit's §3 checks against the live run, including Prisma migrate output and seed counts.
3. Only then mark Phase 0 DONE and start Phase 1 (Clerk auth + jobs CRUD + reopen endpoint, in that order).

Do not start Phase 1 feature code before step 2. Fixing docs is done; verifying the run is not.
