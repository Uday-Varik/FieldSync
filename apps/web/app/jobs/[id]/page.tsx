import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { fetchJob, fetchJobActivity, fetchMe } from '../../../lib/api';
import JobActions from '../../../components/JobActions';

// Phase 1 job detail: detail + checklist (display only here;
// toggles are Phase 2 mobile workflow) + audit timeline from
// GET /jobs/:id/activity. That timeline is the Phase 1 audit
// DoD item: "audit timeline shows on job detail".
export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return (
      <main style={{ padding: '2rem' }}>
        <p><Link href="/sign-in">Sign in</Link> to view this job.</p>
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
    return (
      <main style={{ padding: '2rem' }}>
        <p>Job not found, or the API is unavailable.</p>
        <p><Link href="/board">Back to board</Link></p>
      </main>
    );
  }
  const job = jobRes.data as any;
  const role = (meRes.data as any)?.role as string | undefined;
  const activity = (activityRes.data?.data ?? []) as any[];

  return (
    <main style={{ padding: '2rem' }}>
      <p><Link href="/board">← Board</Link> · <Link href="/my-day">My Day</Link></p>
      <h1>{job.title}</h1>
      <p>Status: {job.status} · Priority: {job.priority} · Version: {job.version}</p>
      <p>Customer: {job.customerName} {job.customerPhone ? `(${job.customerPhone})` : ''}</p>
      <p>
        Address: {job.addressLine1} {job.addressLine2 ?? ''}, {job.city}, {job.state} {job.postalCode}
      </p>
      <p>Scheduled: {job.scheduledDate?.slice(0, 10)} {job.scheduledWindowStart}–{job.scheduledWindowEnd}</p>
      {job.description && <p>{job.description}</p>}
      <h2>Checklist</h2>
      {(job.checklist ?? []).length === 0 ? (
        <p>No checklist items yet.</p>
      ) : (
        <ul>
          {(job.checklist ?? []).map((item: any) => (
            <li key={item.id}>{item.isChecked ? '✓' : '○'} {item.label}</li>
          ))}
        </ul>
      )}
      {role && role !== 'TECHNICIAN' && <JobActions jobId={job.id} status={job.status} role={role} />}
      <h2>Audit timeline</h2>
      {activity.length === 0 ? (
        <p>No activity yet.</p>
      ) : (
        <ul>
          {activity.map((a: any) => (
            <li key={a.id}>
              {a.createdAt?.slice(0, 19).replace('T', ' ')} — {a.action}
              {a.fromValue ? ` (${JSON.stringify(a.fromValue)} → ${JSON.stringify(a.toValue)})` : ''}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
