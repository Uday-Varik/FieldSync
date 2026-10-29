'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { apiCall } from '../lib/api-client';

// Phase 2 checklist toggles: assigned technician, dispatcher,
// or admin (API rules). Each toggle is a large tap target for
// phone use, and posts to the existing checklist toggle endpoint.
export default function ChecklistToggles({
  jobId,
  items,
}: {
  jobId: string;
  items: { id: string; label: string; isChecked: boolean }[];
}) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(item: { id: string; isChecked: boolean }) {
    setBusy(item.id);
    setMessage('');
    try {
      await apiCall(await getToken(), `/jobs/${jobId}/checklist/${item.id}`, 'PATCH', {
        isChecked: !item.isChecked,
      });
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed.');
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) return <p>No checklist items yet.</p>;
  return (
    <div>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {items.map((item) => (
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
      {message && <p>{message}</p>}
    </div>
  );
}
