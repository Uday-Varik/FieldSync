# FieldSync — Data Model

Conventions: All tables have `id` (UUID), `createdAt`, `updatedAt`. All business tables have `companyId` and are always queried scoped to company. Soft delete is NOT used in MVP except for photos (see below) — cancelled jobs stay as records. Timestamps are UTC in the DB; display uses the company timezone.

## Enums

- `Role`: ADMIN, DISPATCHER, TECHNICIAN
- `JobStatus`: SCHEDULED, EN_ROUTE, ON_SITE, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED
- `Priority`: LOW, NORMAL, HIGH, URGENT
- `PhotoStatus`: PENDING, READY, FAILED
- `OutboxStatus` (server side, per applied mutation): APPLIED, CONFLICT_RESOLVED, REJECTED
- `InviteStatus`: PENDING, ACCEPTED, EXPIRED, REVOKED

## Tables

### Company
- `id`, `name`, `timezone` (IANA, e.g. America/Chicago), `workingHoursStart`, `workingHoursEnd` (optional, HH:MM)
- `address`, `phone` (optional, for job sheet header)

### User (our record, linked to Clerk)
- `id`, `clerkUserId` (unique), `email` (unique per company scope in practice), `name`, `phone`
- `companyId` (FK), `role`, `isActive` (boolean — false = cannot log in/sync)
- `avatarUrl` (optional)
- Index: `(companyId, role)`, `(clerkUserId)`

### Invite
- `id`, `companyId`, `email`, `role`, `token` (hashed in DB), `status`, `expiresAt`, `invitedById`, `acceptedUserId` (nullable)
- Index: `(token)`, `(companyId, status)`

### Job (core)
- `id`, `companyId`, `title`, `description`
- `customerName`, `customerPhone`, `customerEmail` (nullable)
- `addressLine1`, `addressLine2` (nullable), `city`, `state`, `postalCode`, `country` (default: as set by company)
- `lat`, `lng` (nullable — set by geocoding on create/update; nullable so a job can exist before geocoding succeeds)
- `scheduledDate` (date), `scheduledWindowStart`, `scheduledWindowEnd` (time)
- `status` (JobStatus), `priority`, `jobType` (free text + tags, e.g. "HVAC repair"), `tags` (string array)
- `assignedTechnicianId` (FK User, nullable — unassigned queue)
- `internalNotes` (text, dispatcher-only in UI; still stored on job, not Yjs)
- `customerNotes` (text, safe to show on job sheet)
- `startedAt`, `completedAt`, `cancelledAt`, `cancelReason` (nullable), `reopenReason` (nullable — required on Admin reopen, stored on the job as well as in JobActivity)
- `version` (integer, incremented on every server-applied mutation — used for sync/conflict detection)
- `lastEditedById`, `lastEditedAt`
- Indexes: `(companyId, scheduledDate, status)`, `(companyId, assignedTechnicianId, scheduledDate)`, `(companyId, status)`, `(companyId, updatedAt)`

### JobStatus rules (state machine)
Allowed transitions:
- SCHEDULED → EN_ROUTE, ON_HOLD, CANCELLED
- EN_ROUTE → ON_SITE, ON_HOLD, CANCELLED
- ON_SITE → IN_PROGRESS, ON_HOLD, CANCELLED
- IN_PROGRESS → COMPLETED, ON_HOLD, CANCELLED
- ON_HOLD → SCHEDULED, EN_ROUTE, ON_SITE, IN_PROGRESS, CANCELLED (return to previous active status is stored in `previousStatus`)
- COMPLETED → IN_PROGRESS via Admin-only reopen, with a required reason logged in JobActivity (decided 2026-10-27). Reopen clears `completedAt`, sets `reopenReason`, supersedes the previous signature (see Signature below), and queues a new job sheet on the next completion by updating the existing JobSheet record — it does not create a second JobSheet row. Photos are retained.
- CANCELLED → (terminal)
Any other transition is rejected with 422 + the allowed list. The client must enforce the same list in UI, but the server is authoritative.

### ChecklistItem
- `id`, `jobId` (FK), `label`, `isChecked`, `checkedById` (nullable), `checkedAt` (nullable), `sortOrder`
- Index: `(jobId, sortOrder)`

### JobNoteDocument (Yjs)
- `id`, `jobId` (unique FK), `yjsSnapshot` (binary, stored as bytes), `updatedAt`, `updatedById`
- Note: This is the shared collaborative notes field only. `internalNotes` and `customerNotes` on Job are NOT Yjs.

### Photo
- `id`, `jobId` (FK), `uploadedById`, `storageKey`, `originalFilename`, `caption` (nullable)
- `lat`, `lng` (nullable, from device at capture), `takenAt`
- `status` (PhotoStatus), `thumbnailKey` (nullable), `fileSizeBytes`, `width`, `height`
- `deletedAt` (nullable — soft delete so a deleted photo can be audited, not served)
- Index: `(jobId, takenAt)`

### Signature
- `id`, `jobId` (FK — multiple rows per job allowed, exactly one current), `storageKey`, `signedByName`, `signedAt`, `capturedById`, `isCurrent` (boolean), `supersededAt` (nullable)
- A job cannot be COMPLETED without a signature in the normal flow; dispatcher override is logged and requires a reason (see user stories).
- On Admin reopen, the previous current signature is superseded (`isCurrent=false`, `supersededAt` set) so re-completion can capture a new signature. The old unique-on-jobId design was removed in the Phase 0 audit because it made reopen + re-complete impossible.

### JobActivity (audit, append-only)
- `id`, `jobId` (FK), `actorId`, `action` (e.g. CREATED, STATUS_CHANGED, ASSIGNED, NOTE_EDITED, PHOTO_ADDED, COMPLETED, CANCELLED, REOPENED)
- `fromValue`, `toValue` (JSON, nullable), `field` (nullable, e.g. "status"), `metadata` (JSON, e.g. offline: true, clientMutationId)
- `createdAt`
- Index: `(jobId, createdAt)`, `(companyId, createdAt)`
- No update/delete API. Ever.

### SyncMutation (server record of applied outbox items)
- `id`, `companyId`, `userId`, `clientMutationId` (unique per user — idempotency key), `jobId`
- `mutationType` (e.g. UPDATE_JOB, UPDATE_STATUS, ADD_CHECKLIST_ITEM, TOGGLE_CHECKLIST, ADD_PHOTO_META, ADD_NOTE)
- `payload` (JSON), `result` (OutboxStatus), `serverVersionAfter` (integer), `conflictDetails` (JSON, nullable)
- `createdAt`
- Index: `(userId, clientMutationId)` unique, `(jobId, createdAt)`

### JobSheet
- `id`, `jobId` (unique FK), `storageKey`, `status` (QUEUED, READY, FAILED), `generatedAt`, `error` (nullable)
- Index: `(jobId)`
- On reopen + re-completion, update this row (status back to QUEUED, new storageKey on generation) — do not create a second row.

## Seed data (for demo + E2E, not production companies)

- Demo company: "BrightSpark Electrical — Demo" (timezone America/Chicago).
- Users: 1 Admin (Ava), 1 Dispatcher (Dan), 3 Technicians (Tina, Tom, Tara).
- Jobs: 18 jobs — 4 past, 9 today, 5 tomorrow. Statuses: SCHEDULED 5, EN_ROUTE 2, ON_SITE 1, IN_PROGRESS 3, ON_HOLD 1, COMPLETED 4, CANCELLED 2. Unassigned: 3. Urgent: 2. Overdue: at least 1 guaranteed (past-date SCHEDULED job); more appear as today's windows pass, so do not claim an exact overdue count.
- One COMPLETED job has 3 demo photos, a current signature, and a READY job sheet (placeholder storage keys, clearly labelled demo). Other completed jobs have checklist state but no demo photos — do not claim every completed job has photos.
- Seed script must be idempotent and runnable with one command; it must never run against a real company DB without an explicit env flag.

## Migrations and data rules

- Prisma migrations, reviewed in PRs, never edited after merge — new migration for every change.
- Backfill rule: adding a non-nullable column requires a default or a two-step migration (add nullable → backfill → make non-nullable).
- No business logic in DB triggers in MVP; logic lives in NestJS where it can be tested.
