'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { apiCall } from '../lib/api-client';
import { enqueueMutation } from '../lib/sync-worker';

// Phase 2 notes, plain text first (Yjs comes in Phase 3).
// Notes are stored on the job's internalNotes field via the
// existing PATCH /jobs/:id endpoint, which assigned technicians
// and dispatchers/admins can already use.
export default function JobNotesForm({ jobId, initialNotes, jobVersion }: { jobId: string; initialNotes: string; jobVersion: number }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [message, setMessage] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    if (typeof window !== 'undefined' && !navigator.onLine) {
      await enqueueMutation('ADD_NOTE', jobId, { field: 'internalNotes', text: notes }, jobVersion, { internalNotes: notes });
      setMessage('Queued offline — will sync when you reconnect.');
      return;
    }
    try {
      await apiCall(await getToken(), `/jobs/${jobId}`, 'PATCH', { internalNotes: notes });
      router.refresh();
      setMessage('Notes saved.');
    } catch (err) {
      if (err instanceof TypeError) {
        await enqueueMutation('ADD_NOTE', jobId, { field: 'internalNotes', text: notes }, jobVersion, { internalNotes: notes });
        setMessage('Connection failed — queued offline, will sync when you reconnect.');
      } else {
        setMessage(err instanceof Error ? err.message : 'Failed.');
      }
    }
  }

  return (
    <form onSubmit={save} style={{ marginTop: '1rem' }}>
      <h2>Notes (plain text)</h2>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        style={{ width: '100%', fontSize: '1rem', padding: '0.5rem' }}
        placeholder="Job notes for the team…"
      />
      <button type="submit" style={{ minHeight: '44px', padding: '0.75rem 1rem', marginTop: '0.5rem' }}>
        Save notes
      </button>
      {message && <p>{message}</p>}
    </form>
  );
}
