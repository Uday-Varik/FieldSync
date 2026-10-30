'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDb } from '../lib/offline-db';

// Phase 4 conflict UX (docs/07 §5).
//
// - Conflict banner: after a sync that resolved a
//   conflict, the technician sees a dismissible banner
//   on the affected job, with content generated from
//   the stored conflictDetails — not hardcoded. The
//   banner is stored in syncMeta, so it survives a
//   reload until dismissed.
// - Rejected notice: a persistent (not toast) notice
//   for outbox items the server rejected. The local
//   change stays visible but flagged; Discard removes
//   the queued change and refreshes to the server
//   version. Retry is deliberately NOT offered for
//   server rejections — only transient network failures
//   are retryable, and those never reach FAILED.
function describeConflict(details: Record<string, any>): string {
  const rule = details.rule ?? 'CONFLICT_RESOLVED';
  if (details.serverStatus) return `Updated while you were offline: the job is now ${details.serverStatus}. Your notes and photos were kept. (Rule: ${rule})`;
  if (details.fieldsApplied) return `Updated while you were offline: your changes to ${details.fieldsApplied.join(', ')} were applied, and other fields were preserved. (Rule: ${rule})`;
  if (details.field) return `Updated while you were offline: your note was applied; the previous text is preserved in the job history. (Rule: ${rule})`;
  return `Updated while you were offline. Your notes and photos were kept. (Rule: ${rule})`;
}

export function ConflictBanner({ jobId }: { jobId: string }) {
  const [conflicts, setConflicts] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const row = await getDb().syncMeta.get('conflicts');
        const all: any[] = row?.value ?? [];
        if (!cancelled) setConflicts(all.filter((c) => c.jobId === jobId));
      } catch {
        // Offline DB unavailable: no banner, no crash.
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [jobId]);

  async function dismiss(clientMutationId: string) {
    try {
      const db = getDb();
      const row = await db.syncMeta.get('conflicts');
      const all: any[] = row?.value ?? [];
      await db.syncMeta.put({ key: 'conflicts', value: all.filter((c) => c.clientMutationId !== clientMutationId) });
      setConflicts((prev) => prev.filter((c) => c.clientMutationId !== clientMutationId));
    } catch {
      // Dismiss is best-effort.
    }
  }

  if (conflicts.length === 0) return null;
  return (
    <div>
      {conflicts.map((c) => (
        <section key={c.clientMutationId} style={{ border: '1px solid #b45309', background: '#fff3cd', padding: '1rem', marginTop: '1rem' }}>
          <p>{describeConflict(c.conflictDetails ?? {})}</p>
          <button type="button" onClick={() => dismiss(c.clientMutationId)} style={{ minHeight: '44px', padding: '0.5rem 1rem' }}>
            Dismiss
          </button>
        </section>
      ))}
    </div>
  );
}

const REJECT_REASONS: Record<string, string> = {
  JOB_CANCELLED: 'the job is now CANCELLED',
  ALREADY_COMPLETED: 'the job is already COMPLETED',
  INVALID_TRANSITION: 'that status change is not valid from the current status',
  SIGNATURE_REQUIRED: 'completing needs a signature first',
  FORBIDDEN: 'you are not allowed to make that change',
  INVALID_STATE: 'the job is in a state that does not allow that change',
};

export function FailedNotices({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const items = await getDb().outbox.where('jobId').equals(jobId).and((o) => o.status === 'FAILED').toArray();
        if (!cancelled) setFailed(items);
      } catch {
        // No outbox: no notices.
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [jobId]);

  async function discard(id: number) {
    try {
      await getDb().outbox.delete(id);
      setFailed((prev) => prev.filter((f) => f.id !== id));
      router.refresh();
    } catch {
      // Discard is best-effort.
    }
  }

  if (failed.length === 0) return null;
  return (
    <div>
      {failed.map((item) => (
        <section key={item.id} style={{ border: '1px solid #842029', background: '#f8d7da', padding: '1rem', marginTop: '1rem' }}>
          <p>
            Your change ({item.type}) could not be applied because {REJECT_REASONS[item.error ?? ''] ?? item.error ?? 'the server rejected it'}.
            The job shown here is the current server version.
          </p>
          <button type="button" onClick={() => discard(item.id)} style={{ minHeight: '44px', padding: '0.5rem 1rem' }}>
            Discard local change
          </button>
        </section>
      ))}
    </div>
  );
}
