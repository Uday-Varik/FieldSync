'use client';

import { getDb, type OutboxItem } from './offline-db';
import { apiCall } from './api-client';
import { buildSyncPayload, groupByJob, reconcile } from './sync-reconcile';

/**
 * Phase 4 outbox writer + sync worker (docs/07 §2–§3).
 *
 * - enqueueMutation writes to the outbox AND updates the
 *   cached job copy in the same Dexie transaction: never
 *   one without the other. The cached copy is updated
 *   optimistically with the mutation's own fields, so an
 *   offline job view shows the technician's own change.
 * - syncPending groups pending items per job (FIFO within
 *   a job, jobs independent, max 3 concurrent jobs) and
 *   POSTs each job's queue to /sync. Results are applied
 *   through the pure reconcile() rules.
 * - startSyncWorker runs on app start, on the `online`
 *   event, and every 30s while online with pending items.
 * - A job never opened online is not guaranteed offline:
 *   cacheJobs is called from My Day / job detail while
 *   online, and only cached jobs are available offline.
 */

export function newClientMutationId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function enqueueMutation(
  type: OutboxItem['type'],
  jobId: string,
  payload: Record<string, any>,
  clientVersion: number,
  localPatch?: Record<string, any>,
): Promise<OutboxItem> {
  const db = getDb();
  const item: OutboxItem = {
    clientMutationId: newClientMutationId(),
    type,
    jobId,
    payload,
    clientVersion,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: 'PENDING',
  };
  await db.transaction('rw', db.jobs, db.outbox, db.syncMeta, async () => {
    const id = await db.outbox.add(item);
    item.id = id as number;
    if (localPatch) {
      const cached = await db.jobs.get(jobId);
      if (cached) {
        await db.jobs.put({
          ...cached,
          job: { ...cached.job, ...localPatch },
          cachedAt: new Date().toISOString(),
        });
      }
    }
    const pending = await db.outbox.where('status').equals('PENDING').count();
    await db.syncMeta.put({ key: 'pendingCount', value: pending });
  });
  return item;
}

export async function cacheJobs(jobs: any[]) {
  const db = getDb();
  const now = new Date().toISOString();
  await db.transaction('rw', db.jobs, db.syncMeta, async () => {
    for (const job of jobs) {
      await db.jobs.put({ id: job.id, job, serverVersion: job.version ?? 0, cachedAt: now });
    }
    await db.syncMeta.put({ key: 'lastCacheAt', value: now });
  });
}

export async function cacheJob(job: any) {
  await cacheJobs([job]);
}

async function syncOneJob(getToken: () => Promise<string | null>, jobId: string, items: OutboxItem[]) {
  const db = getDb();
  const batch = items.slice(0, 50);
  for (const item of batch) {
    await db.outbox.update(item.id!, { status: 'SYNCING', attempts: (item.attempts ?? 0) + 1 });
  }
  const token = await getToken();
  const res = await apiCall(token, '/sync', 'POST', { mutations: buildSyncPayload(batch) });
  const { applied, failed, conflicts, versionUpdates } = reconcile(res.results ?? [], batch);

  await db.transaction('rw', db.jobs, db.outbox, db.syncMeta, async () => {
    for (const a of applied) {
      if (a.id !== undefined) await db.outbox.delete(a.id);
    }
    for (const f of failed) {
      if (f.id !== undefined) {
        await db.outbox.update(f.id, { status: 'FAILED', error: f.reason, conflictDetails: { reason: f.reason } });
      }
    }
    for (const [id, version] of versionUpdates) {
      const cached = await db.jobs.get(id);
      if (cached) await db.jobs.put({ ...cached, serverVersion: version, job: { ...cached.job, version } });
    }
    for (const c of conflicts) {
      if (c.jobSnapshot) {
        await db.jobs.put({ id: c.jobId, job: c.jobSnapshot, serverVersion: c.jobSnapshot.version ?? 0, cachedAt: new Date().toISOString() });
      }
      const existing = (await db.syncMeta.get('conflicts'))?.value ?? [];
      await db.syncMeta.put({ key: 'conflicts', value: [...existing, c] });
    }
    const pending = await db.outbox.where('status').equals('PENDING').count();
    await db.syncMeta.put({ key: 'pendingCount', value: pending });
    await db.syncMeta.put({ key: 'lastSyncAt', value: new Date().toISOString() });
  });
  return { applied: applied.length, failed: failed.length, conflicts: conflicts.length };
}

export async function syncPending(getToken: () => Promise<string | null>) {
  if (typeof window === 'undefined' || !navigator.onLine) return { applied: 0, failed: 0, conflicts: 0, skipped: true };
  const db = getDb();
  const pending = await db.outbox.where('status').equals('PENDING').toArray();
  if (pending.length === 0) return { applied: 0, failed: 0, conflicts: 0, skipped: false };
  const groups = groupByJob(pending);
  // Max 3 concurrent jobs; FIFO within each job is
  // preserved because each job's queue is one batch.
  const entries = [...groups.entries()];
  const totals = { applied: 0, failed: 0, conflicts: 0 };
  for (let i = 0; i < entries.length; i += 3) {
    const chunk = entries.slice(i, i + 3);
    const results = await Promise.all(
      chunk.map(([jobId, items]) =>
        syncOneJob(getToken, jobId, items).catch(() => {
          // A failed batch (network drop) leaves items
          // SYNCING; reset them to PENDING so the next
          // run retries. Server-side idempotency makes
          // the re-send safe.
          void (async () => {
            for (const item of items) {
              if (item.id !== undefined) await db.outbox.update(item.id, { status: 'PENDING' });
            }
          })();
          return { applied: 0, failed: 0, conflicts: 0 };
        }),
      ),
    );
    for (const r of results) {
      totals.applied += r.applied;
      totals.failed += r.failed;
      totals.conflicts += r.conflicts;
    }
  }
  return { ...totals, skipped: false };
}

export function startSyncWorker(getToken: () => Promise<string | null>): () => void {
  let stopped = false;
  const run = () => {
    if (stopped) return;
    void syncPending(getToken).catch(() => {});
  };
  run();
  const onOnline = () => run();
  window.addEventListener('online', onOnline);
  const interval = setInterval(run, 30000);
  return () => {
    stopped = true;
    window.removeEventListener('online', onOnline);
    clearInterval(interval);
  };
}
