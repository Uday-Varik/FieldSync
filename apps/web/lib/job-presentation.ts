// Presentation helpers for the board and My Day pages
// (docs/17 slice (b)). These use ONLY fields the existing
// GET /jobs list endpoint already returns — no API change.
// Nothing here invents data: a job with no address, window,
// or assignee simply renders without that line/flag.
//
// Overdue rule (docs/05 US-D4, docs/17 §2.3): a job past its
// window end without completion. The window end is a wall-clock
// time on the job's scheduled date in the company day
// (America/Chicago, the same day My Day queries). A job is
// overdue when its scheduled date is before today, or when it
// is scheduled for today and its window end has passed.
// COMPLETED and CANCELLED jobs are never overdue. The
// date=today query My Day already uses means its Overdue group
// can only cover today's passed windows — past-date overdue
// jobs are not returned by that query, and this helper does
// not change the query (see the slice (b) PR description).

export type BoardJob = {
  id: string;
  title: string;
  customerName: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  scheduledDate?: string | null;
  scheduledWindowStart?: string | null;
  scheduledWindowEnd?: string | null;
  status: string;
  priority: string;
  assignedTechnicianId?: string | null;
};

function chicagoDayAndTime(now: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

export function jobDate(job: BoardJob): string | null {
  if (!job.scheduledDate) return null;
  return job.scheduledDate.slice(0, 10);
}

export function isOverdue(job: BoardJob, now: Date = new Date()): boolean {
  if (job.status === 'COMPLETED' || job.status === 'CANCELLED') return false;
  const date = jobDate(job);
  if (!date) return false;
  const { date: today, time: nowTime } = chicagoDayAndTime(now);
  if (date < today) return true;
  if (date > today) return false;
  const windowEnd = (job.scheduledWindowEnd ?? '').slice(0, 5);
  if (!windowEnd) return false;
  return windowEnd < nowTime;
}

export function addressShort(job: BoardJob): string | null {
  const parts = [job.addressLine1, job.city].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(', ');
}

export function windowLabel(job: BoardJob): string | null {
  if (!job.scheduledWindowStart || !job.scheduledWindowEnd) return null;
  return `${job.scheduledWindowStart}–${job.scheduledWindowEnd}`;
}

// Window order for a single day's jobs (docs/06 S20): sort by
// window start, keeping the API's order for ties (stable sort).
// The API returns scheduledDate, then createdAt — not window
// order — so the page orders the already-returned jobs itself;
// no new sort contract and no API change (see docs/15 entry
// for slice (b)).
export function sortByWindowStart(jobs: BoardJob[]): BoardJob[] {
  return [...jobs].sort((a, b) => {
    const aStart = a.scheduledWindowStart ?? '';
    const bStart = b.scheduledWindowStart ?? '';
    if (!aStart && !bStart) return 0;
    if (!aStart) return 1;
    if (!bStart) return -1;
    return aStart < bStart ? -1 : aStart > bStart ? 1 : 0;
  });
}
