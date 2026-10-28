// Shared types + constants only — no runtime logic, no DB, no UI.
// Single source of truth for status/priority styling (docs/06 rule:
// do not hardcode colours per screen).

export const JOB_STATUSES = [
  'SCHEDULED',
  'EN_ROUTE',
  'ON_SITE',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export type Priority = (typeof PRIORITIES)[number];

// Valid next statuses per docs/03 state machine, including Admin reopen.
export const VALID_NEXT_STATUSES: Record<JobStatus, JobStatus[]> = {
  SCHEDULED: ['EN_ROUTE', 'ON_HOLD', 'CANCELLED'],
  EN_ROUTE: ['ON_SITE', 'ON_HOLD', 'CANCELLED'],
  ON_SITE: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'ON_HOLD', 'CANCELLED'],
  ON_HOLD: ['SCHEDULED', 'EN_ROUTE', 'ON_SITE', 'IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [], // Admin reopen is a separate endpoint, not a status transition
  CANCELLED: [],
};

export const STATUS_STYLES: Record<JobStatus, { label: string; badge: string }> = {
  SCHEDULED: { label: 'Scheduled', badge: 'bg-slate-200 text-slate-800' },
  EN_ROUTE: { label: 'En route', badge: 'bg-blue-200 text-blue-900' },
  ON_SITE: { label: 'On site', badge: 'bg-violet-200 text-violet-900' },
  IN_PROGRESS: { label: 'In progress', badge: 'bg-amber-200 text-amber-900' },
  ON_HOLD: { label: 'On hold', badge: 'bg-zinc-300 text-zinc-800' },
  COMPLETED: { label: 'Completed', badge: 'bg-emerald-200 text-emerald-900' },
  CANCELLED: { label: 'Cancelled', badge: 'bg-red-200 text-red-900' },
};

export const PRIORITY_STYLES: Record<Priority, string> = {
  LOW: 'bg-slate-100 text-slate-700',
  NORMAL: 'bg-slate-100 text-slate-700',
  HIGH: 'bg-amber-200 text-amber-900',
  URGENT: 'bg-red-200 text-red-900',
};
