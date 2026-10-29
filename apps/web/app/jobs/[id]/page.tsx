import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { fetchJob, fetchJobActivity, fetchMe } from '../../../lib/api';
import JobActions from '../../../components/JobActions';
import TechnicianStatusBar from '../../../components/TechnicianStatusBar';
import ChecklistToggles from '../../../components/ChecklistToggles';
import JobNotesForm from '../../../components/JobNotesForm';
import SignaturePad from '../../../components/SignaturePad';
import JobSheetDownload from '../../../components/JobSheetDownload';

// Phase 2 mobile job detail: status action bar, call/navigate,
// checklist toggles, and plain-text notes (Yjs comes in Phase 3).
// Phase 1 job detail (detail + audit timeline) is preserved below.
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
  const me = meRes.data as any;
  const role = me?.role as string | undefined;
  const isAssignedTechnician = role === 'TECHNICIAN' && job.assignedTechnicianId === me?.id;
  const canToggle = role === 'ADMIN' || role === 'DISPATCHER' || isAssignedTechnician;
  const activity = (activityRes.data?.data ?? []) as any[];
  const address = `${job.addressLine1} ${job.addressLine2 ?? ''}, ${job.city}, ${job.state} ${job.postalCode}`.trim();
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <main style={{ padding: '1rem', maxWidth: '720px', margin: '0 auto' }}>
      <p><Link href="/board">← Board</Link> · <Link href="/my-day">My Day</Link></p>
      <h1>{job.title}</h1>
      <p>Status: {job.status} · Priority: {job.priority} · Version: {job.version}</p>
      <p>Customer: {job.customerName} {job.customerPhone ? `(${job.customerPhone})` : ''}</p>
      <p>Address: {address}</p>
      <p>Scheduled: {job.scheduledDate?.slice(0, 10)} {job.scheduledWindowStart}–{job.scheduledWindowEnd}</p>
      {job.description && <p>{job.description}</p>}

      <section style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '1rem 0' }}>
        {job.customerPhone && (
          <a href={`tel:${job.customerPhone}`} style={{ minHeight: '44px', display: 'inline-flex', alignItems: 'center', padding: '0.75rem 1rem', border: '1px solid #ccc' }}>
            Call customer
          </a>
        )}
        <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ minHeight: '44px', display: 'inline-flex', alignItems: 'center', padding: '0.75rem 1rem', border: '1px solid #ccc' }}>
          Navigate
        </a>
      </section>

      {isAssignedTechnician && <TechnicianStatusBar jobId={job.id} status={job.status} />}

      <h2>Checklist</h2>
      {canToggle ? (
        <ChecklistToggles jobId={job.id} items={job.checklist ?? []} />
      ) : (job.checklist ?? []).length === 0 ? (
        <p>No checklist items yet.</p>
      ) : (
        <ul>
          {(job.checklist ?? []).map((item: any) => (
            <li key={item.id}>{item.isChecked ? '✓' : '○'} {item.label}</li>
          ))}
        </ul>
      )}

      {canToggle && <JobNotesForm jobId={job.id} initialNotes={job.internalNotes ?? ''} />}

      <h2>Signature</h2>
      {(job.signatures ?? []).length > 0 ? (
        <div>
          <p>
            Signed by {(job.signatures[0] as any).signedByName} on {(job.signatures[0] as any).signedAt?.slice(0, 19).replace('T', ' ')}
          </p>
          {typeof (job.signatures[0] as any).storageKey === 'string' && (job.signatures[0] as any).storageKey.startsWith('data:') && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={(job.signatures[0] as any).storageKey} alt="Customer signature" style={{ border: '1px solid #ccc', maxWidth: '320px' }} />
          )}
        </div>
      ) : (
        <p>No signature yet.</p>
      )}
      {canToggle && job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && <SignaturePad jobId={job.id} />}
      {job.status === 'COMPLETED' && <JobSheetDownload jobId={job.id} />}

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
      <p style={{ fontSize: '0.9rem' }}>
        Photos, signature, and PDF job sheet are the next Phase 2 slices — not in this one.
      </p>
    </main>
  );
}
