import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { fetchJobs } from '../../lib/api';

// Phase 1 dispatcher board: desktop, no map, no realtime.
// Manual refresh is acceptable in this phase only (plan §Phase 1);
// Phase 3 replaces it with live updates. Technicians who open
// this page see only their own assigned jobs, because the API
// scopes the list server-side — the UI does not filter by role.
const STATUSES = ['SCHEDULED', 'EN_ROUTE', 'ON_SITE', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];

export default async function BoardPage({
  searchParams,
}: {
  searchParams?: { search?: string; status?: string };
}) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return (
      <main style={{ padding: '2rem' }}>
        <p><Link href="/sign-in">Sign in</Link> to view the board.</p>
      </main>
    );
  }
  const query = new URLSearchParams();
  if (searchParams?.search) query.set('search', searchParams.search);
  if (searchParams?.status) query.set('status', searchParams.status);
  query.set('limit', '100');
  const result = await fetchJobs(await getToken(), query.toString());
  if (result.error) {
    return (
      <main style={{ padding: '2rem' }}>
        <h1>Board</h1>
        <p>API unavailable right now. Start the API on :3001 and refresh.</p>
      </main>
    );
  }
  const jobs = (result.data?.data ?? []) as any[];
  const grouped: Record<string, any[]> = {};
  for (const s of STATUSES) grouped[s] = [];
  for (const job of jobs) (grouped[job.status] ?? (grouped[job.status] = [])).push(job);

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Dispatcher board</h1>
      <form method="get" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input name="search" placeholder="Search title or customer" defaultValue={searchParams?.search ?? ''} />
        <select name="status" defaultValue={searchParams?.status ?? ''}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button type="submit">Search</button>
        <Link href="/board">Refresh</Link>
      </form>
      <p>{result.data?.total ?? jobs.length} job(s) found.</p>
      {STATUSES.map((status) => (
        <section key={status} style={{ marginBottom: '1.5rem' }}>
          <h2>{status} ({grouped[status]?.length ?? 0})</h2>
          <ul>
            {(grouped[status] ?? []).map((job) => (
              <li key={job.id}>
                <Link href={`/jobs/${job.id}`}>{job.title}</Link>
                {' — '}{job.customerName} · {job.scheduledDate?.slice(0, 10)} {job.scheduledWindowStart}–{job.scheduledWindowEnd} · {job.priority}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
