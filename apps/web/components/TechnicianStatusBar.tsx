'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { apiCall } from '../lib/api-client';
import { enqueueMutation } from '../lib/sync-worker';
import Button from './ui/Button';
import { STATUS_DISPLAY, type JobStatusKey } from './ui/StatusPill';
import styles from './TechnicianStatusBar.module.css';

// Phase 2 technician status action bar: only status moves,
// no assign/cancel/reopen (those stay dispatcher/admin in
// JobActions). Valid next statuses mirror the API state
// machine; the API still enforces them server-side.
//
// Redesign (docs/17 slice (c)): the bar is sticky at the
// bottom of the viewport (docs/06 S21) so the actions stay
// reachable without scrolling; buttons get busy/disabled
// states; messages use human status labels; and a completed
// or cancelled job shows its state instead of the section
// simply vanishing (docs/17 §1.5). The offline queueing
// semantics are unchanged.
const NEXT: Record<string, string[]> = {
  SCHEDULED: ['EN_ROUTE', 'ON_HOLD'],
  EN_ROUTE: ['ON_SITE', 'ON_HOLD'],
  ON_SITE: ['IN_PROGRESS', 'ON_HOLD'],
  IN_PROGRESS: ['COMPLETED', 'ON_HOLD'],
  ON_HOLD: ['SCHEDULED', 'EN_ROUTE', 'ON_SITE', 'IN_PROGRESS'],
  COMPLETED: [],
  CANCELLED: [],
};

function statusLabel(status: string): string {
  return status in STATUS_DISPLAY ? STATUS_DISPLAY[status as JobStatusKey].label : status.replace(/_/g, ' ');
}

export default function TechnicianStatusBar({ jobId, status, jobVersion }: { jobId: string; status: string; jobVersion: number }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [current, setCurrent] = useState(status);
  const [busy, setBusy] = useState<string | null>(null);

  async function move(next: string) {
    setMessage('');
    const label = statusLabel(next);
    // Offline-first (Phase 4): when offline, or when the
    // network itself fails, queue the status change in
    // the outbox instead of losing it. An HTTP error from
    // the server (e.g. invalid transition) is NOT queued.
    if (typeof window !== 'undefined' && !navigator.onLine) {
      setBusy(next);
      await enqueueMutation('UPDATE_STATUS', jobId, { to: next }, jobVersion, { status: next });
      setCurrent(next);
      setBusy(null);
      setMessage(`Queued offline — will sync to ${label} when you reconnect.`);
      return;
    }
    setBusy(next);
    try {
      await apiCall(await getToken(), `/jobs/${jobId}/status`, 'POST', { status: next });
      setCurrent(next);
      router.refresh();
      setMessage(`Moved to ${label}.`);
    } catch (e) {
      if (e instanceof TypeError) {
        await enqueueMutation('UPDATE_STATUS', jobId, { to: next }, jobVersion, { status: next });
        setCurrent(next);
        setMessage(`Connection failed — queued offline, will sync to ${label} when you reconnect.`);
      } else {
        setMessage(e instanceof Error ? e.message : 'Failed.');
      }
    } finally {
      setBusy(null);
    }
  }

  const next = NEXT[current] ?? [];
  if (next.length === 0) {
    return (
      <section className={styles.bar} aria-label="Job status">
        <h2 className={styles.heading}>Status</h2>
        <p className={styles.state}>This job is {statusLabel(current).toLowerCase()}. There are no further status actions.</p>
      </section>
    );
  }
  return (
    <section className={styles.bar} aria-label="Job status actions">
      <h2 className={styles.heading}>Status</h2>
      <div className={styles.buttons}>
        {next.map((n) => (
          <Button
            key={n}
            variant="primary"
            size="large"
            aria-label={`Move job to ${statusLabel(n)}`}
            disabled={busy !== null}
            busy={busy === n}
            onClick={() => move(n)}
          >
            {statusLabel(n)}
          </Button>
        ))}
      </div>
      {message && <p aria-live="polite">{message}</p>}
      {next.includes('COMPLETED') && (
        <p className={styles.note}>
          Completing needs a signature (capture one below), unless a dispatcher/admin overrides with a reason.
        </p>
      )}
    </section>
  );
}
