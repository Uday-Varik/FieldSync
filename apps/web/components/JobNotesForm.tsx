'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { apiCall } from '../lib/api-client';
import { enqueueMutation } from '../lib/sync-worker';
import Button from './ui/Button';
import Field from './ui/Field';
import styles from './JobNotesForm.module.css';

// Phase 2 notes, plain text first (Yjs comes in Phase 3).
// Notes are stored on the job's internalNotes field via the
// existing PATCH /jobs/:id endpoint, which assigned technicians
// and dispatchers/admins can already use.
//
// Redesign (docs/17 slice (c)): visible label, token styles,
// and a busy state on save. The heading and helper text on
// the job detail page explain that these notes are saved on
// the job record, separately from the shared notes below.
// Persistence and offline queueing are unchanged.
export default function JobNotesForm({ jobId, initialNotes, jobVersion }: { jobId: string; initialNotes: string; jobVersion: number }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    if (typeof window !== 'undefined' && !navigator.onLine) {
      setBusy(true);
      await enqueueMutation('ADD_NOTE', jobId, { field: 'internalNotes', text: notes }, jobVersion, { internalNotes: notes });
      setBusy(false);
      setMessage('Queued offline — will sync when you reconnect.');
      return;
    }
    setBusy(true);
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className={styles.form}>
      <h3 className={styles.heading}>Job notes</h3>
      <Field label="Job notes for the team" hint="Saved on the job record. These notes are separate from the shared notes below.">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
      </Field>
      <div>
        <Button type="submit" variant="primary" busy={busy}>
          Save notes
        </Button>
      </div>
      {message && (
        <p className={styles.message} aria-live="polite">
          {message}
        </p>
      )}
    </form>
  );
}
