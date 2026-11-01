'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getDb, getPendingCount } from '../../lib/offline-db';
import { syncPending, uploadOfflinePhotos } from '../../lib/sync-worker';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import styles from './page.module.css';

// Offline status (docs/17 slice (d)). Reads only counts
// from the existing offline store (Dexie outbox + cached
// jobs) — never queue contents, never invented data — and
// retries with the existing sync trigger (syncPending, the
// same function the sync worker runs on reconnect). The
// counts render only after this component mounts in the
// browser, so the service worker's cached copy of
// /offline stays free of user data, exactly as before.
// Wording follows the offline banner: changes are queued
// and synced when you reconnect; jobs not opened while
// online are not guaranteed offline.
type OfflineCounts = {
  pending: number;
  failed: number;
  cachedJobs: number;
};

export default function OfflineStatus() {
  const { getToken, isSignedIn } = useAuth();
  const [online, setOnline] = useState(true);
  const [counts, setCounts] = useState<OfflineCounts | null>(null);
  const [couldNotCheck, setCouldNotCheck] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState('');

  const refresh = useCallback(async () => {
    setOnline(navigator.onLine);
    try {
      const db = getDb();
      const [pending, failed, cachedJobs] = await Promise.all([
        getPendingCount(),
        db.outbox.where('status').equals('FAILED').count(),
        db.jobs.count(),
      ]);
      setCounts({ pending, failed, cachedJobs });
      setCouldNotCheck(false);
    } catch {
      setCounts({ pending: 0, failed: 0, cachedJobs: 0 });
      setCouldNotCheck(true);
    }
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    void refresh();
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    const interval = setInterval(refresh, 5000);
    return () => {
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
      clearInterval(interval);
    };
  }, [isSignedIn, refresh]);

  if (!isSignedIn) return null;

  if (counts === null) {
    return <Skeleton label="Checking what is queued on this device…" count={2} />;
  }

  const totalQueued = counts.pending + counts.failed;

  async function retrySync() {
    setSyncing(true);
    setResult('');
    try {
      const outcome = await syncPending(getToken);
      await uploadOfflinePhotos(getToken);
      await refresh();
      if (outcome.skipped) {
        setResult('Still offline. Your changes stay queued and will sync when you reconnect.');
      } else if (outcome.failed > 0) {
        setResult(
          `${outcome.applied} change${outcome.applied === 1 ? '' : 's'} synced. ${outcome.failed} change${outcome.failed === 1 ? '' : 's'} could not be synced and ${outcome.failed === 1 ? 'stays' : 'stay'} queued. Open the job to check a change that could not be synced.`,
        );
      } else if (outcome.applied > 0) {
        setResult(`${outcome.applied} change${outcome.applied === 1 ? '' : 's'} synced.`);
      } else {
        setResult('Nothing was waiting to sync.');
      }
    } catch {
      setResult('Sync could not run right now. Your changes stay queued — try again when you are back online.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className={styles.statusSection} aria-label="What is queued on this device">
      <h2>What is queued on this device</h2>
      {couldNotCheck ? (
        <p>Could not check what is queued on this device right now.</p>
      ) : totalQueued === 0 ? (
        <EmptyState heading="Nothing waiting to sync" body="No changes are queued on this device." />
      ) : (
        <ul className={styles.statusList}>
          <li>
            {counts.pending} change{counts.pending === 1 ? '' : 's'} waiting to sync
            <span> — queued while offline, sent in order when you reconnect.</span>
          </li>
          {counts.failed > 0 ? (
            <li>
              {counts.failed} change{counts.failed === 1 ? '' : 's'} could not be synced
              <span> — open the job to check it. It stays queued until it syncs.</span>
            </li>
          ) : null}
        </ul>
      )}
      <ul className={styles.statusList}>
        <li>
          {counts.cachedJobs} job{counts.cachedJobs === 1 ? '' : 's'} saved on this device
          <span> — jobs you opened while online. Jobs you have not opened while online are not guaranteed offline.</span>
        </li>
        <li>
          {online ? 'You are back online.' : 'You are offline.'}
          <span> {online ? 'Sync runs automatically.' : 'Changes you make will be queued and synced when you reconnect.'}</span>
        </li>
      </ul>
      <p className={styles.result}>
        <Button onClick={retrySync} busy={syncing}>
          Try syncing now
        </Button>
      </p>
      {result ? (
        <p className={styles.result} role="status" aria-live="polite">
          {result}
        </p>
      ) : null}
    </section>
  );
}
