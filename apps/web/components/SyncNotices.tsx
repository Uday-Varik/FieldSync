'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDb } from '../lib/offline-db';
import { STATUS_DISPLAY, type JobStatusKey } from './ui/StatusPill';
import { fieldLabel } from '../lib/activity-presentation';
import Banner from './ui/Banner';
import Button from './ui/Button';
import styles from './SyncNotices.module.css';

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
//
// Redesign (docs/17 slice (c)): Banner adoption, and the
// rule codes and raw mutation-type names are removed from
// user view (docs/17 §§1.9, 2.3). The generated wording,
// Discard-only semantics, and persistence are unchanged.
function describeConflict(details: Record<string, any>): string {
  const serverStatus =
    typeof details.serverStatus === 'string' && details.serverStatus in STATUS_DISPLAY
      ? STATUS_DISPLAY[details.serverStatus as JobStatusKey].label
      : null;
  if (serverStatus) return `Updated while you were offline: the job is now ${serverStatus}. Your notes and photos were kept.`;
  if (Array.isArray(details.fieldsApplied) && details.fieldsApplied.length > 0) {
    return `Updated while you were offline: your changes to ${details.fieldsApplied.map((f: unknown) => fieldLabel(String(f))).join(', ')} were applied, and other fields were preserved.`;
  }
  if (details.field) return 'Updated while you were offline: your note was applied; the previous text is preserved in the job history.';
  return 'Updated while you were offline. Your notes and photos were kept.';
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
    <div className={styles.notices}>
      {conflicts.map((c) => (
        <Banner
          key={c.clientMutationId}
          variant="warning"
          heading="This job was updated while you were offline"
          actions={
            <Button onClick={() => dismiss(c.clientMutationId)}>Dismiss</Button>
          }
        >
          <p>{describeConflict(c.conflictDetails ?? {})}</p>
        </Banner>
      ))}
    </div>
  );
}

const REJECT_REASONS: Record<string, string> = {
  JOB_CANCELLED: 'the job is now cancelled',
  ALREADY_COMPLETED: 'the job is already completed',
  INVALID_TRANSITION: 'that status change is not valid from the current status',
  SIGNATURE_REQUIRED: 'completing needs a signature first',
  FORBIDDEN: 'you are not allowed to make that change',
  INVALID_STATE: 'the job is in a state that does not allow that change',
};

const MUTATION_LABELS: Record<string, string> = {
  UPDATE_STATUS: 'status change',
  UPDATE_JOB_FIELDS: 'job details change',
  TOGGLE_CHECKLIST: 'checklist change',
  ADD_CHECKLIST_ITEM: 'checklist item',
  ADD_NOTE: 'note',
  ADD_SIGNATURE: 'signature',
  ADD_PHOTO_META: 'photo',
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
    <div className={styles.notices}>
      {failed.map((item) => (
        <Banner
          key={item.id}
          variant="error"
          heading="A change could not be applied"
          actions={
            <Button onClick={() => discard(item.id)}>Discard local change</Button>
          }
        >
          <p>
            Your {MUTATION_LABELS[item.type] ?? 'change'} could not be applied because{' '}
            {REJECT_REASONS[item.error ?? ''] ?? 'the server rejected it'}. The job shown here is the current server version.
          </p>
        </Banner>
      ))}
    </div>
  );
}
