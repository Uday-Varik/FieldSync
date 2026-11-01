// Job card (docs/17 §§2.3, 3.2; docs/06 S11/S20). One card
// for the board and for My Day: title link, customer, address
// short, time window, StatusPill, PriorityBadge, overdue flag,
// and unassigned flag — all from fields the GET /jobs list
// endpoint already returns. Two things are deliberately NOT
// shown: a photo count (the list endpoint returns no photos)
// and a technician name/avatar (it returns no technician
// object, only assignedTechnicianId). The pending-sync dot is
// shown only where the caller asks for it (My Day), from the
// offline outbox state — never invented.
import Link from 'next/link';
import {
  STATUS_DISPLAY,
  PRIORITY_DISPLAY,
  StatusPill,
  PriorityBadge,
  type JobStatusKey,
  type PriorityKey,
} from './StatusPill';
import {
  addressShort,
  jobDate,
  windowLabel,
  type BoardJob,
} from '../../lib/job-presentation';
import { PendingSyncDot } from './SyncBadge';
import styles from './JobCard.module.css';

function isStatusKey(status: string): status is JobStatusKey {
  return status in STATUS_DISPLAY;
}

function isPriorityKey(priority: string): priority is PriorityKey {
  return priority in PRIORITY_DISPLAY;
}

export default function JobCard({
  job,
  overdue,
  isNext = false,
  showDate = false,
  showUnassigned = false,
  showPendingSync = false,
}: {
  job: BoardJob;
  overdue: boolean;
  isNext?: boolean;
  showDate?: boolean;
  showUnassigned?: boolean;
  showPendingSync?: boolean;
}) {
  const address = addressShort(job);
  const window = windowLabel(job);
  const date = jobDate(job);
  const unassigned = showUnassigned && !job.assignedTechnicianId;
  const hasFlags = isNext || overdue || unassigned || showPendingSync;

  return (
    <article className={`${styles.card} ${overdue ? styles.overdue : ''} ${isNext ? styles.next : ''}`}>
      {hasFlags ? (
        <div className={styles.flags}>
          {isNext ? <span className={styles.nextLabel}>Next up</span> : null}
          {overdue ? (
            <span className={styles.overdueFlag}>
              <span aria-hidden="true">◷</span> Overdue
            </span>
          ) : null}
          {unassigned ? <span className={styles.unassignedFlag}>Unassigned</span> : null}
          {showPendingSync ? <PendingSyncDot jobId={job.id} /> : null}
        </div>
      ) : null}
      <h3 className={styles.title}>
        <Link href={`/jobs/${job.id}`} className={styles.titleLink}>
          {job.title}
        </Link>
      </h3>
      <p className={styles.customer}>{job.customerName}</p>
      {address ? <p className={styles.meta}>{address}</p> : null}
      <p className={styles.meta}>
        {showDate && date ? `${date} · ` : ''}
        {window ?? 'No time window'}
      </p>
      <div className={styles.badges}>
        {isStatusKey(job.status) ? (
          <StatusPill status={job.status} />
        ) : (
          <span className="status-pill">{job.status.replaceAll('_', ' ')}</span>
        )}
        {isPriorityKey(job.priority) ? (
          <PriorityBadge priority={job.priority} />
        ) : (
          <span className="priority-badge">{job.priority}</span>
        )}
      </div>
    </article>
  );
}
