import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { fetchJobs } from '../../lib/api';
import CacheJobs from '../../components/CacheJobs';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import JobCard from '../../components/ui/JobCard';
import { SyncBadge } from '../../components/ui/SyncBadge';
import {
  isOverdue,
  sortByWindowStart,
  type BoardJob,
} from '../../lib/job-presentation';
import styles from './page.module.css';

// Technician My Day (docs/17 slice (b); docs/06 S20, docs/11 S20).
// Today's jobs in window order, Overdue first, with a status
// pill, priority badge, address, and pending-sync dot per row.
// The date query and the America/Chicago company day are
// unchanged from before: this page asks the existing API for
// today's jobs only, so the Overdue group covers today's jobs
// whose window end has passed — past-date jobs are not
// returned by that query. The stale "Read-only in Phase 1…"
// copy is removed: status changes, checklist toggles, photos,
// and signature have all lived on the job detail page since
// Phase 2. The list itself stays read-only with links to job
// detail, as before; CacheJobs auto-caching is unchanged.
// Pending sync is shown only from the offline state the app
// already knows (SyncBadge / per-row dot) — no last-synced
// timestamp is invented, because the sync worker has none.
export default async function MyDayPage() {
  const { userId, getToken } = await auth();
  if (!userId) {
    return (
      <main className={styles.page}>
        <PageHeader title="My Day" />
        <p>
          <Link href="/sign-in" className={styles.textLink}>
            Sign in
          </Link>{' '}
          to view My Day.
        </p>
      </main>
    );
  }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const result = await fetchJobs(await getToken(), `date=${today}&limit=100`);
  if (result.error) {
    if (result.errorCode === 'USER_NOT_LINKED') {
      return (
        <main className={styles.page}>
          <PageHeader title="My Day" />
          <p>Your account isn&apos;t linked to a company yet.</p>
          <p>How access works: first create an account (sign up), then a company admin must invite you and link your account. Signing in alone doesn&apos;t grant access — jobs appear only after your account is linked.</p>
        </main>
      );
    }
    return (
      <main className={styles.page}>
        <PageHeader title="My Day" />
        <p>
          Jobs couldn&apos;t be loaded right now. The service isn&apos;t
          responding — try again.
        </p>
        <p>
          <Link href="/my-day" className={styles.secondaryLink}>
            Retry
          </Link>
        </p>
      </main>
    );
  }
  const jobs = (result.data?.data ?? []) as BoardJob[];
  const flagged = jobs.map((job) => ({ job, overdue: isOverdue(job) }));
  const overdueJobs = sortByWindowStart(
    flagged.filter((f) => f.overdue).map((f) => f.job),
  );
  const todayJobs = sortByWindowStart(
    flagged.filter((f) => !f.overdue).map((f) => f.job),
  );
  const completedCount = jobs.filter((job) => job.status === 'COMPLETED').length;
  // Next job: the first overdue job, otherwise the first
  // not-yet-finished job in window order.
  const nextJob =
    overdueJobs[0] ??
    todayJobs.find((job) => job.status !== 'COMPLETED' && job.status !== 'CANCELLED');
  const progress =
    jobs.length > 0 ? `${completedCount} of ${jobs.length} completed.` : '';

  return (
    <main className={styles.page}>
      <CacheJobs jobs={jobs} />
      <PageHeader
        title={`My Day — ${today}`}
        supporting={`Jobs scheduled for ${today} (America/Chicago). ${progress}`}
      >
        <SyncBadge />
      </PageHeader>
      {jobs.length === 0 ? (
        <EmptyState
          heading="No jobs scheduled for today."
          body="You're clear for today."
        >
          <Link href="/board">View the board</Link>
        </EmptyState>
      ) : (
        <>
          {overdueJobs.length > 0 ? (
            <section aria-label="Overdue">
              <h2 className={styles.groupTitle}>Overdue ({overdueJobs.length})</h2>
              <ul className={styles.rows}>
                {overdueJobs.map((job) => (
                  <li key={job.id}>
                    <JobCard
                      job={job}
                      overdue
                      isNext={nextJob?.id === job.id}
                      showPendingSync
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {todayJobs.length > 0 ? (
            <section aria-label="Today">
              <h2 className={styles.groupTitle}>Today ({todayJobs.length})</h2>
              <ul className={styles.rows}>
                {todayJobs.map((job) => (
                  <li key={job.id}>
                    <JobCard
                      job={job}
                      overdue={false}
                      isNext={nextJob?.id === job.id}
                      showPendingSync
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
