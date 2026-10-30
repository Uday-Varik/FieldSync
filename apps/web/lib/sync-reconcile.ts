/**
 * Phase 4 sync reconciliation — pure functions, no Dexie,
 * no fetch, so the rules can be tested in plain Node
 * (see the verification script in the PR body).
 *
 * Rules (docs/07 §6):
 * - APPLIED: mark applied, update local job version.
 * - CONFLICT_RESOLVED: same as applied, plus keep
 *   conflictDetails for the banner, and replace the
 *   local job copy with jobSnapshot when present.
 * - REJECTED: mark failed with the reason, keep the
 *   local change visible but flagged; the client
 *   reconciles to the server snapshot on discard.
 */

export interface SyncResultItem {
  clientMutationId: string;
  jobId: string;
  status: 'APPLIED' | 'CONFLICT_RESOLVED' | 'REJECTED';
  reason?: string;
  serverVersion?: number | null;
  conflictDetails?: Record<string, any>;
  jobSnapshot?: any;
  duplicate?: boolean;
}

export function groupByJob<T extends { jobId: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const list = groups.get(item.jobId) ?? [];
    list.push(item);
    groups.set(item.jobId, list);
  }
  return groups;
}

export function buildSyncPayload(items: { clientMutationId: string; type: string; jobId: string; payload: any; clientVersion: number }[]) {
  return items.slice(0, 50).map((item) => ({
    clientMutationId: item.clientMutationId,
    type: item.type,
    jobId: item.jobId,
    clientVersion: item.clientVersion,
    payload: item.payload,
  }));
}

export function reconcile(results: SyncResultItem[], pending: { id?: number; clientMutationId: string; jobId: string }[]) {
  const byId = new Map(pending.map((p) => [p.clientMutationId, p]));
  const applied: { id?: number; clientMutationId: string }[] = [];
  const failed: { id?: number; clientMutationId: string; reason: string; jobSnapshot?: any }[] = [];
  const conflicts: { jobId: string; clientMutationId: string; conflictDetails: Record<string, any>; jobSnapshot?: any }[] = [];
  const versionUpdates = new Map<string, number>();

  for (const result of results) {
    const item = byId.get(result.clientMutationId);
    if (!item) continue;
    if (result.status === 'REJECTED') {
      failed.push({ id: item.id, clientMutationId: item.clientMutationId, reason: result.reason ?? 'REJECTED', jobSnapshot: result.jobSnapshot });
      if (typeof result.serverVersion === 'number') versionUpdates.set(item.jobId, result.serverVersion);
    } else {
      applied.push({ id: item.id, clientMutationId: item.clientMutationId });
      if (typeof result.serverVersion === 'number') versionUpdates.set(item.jobId, result.serverVersion);
      if (result.status === 'CONFLICT_RESOLVED') {
        conflicts.push({
          jobId: item.jobId,
          clientMutationId: item.clientMutationId,
          conflictDetails: result.conflictDetails ?? {},
          jobSnapshot: result.jobSnapshot,
        });
      }
    }
  }
  return { applied, failed, conflicts, versionUpdates };
}
