# FieldSync — API Specification

Base URL (MVP): `https://api.fieldsync.example/v1` — replace with real Fly.io URL at build time.
Auth: Clerk session token in `Authorization: Bearer <token>`. Every request is checked for company membership + role by NestJS guards.
Content: JSON, except file uploads (signed URL flow) and PDF download (binary).

## Conventions

- Pagination: `?page=1&limit=20` (limit max 100). Response: `{ data: [...], meta: { page, limit, total, totalPages } }`.
- Errors: `{ error: { code, message, details? } }` with HTTP codes: 400 validation, 401 unauthenticated, 403 forbidden (including wrong company / wrong role), 404 not found (do not leak existence across companies — return 404 for other-company resources), 409 conflict (sync), 422 invalid state transition, 429 rate limited.
- Idempotency: Mutations from the offline outbox MUST send `Idempotency-Key: <clientMutationId>` (UUID generated on the client). Replaying the same key returns the original result without re-applying.
- Timestamps: ISO 8601 UTC. Dates: `YYYY-MM-DD`. Times: `HH:MM`.
- Versioning: `version` on Job is returned on every job read and must be sent on sync mutations (see sync spec).

## REST endpoints — Auth / Company / Users

- `GET /me` — current user + company + role.
- `POST /companies` — create company (Admin flow on signup). Body: `{ name, timezone }`.
- `GET /companies/:id` — Admin/Dispatcher only, own company only.
- `PATCH /companies/:id` — Admin only.
- `POST /companies/:id/invites` — Admin only. Body: `{ email, role }`. Returns invite (token never returned after creation — invite link is emailed / shown once).
- `POST /invites/accept` — Body: `{ token }`. Links Clerk user to company.
- `GET /companies/:id/users` — Admin/Dispatcher. Query: `?role=TECHNICIAN&isActive=true`.
- `PATCH /companies/:id/users/:userId` — Admin only (role, isActive).

## REST endpoints — Jobs

- `GET /jobs` — Query: `status, assignedTechnicianId, date, dateFrom, dateTo, priority, search, page, limit, sort`. Technician role is automatically scoped to their assigned jobs only; unassigned jobs are NOT visible to technicians (decided 2026-10-27).
- `POST /jobs/:id/reopen` — Admin only. Body: `{ reason }` (required). Returns the job back in IN_PROGRESS with `completedAt` cleared and a REOPENED audit entry.
- `GET /jobs/:id` — includes checklist, photos (READY only + own PENDING), signature status, activity timeline (paginated separately if long).
- `POST /jobs` — Admin/Dispatcher. Body: title, description, customer, address, scheduledDate, window, priority, jobType, tags, assignedTechnicianId (optional), checklist labels (optional array).
- `PATCH /jobs/:id` — Admin/Dispatcher/assigned Technician (field-scoped — see below). Body: any editable fields + `expectedVersion` (optional for online edits, required for sync replay).
- `POST /jobs/:id/status` — Body: `{ status, reason? }`. Enforces state machine. Returns job + activity entry.
- `POST /jobs/:id/assign` — Admin/Dispatcher. Body: `{ technicianId }` (or null to unassign).
- `POST /jobs/:id/cancel` — Admin/Dispatcher. Body: `{ reason }`.
- `GET /jobs/:id/activity` — paginated audit timeline.

Field-level authorisation on PATCH (enforce server-side):
- Technician (assigned only): status via `/status` endpoint, checklist toggles, notes (Yjs doc), photos, signature on completion. NOT: assignment, scheduledDate, priority, customer details, cancellation.
- Dispatcher: all except company settings and user management.
- Admin: all.

## REST endpoints — Checklist, Photos, Signatures, Job Sheets

- `POST /jobs/:id/checklist` — Admin/Dispatcher. Body: `{ label }`.
- `PATCH /jobs/:id/checklist/:itemId` — Assigned technician or Dispatcher. Body: `{ isChecked }`.
- `POST /jobs/:id/photos/upload-url` — Body: `{ filename, contentType, fileSizeBytes }`. Returns `{ photoId, uploadUrl, storageKey, expiresAt }`. Photo is PENDING until confirm.
- `POST /jobs/:id/photos/:photoId/confirm` — Body: `{ takenAt, lat?, lng?, caption? }`. Marks READY, queues thumbnail job.
- `DELETE /jobs/:id/photos/:photoId` — soft delete, logged.
- `POST /jobs/:id/signature` — Signature is uploaded as an image via the same signed-URL flow as photos, then this endpoint links it: Body: `{ signedByName, storageKey }`. Do not accept raw base64 in a JSON body for large images.
- `GET /jobs/:id/job-sheet` — returns download URL (signed, short-lived) if READY, or status if QUEUED/FAILED.
- `POST /jobs/:id/job-sheet/regenerate` — Admin/Dispatcher, rate-limited.

## Sync endpoint (see full spec in `07-OFFLINE-SYNC-SPEC.md`)

- `POST /sync` — Body: `{ mutations: [ { clientMutationId, type, jobId, payload, clientVersion, createdAt } ] }` (max 50 per request, in client order). Transactions are per-mutation, applied sequentially (decided 2026-10-27): one rejected mutation does not roll back earlier mutations in the same batch.
- Response: `{ results: [ { clientMutationId, status: APPLIED | CONFLICT_RESOLVED | REJECTED, serverVersion, jobSnapshot?, conflictDetails? } ] }`.
- `GET /sync/status` — last sync time, pending server version per job (used for client reconciliation).
- Replaying the same `clientMutationId` returns the stored result, no side effects.

## WebSocket events (Socket.io)

Client connects with Clerk token. Server joins rooms: `company:<companyId>` and `job:<jobId>` (only for jobs the user is authorised for).

Server → Client:
- `job:created` — `{ job }`
- `job:updated` — `{ job, changedFields, actorId }`
- `job:status_changed` — `{ jobId, from, to, actorId, at }`
- `job:assigned` — `{ jobId, technicianId, actorId }`
- `presence:job` — `{ jobId, userId, name, state: VIEWING | EDITING }`
- `presence:technician` — `{ userId, status: ONLINE | OFFLINE | ON_JOB, jobId?, lat?, lng?, at }` (only while on active job, per PRD privacy rule)
- `sync:applied` — `{ jobId, serverVersion }` (so other clients can refetch)

Client → Server:
- `presence:join-job` / `presence:leave-job` — `{ jobId }`
- `notes:join` / `notes:update` — Yjs updates for the notes document (binary, via Socket.io binary support or a separate Yjs WebSocket provider — decide in Phase 3, keep the event names stable).

Reconnection: Socket.io auto-reconnect with auth refresh. On reconnect, client refetches today's jobs + open job detail (do not trust the socket cache alone).

## Rate limits (MVP, tune in testing)

- Auth / invites: 10/min per IP + per user.
- Sync: 60/min per user (batching is expected, not one request per field).
- Upload URL: 30/min per user.
- General API: 300/min per user.

## Example: create job (request)

```json
POST /jobs
{
  "title": "AC not cooling — 2nd floor",
  "customerName": "Priya Sharma",
  "customerPhone": "+1 555 010 2030",
  "addressLine1": "12 Maple St",
  "city": "Austin",
  "state": "TX",
  "postalCode": "78704",
  "scheduledDate": "2026-11-03",
  "scheduledWindowStart": "09:00",
  "scheduledWindowEnd": "12:00",
  "priority": "HIGH",
  "jobType": "HVAC repair",
  "assignedTechnicianId": "uuid-of-technician",
  "checklist": ["Inspect filter", "Check refrigerant", "Test thermostat"]
}
```
