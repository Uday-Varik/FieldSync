'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { apiCall } from '../lib/api-client';
import Button from './ui/Button';
import Field from './ui/Field';
import styles from './CreateJobForm.module.css';

// Phase 1 create-job form (Admin/Dispatcher). Technician id is
// an optional text field for now: there is no /users list
// endpoint yet in Phase 1, so a dispatcher pastes the technician
// user id (from seed data or a future users list in Phase 2).
//
// Redesign (docs/17 slice (c)): guided, grouped form on the
// shared Field/Button components — visible labels (no
// placeholder-as-label), human option labels, inline
// validation states, an error summary, and a busy state on
// submit. The fields, validation rules, and submit behaviour
// are exactly as before: the same required fields, the same
// defaults, the same payload (empty optional fields omitted),
// and success still navigates to the new job. No technician
// picker is invented: no users-list endpoint exists, so the
// pasted-id field stays, labelled clearly with helper text.
// No new time-format rule is added either — the window fields
// stay free text, validated only by the API as before; the
// only client-side errors shown are for required fields left
// empty, which the native required attributes already block.
type FormState = {
  title: string;
  customerName: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  scheduledDate: string;
  scheduledWindowStart: string;
  scheduledWindowEnd: string;
  priority: string;
  assignedTechnicianId: string;
  description: string;
};

const REQUIRED: { key: keyof FormState; label: string }[] = [
  { key: 'title', label: 'Job title' },
  { key: 'customerName', label: 'Customer name' },
  { key: 'addressLine1', label: 'Street address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'postalCode', label: 'Postal code' },
  { key: 'scheduledDate', label: 'Scheduled date' },
  { key: 'scheduledWindowStart', label: 'Window start' },
  { key: 'scheduledWindowEnd', label: 'Window end' },
];

const PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
] as const;

// Priority option labels mirror PRIORITY_STYLES in
// packages/shared (Low / Normal / High / Urgent); the
// submitted values stay the priority codes.

export default function CreateJobForm() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const summaryRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<FormState>({
    title: '',
    customerName: '',
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
    scheduledDate: '',
    scheduledWindowStart: '09:00',
    scheduledWindowEnd: '12:00',
    priority: 'NORMAL',
    assignedTechnicianId: '',
    description: '',
  });

  function set(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function errorFor(key: keyof FormState): string | undefined {
    return fieldErrors[key];
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    const missing = REQUIRED.filter(({ key }) => form[key].trim() === '');
    if (missing.length > 0) {
      const errors: Partial<Record<keyof FormState, string>> = {};
      for (const { key, label } of missing) errors[key] = `Enter ${label.charAt(0).toLowerCase()}${label.slice(1)}.`;
      setFieldErrors(errors);
      setMessage('Some required fields are missing. Check the fields below and try again.');
      summaryRef.current?.focus();
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      const body: Record<string, string> = { ...form };
      if (!body.assignedTechnicianId) delete body.assignedTechnicianId;
      if (!body.description) delete body.description;
      const job = await apiCall(await getToken(), '/jobs', 'POST', body);
      router.push(`/jobs/${job.id}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed.');
      summaryRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  const hasErrors = message !== '';

  return (
    <form onSubmit={submit} className={styles.form}>
      {hasErrors && (
        <div className={styles.summary} role="alert" tabIndex={-1} ref={summaryRef}>
          <h2 className={styles.summaryTitle}>There is a problem</h2>
          <p>{message}</p>
          {Object.keys(fieldErrors).length > 0 && (
            <ul>
              {REQUIRED.filter(({ key }) => fieldErrors[key]).map(({ key }) => (
                <li key={key}>{fieldErrors[key]}</li>
              ))}
            </ul>
          )}
          <p>Fix the problem and try again — nothing was created.</p>
        </div>
      )}

      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>Job</legend>
        <Field label="Job title" required error={errorFor('title')}>
          <input type="text" required value={form.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Description (optional)" hint="Anything the technician should know before arriving.">
          <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} />
        </Field>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>Customer and address</legend>
        <Field label="Customer name" required error={errorFor('customerName')}>
          <input type="text" required value={form.customerName} onChange={(e) => set('customerName', e.target.value)} />
        </Field>
        <Field label="Street address" required error={errorFor('addressLine1')} hint="The address is geocoded on the server when possible, so the job can be shown on the map.">
          <input type="text" required value={form.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} />
        </Field>
        <Field label="City" required error={errorFor('city')}>
          <input type="text" required value={form.city} onChange={(e) => set('city', e.target.value)} />
        </Field>
        <Field label="State" required error={errorFor('state')}>
          <input type="text" required value={form.state} onChange={(e) => set('state', e.target.value)} />
        </Field>
        <Field label="Postal code" required error={errorFor('postalCode')}>
          <input type="text" required value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} />
        </Field>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>Schedule</legend>
        <Field label="Scheduled date" required error={errorFor('scheduledDate')}>
          <input type="date" required value={form.scheduledDate} onChange={(e) => set('scheduledDate', e.target.value)} />
        </Field>
        <Field label="Window start" required hint="Time of day, for example 09:00." error={errorFor('scheduledWindowStart')}>
          <input type="text" required value={form.scheduledWindowStart} onChange={(e) => set('scheduledWindowStart', e.target.value)} />
        </Field>
        <Field label="Window end" required hint="Time of day, for example 12:00." error={errorFor('scheduledWindowEnd')}>
          <input type="text" required value={form.scheduledWindowEnd} onChange={(e) => set('scheduledWindowEnd', e.target.value)} />
        </Field>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>Priority and assignment</legend>
        <Field label="Priority" hint="Urgent jobs sort first and stand out on the board.">
          <select value={form.priority} onChange={(e) => set('priority', e.target.value)}>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Assigned technician user ID (optional)"
          hint="Paste the technician's user ID. There is no technician picker yet — no list of technicians is available to choose from — so the ID must be entered here. Leave empty to leave the job unassigned."
        >
          <input type="text" value={form.assignedTechnicianId} onChange={(e) => set('assignedTechnicianId', e.target.value)} autoComplete="off" />
        </Field>
      </fieldset>

      <div>
        <Button type="submit" variant="primary" busy={busy}>
          Create job
        </Button>
      </div>
      <p className={styles.after}>After creation, the job appears on the board and on the assigned technician's My Day.</p>
    </form>
  );
}
