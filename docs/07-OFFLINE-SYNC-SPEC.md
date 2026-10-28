# FieldSync — Offline & Sync Specification (the hard part)

This document is the technical heart of FieldSync. If this spec is not followed, the project becomes "a CRUD app with a PWA badge" — which is exactly what this portfolio is trying to avoid.

## 1. Goals and non-goals

Goals:
- A technician can do a full job offline and lose nothing on reconnect.
- Order matters: status transitions, checklist toggles, and notes must apply in the order the technician did them.
- Conflicts are resolved by explicit rules, logged, and surfaced — never by silently overwriting.
- Replaying a sync (network retry, app reload) never duplicates a change.

Non-goals in MVP:
- Peer-to-peer sync (phone-to-phone without server). All sync goes through the server.
- Real-time collaborative editing of structured fields (assignment, dates). Only free-text notes use CRDT merge.
- Syncing unassigned or other technicians' jobs to a phone. A phone only caches its own assigned jobs + today's unassigned queue metadata if explicitly enabled later (OFF in MVP).

## 2. Client-side architecture

### Local store (IndexedDB via Dexie)
Tables:
- `jobs` — local copy of assigned jobs (full job + checklist + photo metadata + signature metadata).
- `outbox` — ordered queue of mutations not yet confirmed by the server.
- `syncMeta` — lastSyncAt, serverVersion per job, pending counts.

### Outbox item shape
```json
{
  "clientMutationId": "uuid-v4, generated once on the client",
  "type": "UPDATE_STATUS | UPDATE_JOB_FIELDS | TOGGLE_CHECKLIST | ADD_CHECKLIST_ITEM | ADD_NOTE | ADD_PHOTO_META | ADD_SIGNATURE_META",
  "jobId": "uuid",
  "payload": { "...type-specific fields..." },
  "clientVersion": 12,
  "createdAt": "ISO timestamp, client clock",
  "attempts": 0,
  "status": "PENDING | SYNCING | FAILED | APPLIED"
}
```

Rules:
- Write to `jobs` (local) AND `outbox` in the same Dexie transaction. Never write one without the other.
- Outbox is FIFO per job, but jobs are independent — a stuck job must not block other jobs' sync. Sync worker processes per-job queues in parallel (max 3 concurrent jobs), in order within each job.
- On app start and on `online` event, and every 30s while online with pending items, the sync worker runs.
- UI reads pending counts from `syncMeta`, not by scanning the outbox on every render.

### What is cached for offline use
On login (online) and on My Day open (online), auto-cache: today's + tomorrow's assigned jobs, their checklists, photo metadata (not full photo binaries for other jobs — only thumbnails for the current job if already downloaded), and the job notes snapshot.
Explicit rule: a job the technician has never opened while online is NOT guaranteed offline. The UI must say so (see UX spec).

### Photos offline
Photos taken offline are stored as Blobs in IndexedDB (separate `photoBlobs` table, with a size cap: warn at 200 MB total cached, block new captures at 500 MB with a "sync first" message — tune in testing).
On sync: first sync the metadata mutations, then upload photo binaries via signed URLs (see API spec), then confirm. If a photo upload fails, its metadata mutation is NOT marked failed — it stays as a photo upload retry, separate from job field sync.

## 3. Server-side sync intake

Endpoint: `POST /sync` with up to 50 mutations, in client order.

For each mutation, in order, in its own transaction (per-mutation transactions, decided 2026-10-27 — not one transaction for the whole batch):
1. **Authorise:** user is active, belongs to the job's company, and is assigned to the job (or Dispatcher/Admin). If not, result = REJECTED, reason = FORBIDDEN. Do not apply.
2. **Idempotency check:** if `clientMutationId` already exists for this user in `SyncMutation`, return the stored result immediately, no re-apply.
3. **Validate:** payload passes Zod/class-validator schema for its type; status transitions pass the state machine. If not, REJECTED with a validation reason.
4. **Conflict check + apply:** see §4. Apply, increment job `version`, write audit entry (with `offline: true` + `clientMutationId`), store `SyncMutation` record.
5. **Broadcast:** emit Socket.io `job:updated` / `job:status_changed` to authorised room members.

Response includes, per mutation, the new `serverVersion` and, on conflict, a `jobSnapshot` (full job) so the client can reconcile without an extra fetch.

## 4. Conflict resolution rules (field-level, explicit)

The server compares `clientVersion` (the job version the client last saw) with the current server `version`.

- If equal: no conflict, apply directly.
- If server is newer: apply field-level rules below, do NOT reject the whole batch.

| Field / change | Rule when server is newer |
|----------------|---------------------------|
| Status | Server status wins IF the server status is "later" in the workflow than the client's (e.g. dispatcher CANCELLED beats technician EN_ROUTE). Otherwise, if the client's transition is still valid from the current server status, apply the client's transition. If neither is valid, REJECT the status mutation, keep server status, and surface a notice to the technician. Log the decision. |
| Scheduled date / window, assignment, priority | Dispatcher/Admin changes win over technician changes (technicians cannot edit these fields online anyway, so this is mainly a guard). |
| Checklist toggles | Merge by item id: toggles for different items both apply. Toggle for the same item: last server-applied toggle wins, but the event is logged. |
| Checklist additions | Both additions apply (different ids). |
| Photos | Always additive — never conflict. Both sides' photos are kept. |
| Signature | First completed signature wins; a second signature attempt on an already-COMPLETED job is REJECTED with reason ALREADY_COMPLETED. Exception: after an Admin reopen, the previous signature is superseded, so a new signature for the re-completion is allowed and becomes current. |
| Internal / customer notes (structured text fields, not Yjs) | Last-write-wins by server apply time, BUT the overwritten text is preserved in the audit log (`fromValue`) and a timeline note is added: "Note overwritten on sync — previous text preserved in history." |
| Collaborative notes (Yjs document) | CRDT merge — both edits preserved at character level. No rejection. |

**Never do this:** whole-record last-write-wins. If a future change proposes it, it must be rejected in review and this spec cited.

## 5. Conflict UX (what the user sees)

- Dispatcher: job timeline entry — "Sync resolved: [what changed, by whom, what rule applied]". No modal, no interruption.
- Technician: on next open of the affected job after sync, a dismissible banner — "Updated while you were offline: [Dispatcher] rescheduled this job to [new time]. Your notes and photos were kept." Banner content is generated from `conflictDetails` returned by `/sync`, not hardcoded.
- If a status mutation was REJECTED: technician sees a persistent (not toast) notice on the job — "Your status change to X could not be applied because the job is now Y. Please review." — with the current status shown. The job's local copy is reconciled to the server snapshot.

## 6. Reconciliation (client after sync response)

For each result:
- APPLIED: mark outbox item APPLIED, update local job `version` to `serverVersion`, remove from pending count.
- CONFLICT_RESOLVED: same as APPLIED, plus store `conflictDetails` for the banner + timeline display, and if `jobSnapshot` is present, replace the local job copy with it (then re-apply any still-pending later mutations for that job — they are already in order in the outbox).
- REJECTED: mark outbox item FAILED with reason, keep the local change visible but flagged "Not applied — [reason]", offer "Discard local change" (reverts to server snapshot) or "Retry" (only if reason is transient, e.g. network — not for validation/state errors).
- After all results: update `lastSyncAt`, recalculate pending counts, clear the offline banner if no pending items remain.

## 7. Failure modes and recovery

| Failure | Behaviour |
|---------|-----------|
| Network drops mid-batch | Server applied mutations are idempotent; client re-sends the whole batch, server returns stored results for already-applied items. No duplicates. |
| App killed / phone restarted mid-sync | Outbox is in IndexedDB, survives restart. Sync resumes on next launch. |
| Clock skew (client clock wrong) | Server timestamps are authoritative for audit; client `createdAt` is only for ordering within a job's outbox, which is preserved by insertion order, not clock. |
| Photo upload fails after metadata applied | Photo stays PENDING with retry; job fields are unaffected. |
| Server rejects a whole batch (e.g. auth expired) | No mutations in that batch are applied, client re-auths and retries the whole batch. Note: this is different from a per-mutation rejection — if auth passes, mutations are applied per-mutation, so one rejected mutation does not roll back earlier ones. |
| Job deleted/cancelled while offline | Technician's offline edits to a CANCELLED job are REJECTED on sync with reason JOB_CANCELLED, and the job is removed from My Day on reconciliation. |

## 8. Testing this spec (must-pass cases, full list in `09-TESTING-DEPLOYMENT.md`)

1. Offline status sequence (EN_ROUTE → ON_SITE → IN_PROGRESS → COMPLETED + signature) syncs in order and ends COMPLETED.
2. Dispatcher reschedules while technician is offline editing notes → both preserved.
3. Dispatcher cancels while technician is offline completing → technician's completion rejected, job shows CANCELLED, notice shown.
4. Same mutation replayed twice (double-submit) → applied once, audit shows one entry.
5. Two technicians (or dispatcher + technician) toggle different checklist items offline → both toggles preserved.
6. App reload mid-sync → no duplicates, no lost items.
7. Photo taken offline → appears on dispatcher view after sync with correct job, caption, and timestamp.

If any of these fail, the sync feature is not done.
