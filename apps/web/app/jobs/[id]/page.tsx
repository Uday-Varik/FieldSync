import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { fetchJob, fetchJobActivity, fetchMe } from '../../../lib/api';
import JobActions from '../../../components/JobActions';
import TechnicianStatusBar from '../../../components/TechnicianStatusBar';
import ChecklistToggles from '../../../components/ChecklistToggles';
import JobNotesForm from '../../../components/JobNotesForm';
import SignaturePad from '../../../components/SignaturePad';
import JobSheetDownload from '../../../components/JobSheetDownload';
import PhotoSection from '../../../components/PhotoSection';
import YjsNotes from '../../../components/YjsNotes';
import CacheJobs from '../../../components/CacheJobs';
import { ConflictBanner, FailedNotices } from '../../../components/SyncNotices';
import PageHeader from '../../../components/ui/PageHeader';
import EmptyState from '../../../components/ui/EmptyState';
import {
  PRIORITY_DISPLAY,
  STATUS_DISPLAY,
  PriorityBadge,
  StatusPill,
  type JobStatusKey,
  type PriorityKey,
} from '../../../components/ui/StatusPill';
import { PendingSyncDot } from '../../../components/ui/SyncBadge';
import {
  describeActivity,
  describeSyncResolution,
  formatActivityTime,
  type ActivityEntry,
} from '../../../lib/activity-presentation';
import styles from './page.module.css';

// Job detail (docs/17 slice (c); docs/06 S13/S21).
// Scannable sections with clear headings: header, job
// details, contact actions, the sticky technician status
// bar, checklist, notes, photos, signature, job sheet,
// dispatcher/admin actions, and the audit timeline.
// The internal optimistic-concurrency `version` is used
// for mutations but never shown to the user. The stale
// Phase 2 footer copy is removed: photos, signature, and
// the PDF job sheet are all on this page. Data fetching,
// role scoping, and mutation behaviour are unchanged.
export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return (
      <main className={styles.page}>
        <PageHeader title="Job detail" />
        <p>
          <Link href="/sign-in" className={styles.textLink}>
            Sign in
          </Link>{' '}
          to view this job.
        </p>
      </main>
    );
  }
  const token = await getToken();
  const [jobRes, activityRes, meRes] = await Promise.all([
    fetchJob(token, params.id),
    fetchJobActivity(token, params.id),
    fetchMe(token),
  ]);
  if (jobRes.error) {
    if (jobRes.errorCode === 'USER_NOT_LINKED') {
      return (
        <main className={styles.page}>
          <PageHeader title="Job detail" />
          <p>Your account isn&apos;t linked to a company yet.</p>
          <p>How access works: first create an account (sign up), then a company admin must invite you and link your account. Signing in alone doesn&apos;t grant access — jobs appear only after your account is linked.</p>
          <p>
            <Link href="/board" className={styles.textLink}>
              Back to board
            </Link>
          </p>
        </main>
      );
    }
    return (
      <main className={styles.page}>
        <PageHeader title="Job detail" />
        <EmptyState
          heading="This job could not be loaded"
          body="It may not exist, or the service may be unavailable right now."
        >
          <Link href={`/jobs/${params.id}`} className={styles.secondaryLink}>
            Try again
          </Link>
          <Link href="/board" className={styles.textLink}>
            Back to board
          </Link>
        </EmptyState>
      </main>
    );
  }
  const job = jobRes.data as any;
  const me = meRes.data as any;
  const role = me?.role as string | undefined;
  const isAssignedTechnician = role === 'TECHNICIAN' && job.assignedTechnicianId === me?.id;
  const canToggle = role === 'ADMIN' || role === 'DISPATCHER' || isAssignedTechnician;
  const activity = (activityRes.data?.data ?? []) as ActivityEntry[];
  const checklistLabels: Record<string, string> = Object.fromEntries(
    (job.checklist ?? []).map((item: any) => [item.id, item.label]),
  );
  const addressParts = [job.addressLine1, job.addressLine2].filter(Boolean);
  const cityPart = `${job.city}, ${job.state} ${job.postalCode}`.trim();
  const address = [...addressParts, cityPart].filter(Boolean).join(', ');
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  const statusKey = job.status in STATUS_DISPLAY ? (job.status as JobStatusKey) : null;
  const priorityKey = job.priority in PRIORITY_DISPLAY ? (job.priority as PriorityKey) : null;
  // Unknown status/priority values (not one of the seven /
  // four keys) are shown humanised with spaces, as in the
  // map panel and job cards — never a raw code.
  const humaniseCode = (code: unknown): string => String(code).replaceAll('_', ' ');
  const signature = (job.signatures ?? [])[0] as any;
  const isTerminal = job.status === 'COMPLETED' || job.status === 'CANCELLED';

  return (
    <main className={styles.page}>
      <CacheJobs jobs={[job]} />
      <ConflictBanner jobId={job.id} />
      <FailedNotices jobId={job.id} />
      <p className={styles.backNav}>
        <Link href="/board" className={styles.textLink}>
          ← Board
        </Link>
        <Link href="/my-day" className={styles.textLink}>
          My Day
        </Link>
      </p>

      <header className={styles.header}>
        <h1>{job.title}</h1>
        <div className={styles.pills}>
          {statusKey ? <StatusPill status={statusKey} /> : <span>{humaniseCode(job.status)}</span>}
          {priorityKey ? <PriorityBadge priority={priorityKey} /> : <span>{humaniseCode(job.priority)}</span>}
          <PendingSyncDot jobId={job.id} />
        </div>
      </header>

      <section className={styles.section} aria-label="Job details">
        <dl className={styles.details}>
          <dt>Customer</dt>
          <dd>{job.customerName}</dd>
          {job.customerPhone && (
            <>
              <dt>Phone</dt>
              <dd>{job.customerPhone}</dd>
            </>
          )}
          <dt>Address</dt>
          <dd>{address}</dd>
          <dt>Scheduled</dt>
          <dd>
            {job.scheduledDate?.slice(0, 10)} {job.scheduledWindowStart}–{job.scheduledWindowEnd}
          </dd>
          <dt>Assignment</dt>
          <dd>
            {job.assignedTechnicianId ? (
              <>
                Assigned technician ID: <span className={styles.mono}>{job.assignedTechnicianId}</span>
              </>
            ) : (
              'Unassigned'
            )}
          </dd>
          {job.description && (
            <>
              <dt>Description</dt>
              <dd>{job.description}</dd>
            </>
          )}
        </dl>
      </section>

      <section className={styles.section} aria-label="Contact actions">
        <p className={styles.contactActions}>
          {job.customerPhone && (
            <a href={`tel:${job.customerPhone}`} className={styles.secondaryLink}>
              Call customer
            </a>
          )}
          <a href={mapsUrl} target="_blank" rel="noreferrer" className={styles.secondaryLink}>
            Navigate
          </a>
        </p>
      </section>

      {isAssignedTechnician && <TechnicianStatusBar jobId={job.id} status={job.status} jobVersion={job.version ?? 0} />}

      <section className={styles.section} aria-labelledby="checklist-heading">
        <h2 className={styles.sectionHeading} id="checklist-heading">
          Checklist
        </h2>
        {canToggle ? (
          <ChecklistToggles jobId={job.id} items={job.checklist ?? []} jobVersion={job.version ?? 0} />
        ) : (job.checklist ?? []).length === 0 ? (
          <p className={styles.muted}>No checklist items yet.</p>
        ) : (
          <ul className={styles.readonlyList}>
            {(job.checklist ?? []).map((item: any) => (
              <li key={item.id}>
                <span aria-hidden="true">{item.isChecked ? '✓' : '○'}</span> {item.label}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canToggle && (
        <section className={styles.section} aria-labelledby="notes-heading">
          <h2 className={styles.sectionHeading} id="notes-heading">
            Notes
          </h2>
          <p className={styles.notesIntro}>
            There are two separate notes on this job. Job notes are saved on the job record; shared notes are a separate
            document that syncs live between people viewing the job. Editing one does not change the other.
          </p>
          <div className={styles.notes}>
            <JobNotesForm jobId={job.id} initialNotes={job.internalNotes ?? ''} jobVersion={job.version ?? 0} />
            <YjsNotes jobId={job.id} userName={me?.name ?? 'FieldSync user'} />
          </div>
        </section>
      )}

      <section className={styles.section}>
        <PhotoSection jobId={job.id} canUpload={canToggle && !isTerminal} jobVersion={job.version ?? 0} />
      </section>

      <section className={styles.section} aria-labelledby="signature-heading">
        <h2 className={styles.sectionHeading} id="signature-heading">
          Signature
        </h2>
        {signature ? (
          <div className={styles.section}>
            <p className={styles.signatureMeta}>
              Signed by {signature.signedByName} on {signature.signedAt?.slice(0, 19).replace('T', ' ')}
            </p>
            {typeof signature.storageKey === 'string' && signature.storageKey.startsWith('data:') && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signature.storageKey} alt="Customer signature" className={styles.signatureImage} />
            )}
          </div>
        ) : (
          <p className={styles.muted}>No signature yet.</p>
        )}
        {canToggle && !isTerminal && <SignaturePad jobId={job.id} />}
      </section>

      {job.status === 'COMPLETED' && (
        <section className={styles.section} aria-labelledby="job-sheet-heading">
          <h2 className={styles.sectionHeading} id="job-sheet-heading">
            Job sheet
          </h2>
          <JobSheetDownload jobId={job.id} />
        </section>
      )}

      {role && role !== 'TECHNICIAN' && <JobActions jobId={job.id} status={job.status} role={role} />}

      <section className={styles.section} aria-labelledby="audit-heading">
        <h2 className={styles.sectionHeading} id="audit-heading">
          Audit timeline
        </h2>
        {activityRes.error ? (
          <p className={styles.muted}>Activity could not be loaded.</p>
        ) : activity.length === 0 ? (
          <p className={styles.muted}>No activity yet.</p>
        ) : (
          <ol className={styles.timeline}>
            {activity.map((a) => {
              const resolution = describeSyncResolution(a);
              const offline = (a.metadata as any)?.offline;
              return (
                <li key={a.id} className={styles.timelineEntry}>
                  <p className={styles.timelineTime}>
                    <time dateTime={a.createdAt}>{formatActivityTime(a.createdAt)}</time>
                  </p>
                  <p>
                    {describeActivity(a, checklistLabels)}
                    {offline ? ' (synced offline)' : ''}
                  </p>
                  {resolution && <p>{resolution}</p>}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
