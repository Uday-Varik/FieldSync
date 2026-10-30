import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { fetchJobs } from '../../lib/api';
import CacheJobs from '../../components/CacheJobs';

// Phase 1 technician My Day: read-only, online only.
// The API scopes technicians to their assigned jobs, so this
// page simply asks for today's jobs — it does not need to
// know who the technician is. Date is in the company's
// America/Chicago day (seed company timezone); a full
// timezone-aware version comes with the mobile workflow.
export default async function MyDayPage() {
  const { userId, getToken } = await auth();
  if (!userId) {
    return (
      <main style={{ padding: '2rem' }}>
        <p><Link href="/sign-in">Sign in</Link> to view My Day.</p>
      </main>
    );
  }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const result = await fetchJobs(await getToken(), `date=${today}&limit=100`);
  if (result.error) {
    return (
      <main style={{ padding: '2rem' }}>
        <h1>My Day</h1>
        <p>API unavailable right now. Start the API on :3001 and refresh.</p>
      </main>
    );
  }
  const jobs = (result.data?.data ?? []) as any[];
  return (
    <main style={{ padding: '2rem' }}>
      <CacheJobs jobs={jobs} />
      <h1>My Day — {today}</h1>
      <p>Read-only in Phase 1. Status changes, checklist toggles, photos, and signature come in Phase 2.</p>
      {jobs.length === 0 ? (
        <p>No jobs scheduled for today.</p>
      ) : (
        <ul>
          {jobs.map((job) => (
            <li key={job.id}>
              <Link href={`/jobs/${job.id}`}>{job.title}</Link>
              {' — '}{job.customerName} · {job.scheduledWindowStart}–{job.scheduledWindowEnd} · {job.status} · {job.priority}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
