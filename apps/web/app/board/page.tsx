import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { fetchJobs, fetchMe } from '../../lib/api';
import LiveBoard from '../../components/LiveBoard';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import JobCard from '../../components/ui/JobCard';
import {
  STATUS_DISPLAY,
  StatusPill,
  type JobStatusKey,
} from '../../components/ui/StatusPill';
import {
  isOverdue,
  type BoardJob,
} from '../../lib/job-presentation';
import styles from './page.module.css';

// Dispatcher board (docs/17 slice (b); docs/06 S11, docs/11 S11).
// Grouped by status, with StatusPill/PriorityBadge cards, per-status
// counts, and persistent Overdue/Unassigned counts (US-D4) computed
// from the jobs the existing API already returns (limit 100) — no
// API change. Search + status + date stay a GET form (shareable,
// back-button-safe, as before); the date control uses the API's
// existing `date` query parameter. Refresh preserves the active
// filters instead of dropping them; Clear filters returns to the
// unfiltered board. Technicians who open this page see only their
// own assigned jobs, because the API scopes the list server-side
// — the UI does not filter by role, and the heading says so.
// Status changes stay button-driven on the job detail page: no
// drag-to-reorder and no board-inline status change (not in the
// current behaviour, not invented here). Realtime updates,
// presence, and manual refresh work exactly as before (LiveBoard).
const STATUSES = [
  'SCHEDULED',
  'EN_ROUTE',
  'ON_SITE',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
] as const satisfies readonly JobStatusKey[];

export default async function BoardPage({
  searchParams,
}: {
  searchParams?: { search?: string; status?: string; date?: string };
}) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return (
      <main className={styles.page}>
        <PageHeader title="Board" />
        <p>
          <Link href="/sign-in" className={styles.textLink}>
            Sign in
          </Link>{' '}
          to view the board.
        </p>
      </main>
    );
  }

  // Role only for the heading: technicians see their assigned
  // jobs. The /me fetch never breaks the page — an unavailable
  // account renders the default heading, and scoping stays
  // server-side in the API.
  let isTechnician = false;
  try {
    const me = await fetchMe(await getToken());
    isTechnician = (me.data as { role?: string } | null)?.role === 'TECHNICIAN';
  } catch {
    isTechnician = false;
  }

  const query = new URLSearchParams();
  if (searchParams?.search) query.set('search', searchParams.search);
  if (searchParams?.status) query.set('status', searchParams.status);
  if (searchParams?.date) query.set('date', searchParams.date);
  query.set('limit', '100');
  const result = await fetchJobs(await getToken(), query.toString());

  // Refresh and retry keep the active filters: the same query
  // string the page was loaded with, or the plain board URL.
  const filterQuery = new URLSearchParams();
  if (searchParams?.search) filterQuery.set('search', searchParams.search);
  if (searchParams?.status) filterQuery.set('status', searchParams.status);
  if (searchParams?.date) filterQuery.set('date', searchParams.date);
  const filterString = filterQuery.toString();
  const refreshHref = filterString ? `/board?${filterString}` : '/board';
  const hasFilters = filterString.length > 0;

  if (result.error) {
    if (result.errorCode === 'USER_NOT_LINKED') {
      return (
        <main className={styles.page}>
          <PageHeader title="Board" />
          <p>Your account isn&apos;t linked to a company yet.</p>
          <p>How access works: first create an account (sign up), then a company admin must invite you and link your account. Signing in alone doesn&apos;t grant access — jobs appear only after your account is linked.</p>
        </main>
      );
    }
    return (
      <main className={styles.page}>
        <PageHeader title="Board" />
        <p>
          Jobs couldn&apos;t be loaded right now. The service isn&apos;t
          responding — try again.
        </p>
        <p>
          <Link href={refreshHref} className={styles.secondaryLink}>
            Retry
          </Link>
        </p>
      </main>
    );
  }

  const jobs = (result.data?.data ?? []) as BoardJob[];
  const total = result.data?.total ?? jobs.length;
  const flagged = jobs.map((job) => ({ job, overdue: isOverdue(job) }));
  const grouped: Record<JobStatusKey, BoardJob[]> = {
    SCHEDULED: [],
    EN_ROUTE: [],
    ON_SITE: [],
    IN_PROGRESS: [],
    ON_HOLD: [],
    COMPLETED: [],
    CANCELLED: [],
  };
  const overdueById = new Map(flagged.map((f) => [f.job.id, f.overdue]));
  for (const { job } of flagged) {
    if (job.status in grouped) {
      grouped[job.status as JobStatusKey].push(job);
    }
  }
  const overdueCount = flagged.filter((f) => f.overdue).length;
  const unassignedCount = jobs.filter((job) => !job.assignedTechnicianId).length;
  const statusFilter = searchParams?.status ?? '';
  const visibleStatuses: JobStatusKey[] =
    statusFilter && (STATUSES as readonly string[]).includes(statusFilter)
      ? [statusFilter as JobStatusKey]
      : [...STATUSES];

  return (
    <main className={styles.page}>
      <PageHeader
        title={isTechnician ? 'Your jobs' : 'Board'}
        supporting={isTechnician ? 'Jobs assigned to you.' : undefined}
      />
      <LiveBoard />
      <form method="get" className={styles.filters}>
        <div className={styles.field}>
          <label htmlFor="board-search">Search title or customer</label>
          <input
            id="board-search"
            name="search"
            placeholder="Search title or customer"
            defaultValue={searchParams?.search ?? ''}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="board-status">Filter by status</label>
          <select
            id="board-status"
            name="status"
            defaultValue={statusFilter}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_DISPLAY[s].label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="board-date">Date</label>
          <input
            id="board-date"
            type="date"
            name="date"
            defaultValue={searchParams?.date ?? ''}
          />
        </div>
        <button type="submit" className={styles.primaryButton}>
          Search
        </button>
        <Link href={refreshHref} className={styles.secondaryLink}>
          Refresh
        </Link>
        {hasFilters ? (
          <Link href="/board" className={styles.secondaryLink}>
            Clear filters
          </Link>
        ) : null}
      </form>
      <p className={styles.summary}>
        {total === 1 ? '1 job found.' : `${total} jobs found.`}
        {total > jobs.length ? ` Showing ${jobs.length} of ${total}.` : ''}
      </p>
      <div className={styles.counts}>
        <span className={`${styles.chip} ${styles.chipDanger}`}>
          Overdue: {overdueCount}
        </span>
        <span className={`${styles.chip} ${styles.chipWarning}`}>
          Unassigned: {unassignedCount}
        </span>
        {!statusFilter
          ? STATUSES.map((s) => (
              <span key={s} className={styles.chip}>
                {STATUS_DISPLAY[s].label}: {grouped[s].length}
              </span>
            ))
          : null}
      </div>
      {jobs.length === 0 ? (
        <EmptyState
          heading="No jobs found"
          body={
            hasFilters
              ? 'Try a different search, status, or date, or clear the filters to see all jobs.'
              : 'No jobs have been created yet.'
          }
        >
          {hasFilters ? (
            <Link href="/board">Clear filters</Link>
          ) : !isTechnician ? (
            <Link href="/jobs/new">Create a job</Link>
          ) : undefined}
        </EmptyState>
      ) : (
        <div className={styles.board}>
          {visibleStatuses.map((status) => (
            <section key={status} className={styles.group} aria-label={STATUS_DISPLAY[status].label}>
              <h2 className={styles.groupTitle}>
                <StatusPill status={status} />{' '}
                <span className={styles.groupCount}>({grouped[status].length})</span>
              </h2>
              {grouped[status].length === 0 ? (
                <p className={styles.groupEmpty}>No jobs in this status.</p>
              ) : (
                <ul className={styles.cards}>
                  {grouped[status].map((job) => (
                    <li key={job.id}>
                      <JobCard
                        job={job}
                        overdue={overdueById.get(job.id) ?? false}
                        showDate
                        showUnassigned
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
