'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { apiCall } from '../lib/api-client';
import { enqueueMutation } from '../lib/sync-worker';

// Phase 2 checklist toggles: assigned technician, dispatcher,
// or admin (API rules). Each toggle is a large tap target for
// phone use, and posts to the existing checklist toggle endpoint.
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

  if (local.length === 0) return <p>No checklist items yet.</p>;
  return (
    <div>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {local.map((item) => (
          <li key={item.id} style={{ marginBottom: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minHeight: '44px' }}>
              <input
                type="checkbox"
                style={{ width: '24px', height: '24px' }}
                checked={item.isChecked}
                disabled={busy === item.id}
                onChange={() => toggle(item)}
              />
              <span style={{ textDecoration: item.isChecked ? 'line-through' : 'none' }}>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
      {message && <p aria-live="polite">{message}</p>}
    </div>
  );
}
