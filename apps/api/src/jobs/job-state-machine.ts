import type { JobStatus } from '@prisma/client';

/**
 * Server-enforced job state machine (docs/03, shared package
 * VALID_NEXT_STATUSES). COMPLETED and CANCELLED are terminal
 * for status transitions: Admin reopen is a separate endpoint,
 * not a transition, and cancel is a separate endpoint that
 * requires a reason.
 */
export const VALID_NEXT_STATUSES: Record<JobStatus, JobStatus[]> = {
  SCHEDULED: ['EN_ROUTE', 'ON_HOLD', 'CANCELLED'],
  EN_ROUTE: ['ON_SITE', 'ON_HOLD', 'CANCELLED'],
  ON_SITE: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'ON_HOLD', 'CANCELLED'],
  ON_HOLD: ['SCHEDULED', 'EN_ROUTE', 'ON_SITE', 'IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return VALID_NEXT_STATUSES[from].includes(to);
}
