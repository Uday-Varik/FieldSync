'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { apiCall } from '../lib/api-client';

// Phase 1 job actions for Admin/Dispatcher only (technicians
// get a read-only My Day in this phase). Valid next statuses
// mirror the API state machine exactly; the API still enforces
// them server-side, so a wrong choice here is rejected there.
const NEXT: Record<string, string[]> = {
  SCHEDULED: ['EN_ROUTE', 'ON_HOLD'],
  EN_ROUTE: ['ON_SITE', 'ON_HOLD'],
  ON_SITE: ['IN_PROGRESS', 'ON_HOLD'],
  IN_PROGRESS: ['COMPLETED', 'ON_HOLD'],
  ON_HOLD: ['SCHEDULED', 'EN_ROUTE', 'ON_SITE', 'IN_PROGRESS'],
  COMPLETED: [],
  CANCELLED: [],
};

export default function JobActions({ jobId, status, role }: { jobId: string; status: string; role: string }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [reason, setReason] = useState('');

  async function run(path: string, body: unknown) {
    setMessage('');
    try {
      await apiCall(await getToken(), path, 'POST', body);
      router.refresh();
      setMessage('Saved.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed.');
    }
  }

  return (
    <section style={{ border: '1px solid #ccc', padding: '1rem', marginTop: '1rem' }}>
      <h2>Actions (Dispatcher / Admin)</h2>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        {(NEXT[status] ?? []).map((next) => (
          <button key={next} onClick={() => run(`/jobs/${jobId}/status`, { status: next })}>
            Move to {next}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <input placeholder="Technician user id (assign)" value={technicianId} onChange={(e) => setTechnicianId(e.target.value)} />
        <button onClick={() => run(`/jobs/${jobId}/assign`, { technicianId: technicianId || null })}>Assign / unassign</button>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input placeholder="Reason (cancel / reopen)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button onClick={() => run(`/jobs/${jobId}/cancel`, { reason })}>Cancel</button>
        {role === 'ADMIN' && status === 'COMPLETED' && (
          <button onClick={() => run(`/jobs/${jobId}/reopen`, { reason })}>Reopen (Admin)</button>
        )}
      </div>
      {message && <p>{message}</p>}
    </section>
  );
}
