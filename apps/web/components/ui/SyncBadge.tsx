'use client';

// Pending-sync badges (docs/17 §§2.3, 3.2; US-T5). Both read
// only the offline state the app already keeps in IndexedDB
// (lib/offline-db) — no new sync behaviour, no invented
// timestamp: there is no last-synced value to show, so none
// is shown. SyncBadge is the page-level "Pending sync (n)"
// count; PendingSyncDot is the per-row dot for one job.
// Each renders nothing when nothing is pending, matching the
// offline banner's behaviour in the shell.

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getDb, getPendingCount } from '../../lib/offline-db';
import styles from './SyncBadge.module.css';

export function SyncBadge() {
  const { isSignedIn } = useAuth();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!isSignedIn) return;
    const update = () => {
      void getPendingCount().then(setPending);
    };
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const interval = setInterval(update, 5000);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      clearInterval(interval);
    };
  }, [isSignedIn]);

  if (!isSignedIn || pending === 0) return null;
  return (
    <p className={styles.badge} role="status">
      <span aria-hidden="true">●</span> Pending sync ({pending})
    </p>
  );
}

export function PendingSyncDot({ jobId }: { jobId: string }) {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const update = async () => {
      try {
        const count = await getDb()
          .outbox.where('jobId')
          .equals(jobId)
          .and((item) => item.status === 'PENDING')
          .count();
        if (!cancelled) setPending(count);
      } catch {
        if (!cancelled) setPending(0);
      }
    };
    void update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const interval = setInterval(update, 5000);
    return () => {
      cancelled = true;
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      clearInterval(interval);
    };
  }, [jobId]);

  if (pending === 0) return null;
  return (
    <span className={styles.dot}>
      <span aria-hidden="true">●</span> Pending sync
    </span>
  );
}
