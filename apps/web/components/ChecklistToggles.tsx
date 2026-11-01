'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { apiCall } from '../lib/api-client';
import { enqueueMutation } from '../lib/sync-worker';
import styles from './ChecklistToggles.module.css';

// Phase 2 checklist toggles: assigned technician, dispatcher,
// or admin (API rules). Each toggle is a large tap target for
// phone use, and posts to the existing checklist toggle endpoint.
// Redesign (docs/17 slice (c)): token styles only. Toggle
// semantics, optimistic update, offline queueing, and
// revert-on-server-error are unchanged.
export default function ChecklistToggles({
  jobId,
  items,
  jobVersion,
}: {
  jobId: string;
  items: { id: string; label: string; isChecked: boolean }[];
  jobVersion: number;
}) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [local, setLocal] = useState(items);

  async function toggle(item: { id: string; isChecked: boolean }) {
    const nextChecked = !item.isChecked;
    setBusy(item.id);
    setMessage('');
    setLocal((prev) => prev.map((i) => (i.id === item.id ? { ...i, isChecked: nextChecked } : i)));
    if (typeof window !== 'undefined' && !navigator.onLine) {
      await enqueueMutation('TOGGLE_CHECKLIST', jobId, { itemId: item.id, isChecked: nextChecked }, jobVersion);
      setMessage('Queued offline — will sync when you reconnect.');
      setBusy(null);
      return;
    }
    try {
      await apiCall(await getToken(), `/jobs/${jobId}/checklist/${item.id}`, 'PATCH', {
        isChecked: nextChecked,
      });
      router.refresh();
    } catch (e) {
      if (e instanceof TypeError) {
        await enqueueMutation('TOGGLE_CHECKLIST', jobId, { itemId: item.id, isChecked: nextChecked }, jobVersion);
        setMessage('Connection failed — queued offline, will sync when you reconnect.');
      } else {
        setLocal((prev) => prev.map((i) => (i.id === item.id ? { ...i, isChecked: item.isChecked } : i)));
        setMessage(e instanceof Error ? e.message : 'Failed.');
      }
    } finally {
      setBusy(null);
    }
  }

  if (local.length === 0) return <p className={styles.empty}>No checklist items yet.</p>;
  return (
    <div>
      <ul className={styles.list}>
        {local.map((item) => (
          <li key={item.id}>
            <label className={styles.row}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={item.isChecked}
                disabled={busy === item.id}
                onChange={() => toggle(item)}
              />
              <span className={item.isChecked ? styles.checked : undefined}>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
      {message && (
        <p className={styles.message} aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
