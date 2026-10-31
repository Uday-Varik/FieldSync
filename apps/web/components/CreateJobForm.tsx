'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { apiCall } from '../lib/api-client';

// Phase 1 create-job form (Admin/Dispatcher). Technician id is
// an optional text field for now: there is no /users list
// endpoint yet in Phase 1, so a dispatcher pastes the technician
// user id (from seed data or a future users list in Phase 2).
export default function CreateJobForm() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    title: '', customerName: '', addressLine1: '', city: '', state: '', postalCode: '',
    scheduledDate: '', scheduledWindowStart: '09:00', scheduledWindowEnd: '12:00',
    priority: 'NORMAL', assignedTechnicianId: '', description: '',
  });

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    try {
      const body: any = { ...form };
      if (!body.assignedTechnicianId) delete body.assignedTechnicianId;
      if (!body.description) delete body.description;
      const job = await apiCall(await getToken(), '/jobs', 'POST', body);
      router.push(`/jobs/${job.id}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed.');
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '480px' }}>
      {(['title', 'customerName', 'addressLine1', 'city', 'state', 'postalCode'] as const).map((k) => (
        <input key={k} aria-label={k} placeholder={k} required value={form[k]} onChange={(e) => set(k, e.target.value)} />
      ))}
      <input type="date" aria-label="Scheduled date" required value={form.scheduledDate} onChange={(e) => set('scheduledDate', e.target.value)} />
      <input aria-label="Window start" placeholder="Window start (09:00)" value={form.scheduledWindowStart} onChange={(e) => set('scheduledWindowStart', e.target.value)} />
      <input aria-label="Window end" placeholder="Window end (12:00)" value={form.scheduledWindowEnd} onChange={(e) => set('scheduledWindowEnd', e.target.value)} />
      <select aria-label="Priority" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
        <option>LOW</option><option>NORMAL</option><option>HIGH</option><option>URGENT</option>
      </select>
      <input aria-label="Assigned technician user id (optional)" placeholder="Assigned technician user id (optional)" value={form.assignedTechnicianId} onChange={(e) => set('assignedTechnicianId', e.target.value)} />
      <textarea aria-label="Description (optional)" placeholder="Description (optional)" value={form.description} onChange={(e) => set('description', e.target.value)} />
      <button type="submit" style={{ minHeight: '44px', padding: '0.75rem 1rem' }}>Create job</button>
      {message && <p aria-live="polite">{message}</p>}
    </form>
  );
}
