'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { apiCall } from '../lib/api-client';

// Phase 2 technician status action bar: only status moves,
// no assign/cancel/reopen (those stay dispatcher/admin in
// JobActions). Valid next statuses mirror the API state
// machine; the API still enforces them server-side.
const NEXT: Record<string, string[]> = {
  SCHEDULED: ['EN_ROUTE', 'ON_HOLD'],
  EN_ROUTE: ['ON_SITE', 'ON_HOLD'],
  ON_SITE: ['IN_PROGRESS', 'ON_HOLD'],
  IN_PROGRESS: ['COMPLETED', 'ON_HOLD'],
  ON_HOLD: ['SCHEDULED', 'EN_ROUTE', 'ON_SITE', 'IN_PROGRESS'],
  COMPLETED: [],
  CANCELLED: [],
};

const bigButton: React.CSSProperties = {
  minHeight: '44px',
  padding: '0.75rem 1rem',
  fontSize: '1rem',
};

export default function TechnicianStatusBar({ jobId, status }: { jobId: string; status: string }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState('');

  async function move(next: string) {
    setMessage('');
    try {
      await apiCall(await getToken(), `/jobs/${jobId}/status`, 'POST', { status: next });
      router.refresh();
      setMessage(`Moved to ${next}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed.');
    }
  }

  const next = NEXT[status] ?? [];
  if (next.length === 0) return null;
  return (
    <section style={{ border: '1px solid #ccc', padding: '1rem', marginTop: '1rem' }}>
      <h2>Status</h2>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {next.map((n) => (
          <button key={n} style={bigButton} onClick={() => move(n)}>
            {n.replace('_', ' ')}
          </button>
        ))}
      </div>
      {message && <p>{message}</p>}
      <p style={{ fontSize: '0.9rem' }}>
        Note: completing a job in Phase 2 still needs a signature — that flow is the next slice, not this one.
      </p>
    </section>
  );
}
