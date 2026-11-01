// Shared types + constants only — no runtime logic, no DB, no UI.
// Single source of truth for status/priority display (docs/06 rule:
// do not hardcode colours per screen; docs/17 §2.3).
//
// The style values are token references, not Tailwind class
// strings: `token` is the value of the data-status /
// data-priority attribute that apps/web/app/globals.css styles,
// `label` is the human label shown everywhere, and `glyph` is
// the non-colour signal paired with the colour. No Tailwind is
// installed and no web file consumed the old class strings.
// Shape change (slice (a), docs/17 §2.3): verified safe —
// nothing in apps/web or apps/api imports this package.

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

export const STATUS_STYLES: Record<
  JobStatus,
  { label: string; glyph: string; token: string }
> = {
  SCHEDULED: { label: 'Scheduled', glyph: '○', token: 'SCHEDULED' },
  EN_ROUTE: { label: 'En route', glyph: '→', token: 'EN_ROUTE' },
  ON_SITE: { label: 'On site', glyph: '◎', token: 'ON_SITE' },
  IN_PROGRESS: { label: 'In progress', glyph: '◐', token: 'IN_PROGRESS' },
  ON_HOLD: { label: 'On hold', glyph: '❚❚', token: 'ON_HOLD' },
  COMPLETED: { label: 'Completed', glyph: '✓', token: 'COMPLETED' },
  CANCELLED: { label: 'Cancelled', glyph: '✕', token: 'CANCELLED' },
};

export const PRIORITY_STYLES: Record<
  Priority,
  { label: string; glyph: string; token: string }
> = {
  LOW: { label: 'Low', glyph: '', token: 'LOW' },
  NORMAL: { label: 'Normal', glyph: '', token: 'NORMAL' },
  HIGH: { label: 'HIGH', glyph: '', token: 'HIGH' },
  URGENT: { label: 'URGENT', glyph: '▲', token: 'URGENT' },
};
