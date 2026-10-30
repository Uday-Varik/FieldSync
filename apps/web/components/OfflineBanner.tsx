'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getPendingCount } from '../lib/offline-db';
import { startSyncWorker } from '../lib/sync-worker';

// Phase 4 offline banner + pending badge. Lives in the
// layout, so every page shows offline state. Starts the
// sync worker (app start, online event, 30s interval)
// and polls the pending count from syncMeta instead of
// scanning the outbox on every render.
export default function OfflineBanner() {
  const { getToken, isSignedIn } = useAuth();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!isSignedIn) return;
    const stop = startSyncWorker(getToken);
    const update = () => {
      setOnline(navigator.onLine);
      void getPendingCount().then(setPending);
    };
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const interval = setInterval(update, 5000);
    return () => {
      stop();
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      clearInterval(interval);
    };
  }, [getToken, isSignedIn]);

  if (online && pending === 0) return null;
  return (
    <div style={{ padding: '0.5rem 1rem', background: online ? '#fff3cd' : '#f8d7da' }}>
      {!online && <span>You are offline. Changes you make will be queued and synced when you reconnect. </span>}
      {online && pending > 0 && <span>Syncing… {pending} change{pending === 1 ? '' : 's'} waiting to sync. </span>}
      {!online && pending > 0 && <span>{pending} change{pending === 1 ? '' : 's'} queued. </span>}
      <span style={{ fontSize: '0.9rem' }}>Jobs you have not opened while online are not guaranteed offline.</span>
    </div>
  );
}
