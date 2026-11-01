'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getPendingCount } from '../lib/offline-db';
import { startSyncWorker } from '../lib/sync-worker';
import Banner from './ui/Banner';
import styles from './OfflineBanner.module.css';

// Phase 4 offline banner + pending badge. Lives in the
// layout, so every page shows offline state. Starts the
// sync worker (app start, online event, 30s interval)
// and polls the pending count from syncMeta instead of
// scanning the outbox on every render.
//
// Redesign (docs/17 slice (e)): restyled with the token
// system via the shared Banner component — no heading, so
// no h2 precedes the page h1, and the banner's icon +
// role carry the signal alongside the text, never colour
// alone. Wording, sync-worker start, and the render
// conditions are exactly as before: the banner renders
// nothing while online with nothing pending, the offline
// state keeps the danger pair, and the syncing state
// keeps the warning pair.
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
    <div className={styles.wrap}>
      <Banner variant={online ? 'warning' : 'error'}>
        <p>
          {!online && <span>You are offline. Changes you make will be queued and synced when you reconnect. </span>}
          {online && pending > 0 && <span>Syncing… {pending} change{pending === 1 ? '' : 's'} waiting to sync. </span>}
          {!online && pending > 0 && <span>{pending} change{pending === 1 ? '' : 's'} queued. </span>}
          <span>Jobs you have not opened while online are not guaranteed offline.</span>
        </p>
      </Banner>
    </div>
  );
}
