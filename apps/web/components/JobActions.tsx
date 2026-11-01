'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { apiCall } from '../lib/api-client';
import Button from './ui/Button';
import Field from './ui/Field';
import ConfirmBlock from './ui/ConfirmBlock';
import { STATUS_DISPLAY, type JobStatusKey } from './ui/StatusPill';
import styles from './JobActions.module.css';

// Phase 1 job actions for Admin/Dispatcher only (technicians
// get a read-only My Day in this phase). Valid next statuses
// mirror the API state machine exactly; the API still enforces
// them server-side, so a wrong choice here is rejected there.
//
// Redesign (docs/17 slice (c)): token styles, visible labels,
// busy/disabled states on every mutation (double-submit is
// impossible by disabling), and an explicit confirmation step
// for Cancel and Reopen (docs/06 principle 4, docs/17 §3.3),
// reusing the existing reason field — no new fields, no new
// endpoints, same payloads. Status moves stay immediate, as
// before; only Cancel/Reopen confirm.
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

type PendingAction = 'cancel' | 'reopen' | null;

export default function JobActions({ jobId, status, role }: { jobId: string; status: string; role: string }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const cancelTriggerRef = useRef<HTMLButtonElement>(null);
  const reopenTriggerRef = useRef<HTMLButtonElement>(null);

  async function run(key: string, path: string, body: unknown) {
    setMessage('');
    setBusy(key);
    try {
      await apiCall(await getToken(), path, 'POST', body);
      router.refresh();
      setMessage('Saved.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed.');
    } finally {
      setBusy(null);
    }
  }

  function closeConfirm(returnFocusTo: 'cancel' | 'reopen') {
    setPendingAction(null);
    const trigger = returnFocusTo === 'cancel' ? cancelTriggerRef.current : reopenTriggerRef.current;
    if (trigger) setTimeout(() => trigger.focus(), 0);
  }

  const reasonMissing = reason.trim() === '';

  return (
    <section className={styles.actions} aria-label="Dispatcher and admin actions">
      <h2 className={styles.heading}>Actions (Dispatcher / Admin)</h2>
      <div className={styles.group}>
        <p className={styles.groupLabel}>Move job to</p>
        <div className={styles.row}>
          {(NEXT[status] ?? []).map((next) => (
            <Button
              key={next}
              aria-label={`Move job to ${statusLabel(next)}`}
              disabled={busy !== null}
              busy={busy === `status:${next}`}
              onClick={() => run(`status:${next}`, `/jobs/${jobId}/status`, { status: next })}
            >
              Move to {statusLabel(next)}
            </Button>
          ))}
          {(NEXT[status] ?? []).length === 0 && <p className={styles.message}>No status moves are available for this job.</p>}
        </div>
      </div>
      <div className={styles.group}>
        <Field label="Technician user ID" hint="Enter the technician's user ID to assign. Assign with an empty field to unassign.">
          <input type="text" value={technicianId} onChange={(e) => setTechnicianId(e.target.value)} autoComplete="off" />
        </Field>
        <div className={styles.row}>
          <Button
            disabled={busy !== null}
            busy={busy === 'assign'}
            onClick={() => run('assign', `/jobs/${jobId}/assign`, { technicianId: technicianId || null })}
          >
            Assign / unassign
          </Button>
        </div>
      </div>
      <div className={styles.group}>
        <Field label="Reason for cancel or reopen" hint="The reason is sent with a cancellation or a reopen, and is recorded in the audit timeline.">
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} autoComplete="off" />
        </Field>
        <div className={styles.row}>
          <Button
            ref={cancelTriggerRef}
            variant="destructive"
            disabled={busy !== null}
            onClick={() => setPendingAction('cancel')}
          >
            Cancel
          </Button>
          {role === 'ADMIN' && status === 'COMPLETED' && (
            <Button
              ref={reopenTriggerRef}
              variant="destructive"
              disabled={busy !== null}
              onClick={() => setPendingAction('reopen')}
            >
              Reopen (Admin)
            </Button>
          )}
        </div>
      </div>
      {pendingAction === 'cancel' && (
        <ConfirmBlock
          heading="Cancel this job?"
          confirmLabel="Cancel job"
          cancelLabel="Keep job"
          confirmDisabled={reasonMissing}
          busy={busy === 'cancel'}
          onCancel={() => closeConfirm('cancel')}
          onConfirm={() => {
            setPendingAction(null);
            void run('cancel', `/jobs/${jobId}/cancel`, { reason });
          }}
        >
          <p>The job will be cancelled and cannot be worked on. This cannot be undone from this page.</p>
          {reasonMissing ? (
            <p>Enter a reason above before cancelling — a reason is required.</p>
          ) : (
            <p>Reason: {reason}</p>
          )}
        </ConfirmBlock>
      )}
      {pendingAction === 'reopen' && (
        <ConfirmBlock
          heading="Reopen this job?"
          confirmLabel="Reopen job"
          cancelLabel="Keep completed"
          confirmDisabled={reasonMissing}
          busy={busy === 'reopen'}
          onCancel={() => closeConfirm('reopen')}
          onConfirm={() => {
            setPendingAction(null);
            void run('reopen', `/jobs/${jobId}/reopen`, { reason });
          }}
        >
          <p>The job will return to In progress. Its previous signature will show as superseded.</p>
          {reasonMissing ? (
            <p>Enter a reason above before reopening — a reason is required.</p>
          ) : (
            <p>Reason: {reason}</p>
          )}
        </ConfirmBlock>
      )}
      {message && (
        <p className={styles.message} aria-live="polite">
          {message}
        </p>
      )}
    </section>
  );
}
