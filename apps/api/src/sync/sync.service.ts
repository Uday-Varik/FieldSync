import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { RealtimeService } from '../realtime/realtime.service';
import { canTransition } from '../jobs/job-state-machine';
import { SyncMutationDto, SyncMutationType } from './dto/sync.dto';

/**
 * Phase 4 server sync intake (docs/07).
 *
 * POST /sync takes up to 50 mutations in client order.
 * Each mutation is applied in its own transaction, in
 * order; one rejected mutation never rolls back earlier
 * good ones, and partial success is surfaced per mutation
 * in the response.
 *
 * Order per mutation: idempotency → authorise → validate
 * → field-level conflict rules → apply + audit + store.
 * Idempotency comes first deliberately (a deviation from
 * the §3 list order, logged in DECISIONS.md): a replayed
 * batch must return the stored result even if the job has
 * since been cancelled, or replay would turn an applied
 * change into a rejection and duplicate audit entries.
 *
 * Conflict rules are field-level, never whole-record
 * last-write-wins: a status change applies if it is still
 * valid from the current server status; notes are
 * last-write-wins with the old text preserved in the
 * audit fromValue; checklist toggles merge by item id;
 * a signature on an already-COMPLETED job is rejected;
 * server CANCELLED always wins over an offline status
 * change.
 */
@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService = new RealtimeService(),
  ) {}

  async sync(user: AuthUser, mutations: SyncMutationDto[]): Promise<{ results: any[] }> {
    const results: any[] = [];
    for (const mutation of mutations) {
      results.push(await this.applyOne(user, mutation));
    }
    return { results };
  }

  private async applyOne(user: AuthUser, mutation: SyncMutationDto) {
    const userId = user.dbUser!.id;
    const companyId = user.dbUser!.companyId;

    // 1. Idempotency: replay returns the stored result, no re-apply.
    const existing = await this.prisma.syncMutation.findFirst({
      where: { userId, clientMutationId: mutation.clientMutationId },
    });
    if (existing) {
      return {
        clientMutationId: mutation.clientMutationId,
        jobId: mutation.jobId,
        status: existing.result,
        serverVersion: existing.serverVersionAfter,
        conflictDetails: existing.conflictDetails ?? undefined,
        duplicate: true,
      };
    }

    const job = await this.prisma.job.findFirst({ where: { id: mutation.jobId, companyId } });
    if (!job) {
      // No SyncMutation row: the job does not exist in this
      // company, so the FK to Job would fail. Rejection is
      // returned without storing.
      return {
        clientMutationId: mutation.clientMutationId,
        jobId: mutation.jobId,
        status: 'REJECTED' as const,
        reason: 'NOT_FOUND',
        serverVersion: null,
      };
    }

    // 2. Authorise: technicians only on assigned jobs.
    if (user.dbUser!.role === 'TECHNICIAN' && job.assignedTechnicianId !== userId) {
      return this.storeRejected(user, mutation, job, 'FORBIDDEN', job.version, null);
    }

    // 3+4. Validate + conflict rules, per type.
    const outcome = await this.validateAndPlan(user, job, mutation);
    if (outcome.rejected) {
      return this.storeRejected(user, mutation, job, outcome.rejected, job.version, outcome.jobSnapshot ?? null);
    }

    // Apply in its own transaction.
    const applied = await this.prisma.$transaction(async (tx) => {
      const updated = await outcome.apply(tx, job, userId);
      await tx.jobActivity.create({
        data: {
          jobId: job.id,
          actorId: userId,
          action: outcome.action,
          field: outcome.field ?? null,
          fromValue: outcome.fromValue ?? undefined,
          toValue: outcome.toValue ?? undefined,
          metadata: { offline: true, clientMutationId: mutation.clientMutationId, ...(outcome.conflictDetails ? { conflictDetails: outcome.conflictDetails } : {}) },
        },
      });
      const record = await tx.syncMutation.create({
        data: {
          companyId,
          userId,
          clientMutationId: mutation.clientMutationId,
          jobId: job.id,
          mutationType: mutation.type,
          payload: mutation.payload as any,
          result: outcome.conflict ? 'CONFLICT_RESOLVED' : 'APPLIED',
          serverVersionAfter: updated.version,
          conflictDetails: outcome.conflictDetails ?? undefined,
        },
      });
      return { updated, record };
    });

    this.realtime.emitJobUpdated(companyId, job.id, applied.updated.status, applied.updated.version);

    return {
      clientMutationId: mutation.clientMutationId,
      jobId: job.id,
      status: applied.record.result,
      serverVersion: applied.record.serverVersionAfter,
      ...(applied.record.conflictDetails ? { conflictDetails: applied.record.conflictDetails } : {}),
      ...(applied.record.result === 'CONFLICT_RESOLVED' ? { jobSnapshot: await this.snapshot(job.id) } : {}),
    };
  }

  private async storeRejected(user: AuthUser, mutation: SyncMutationDto, job: any, reason: string, serverVersion: number, jobSnapshot: any) {
    const record = await this.prisma.syncMutation.create({
      data: {
        companyId: user.dbUser!.companyId,
        userId: user.dbUser!.id,
        clientMutationId: mutation.clientMutationId,
        jobId: job.id,
        mutationType: mutation.type,
        payload: mutation.payload as any,
        result: 'REJECTED',
        serverVersionAfter: serverVersion,
        conflictDetails: { reason },
      },
    });
    return {
      clientMutationId: mutation.clientMutationId,
      jobId: job.id,
      status: 'REJECTED' as const,
      reason,
      serverVersion: record.serverVersionAfter,
      conflictDetails: { reason },
      jobSnapshot: jobSnapshot ?? (await this.snapshot(job.id)),
    };
  }

  private async snapshot(jobId: string) {
    return this.prisma.job.findFirst({
      where: { id: jobId },
      include: { checklist: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  private isConflict(job: any, mutation: SyncMutationDto) {
    return job.version !== mutation.clientVersion;
  }

  private async validateAndPlan(user: AuthUser, job: any, mutation: SyncMutationDto): Promise<any> {
    const conflict = this.isConflict(job, mutation);
    const payload = mutation.payload ?? {};
    const role = user.dbUser!.role;

    switch (mutation.type) {
      case SyncMutationType.UPDATE_STATUS: {
        const to = payload.to;
        if (typeof to !== 'string') return { rejected: 'INVALID_PAYLOAD' };
        if (job.status === 'CANCELLED') {
          return { rejected: 'JOB_CANCELLED', jobSnapshot: await this.snapshot(job.id) };
        }
        if (job.status === 'COMPLETED') {
          return { rejected: 'ALREADY_COMPLETED', jobSnapshot: await this.snapshot(job.id) };
        }
        if (!canTransition(job.status, to as any)) {
          return { rejected: 'INVALID_TRANSITION', jobSnapshot: await this.snapshot(job.id) };
        }
        if (to === 'COMPLETED') {
          const signature = await this.prisma.signature.findFirst({ where: { jobId: job.id, isCurrent: true } });
          if (!signature) {
            const canOverride = (role === 'ADMIN' || role === 'DISPATCHER') && typeof payload.reason === 'string' && payload.reason.length > 0;
            if (!canOverride) return { rejected: 'SIGNATURE_REQUIRED', jobSnapshot: await this.snapshot(job.id) };
          }
        }
        const data: any = { status: to, version: { increment: 1 }, lastEditedById: user.dbUser!.id, lastEditedAt: new Date() };
        if (to === 'ON_HOLD') data.previousStatus = job.status;
        if (job.status === 'ON_HOLD') data.previousStatus = null;
        if (to === 'IN_PROGRESS' && !job.startedAt) data.startedAt = new Date();
        if (to === 'COMPLETED') data.completedAt = new Date();
        return {
          conflict,
          conflictDetails: conflict ? { rule: 'STATUS_VALID_FROM_CURRENT_SERVER_STATUS', serverStatus: job.status, clientVersion: mutation.clientVersion } : undefined,
          action: 'STATUS_CHANGED',
          fromValue: { status: job.status },
          toValue: { status: to, ...(payload.reason ? { reason: payload.reason } : {}) },
          apply: async (tx: any) => tx.job.update({ where: { id: job.id }, data }),
        };
      }

      case SyncMutationType.UPDATE_JOB_FIELDS: {
        const allowedForTechnician = ['internalNotes', 'customerNotes', 'title', 'description'];
        const allowedForStaff = [...allowedForTechnician, 'scheduledDate', 'scheduledWindowStart', 'scheduledWindowEnd', 'priority', 'assignedTechnicianId'];
        const allowed = role === 'TECHNICIAN' ? allowedForTechnician : allowedForStaff;
        const fields = Object.keys(payload).filter((k) => k !== 'reason');
        if (fields.length === 0) return { rejected: 'INVALID_PAYLOAD' };
        if (fields.some((f) => !allowed.includes(f))) return { rejected: 'FORBIDDEN' };
        if (job.status === 'COMPLETED' || job.status === 'CANCELLED') return { rejected: 'INVALID_STATE' };
        const data: any = { version: { increment: 1 }, lastEditedById: user.dbUser!.id, lastEditedAt: new Date() };
        for (const f of fields) data[f] = f === 'scheduledDate' ? new Date(payload[f]) : payload[f];
        if (payload.assignedTechnicianId) {
          const tech = await this.prisma.user.findFirst({ where: { id: payload.assignedTechnicianId, companyId: job.companyId, role: 'TECHNICIAN', isActive: true } });
          if (!tech) return { rejected: 'INVALID_PAYLOAD' };
        }
        return {
          conflict,
          conflictDetails: conflict ? { rule: 'FIELD_LEVEL_MERGE', fieldsApplied: fields, otherFieldsPreserved: true } : undefined,
          action: 'UPDATED',
          fromValue: Object.fromEntries(fields.map((f) => [f, job[f] ?? null])),
          toValue: Object.fromEntries(fields.map((f) => [f, payload[f]])),
          apply: async (tx: any) => tx.job.update({ where: { id: job.id }, data }),
        };
      }

      case SyncMutationType.TOGGLE_CHECKLIST: {
        if (job.status === 'COMPLETED' || job.status === 'CANCELLED') return { rejected: 'INVALID_STATE' };
        const item = await this.prisma.checklistItem.findFirst({ where: { id: payload.itemId, jobId: job.id } });
        if (!item) return { rejected: 'NOT_FOUND' };
        if (typeof payload.isChecked !== 'boolean') return { rejected: 'INVALID_PAYLOAD' };
        return {
          conflict,
          conflictDetails: conflict ? { rule: 'CHECKLIST_MERGE_BY_ITEM', itemId: item.id } : undefined,
          action: payload.isChecked ? 'CHECKLIST_CHECKED' : 'CHECKLIST_UNCHECKED',
          field: 'checklistItem',
          fromValue: { itemId: item.id, isChecked: item.isChecked },
          toValue: { itemId: item.id, isChecked: payload.isChecked },
          apply: async (tx: any) => {
            await tx.checklistItem.update({
              where: { id: item.id },
              data: { isChecked: payload.isChecked, checkedById: payload.isChecked ? user.dbUser!.id : null, checkedAt: payload.isChecked ? new Date() : null },
            });
            return tx.job.update({ where: { id: job.id }, data: { version: { increment: 1 } } });
          },
        };
      }

      case SyncMutationType.ADD_CHECKLIST_ITEM: {
        if (job.status === 'COMPLETED' || job.status === 'CANCELLED') return { rejected: 'INVALID_STATE' };
        if (typeof payload.label !== 'string' || payload.label.trim().length === 0) return { rejected: 'INVALID_PAYLOAD' };
        return {
          conflict,
          action: 'CHECKLIST_ITEM_ADDED',
          toValue: { label: payload.label },
          apply: async (tx: any) => {
            const maxOrder = await tx.checklistItem.aggregate({ where: { jobId: job.id }, _max: { sortOrder: true } });
            await tx.checklistItem.create({ data: { jobId: job.id, label: payload.label, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 } });
            return tx.job.update({ where: { id: job.id }, data: { version: { increment: 1 } } });
          },
        };
      }

      case SyncMutationType.ADD_NOTE: {
        const field = payload.field;
        if (field !== 'internalNotes' && field !== 'customerNotes') return { rejected: 'INVALID_PAYLOAD' };
        if (typeof payload.text !== 'string') return { rejected: 'INVALID_PAYLOAD' };
        if (job.status === 'CANCELLED') return { rejected: 'JOB_CANCELLED' };
        return {
          conflict,
          conflictDetails: conflict ? { rule: 'NOTE_LAST_WRITE_WINS_PREVIOUS_PRESERVED_IN_AUDIT', field } : undefined,
          action: 'NOTE_UPDATED',
          field,
          // Old text is preserved in the audit fromValue; a
          // timeline note is added by the client from
          // conflictDetails when the sync was a conflict.
          fromValue: { [field]: job[field] ?? null },
          toValue: { [field]: payload.text },
          apply: async (tx: any) =>
            tx.job.update({ where: { id: job.id }, data: { [field]: payload.text, version: { increment: 1 }, lastEditedById: user.dbUser!.id, lastEditedAt: new Date() } }),
        };
      }

      case SyncMutationType.ADD_SIGNATURE: {
        if (job.status === 'COMPLETED') return { rejected: 'ALREADY_COMPLETED', jobSnapshot: await this.snapshot(job.id) };
        if (job.status === 'CANCELLED') return { rejected: 'JOB_CANCELLED', jobSnapshot: await this.snapshot(job.id) };
        if (typeof payload.signedByName !== 'string' || payload.signedByName.trim().length === 0) return { rejected: 'INVALID_PAYLOAD' };
        if (typeof payload.imageDataUrl !== 'string' || !/^data:image\/(png|jpeg);base64,/.test(payload.imageDataUrl)) return { rejected: 'INVALID_PAYLOAD' };
        if (payload.imageDataUrl.length > 700000) return { rejected: 'INVALID_PAYLOAD' };
        return {
          conflict,
          action: 'SIGNATURE_CAPTURED',
          toValue: { signedByName: payload.signedByName },
          apply: async (tx: any) => {
            await tx.signature.updateMany({ where: { jobId: job.id, isCurrent: true }, data: { isCurrent: false, supersededAt: new Date() } });
            await tx.signature.create({
              data: { jobId: job.id, storageKey: payload.imageDataUrl, signedByName: payload.signedByName, signedAt: new Date(), capturedById: user.dbUser!.id, isCurrent: true },
            });
            return tx.job.update({ where: { id: job.id }, data: { version: { increment: 1 } } });
          },
        };
      }

      case SyncMutationType.ADD_PHOTO_META: {
        // Photos are additive and never conflict (docs/07
        // §4). The metadata row is PENDING until the client
        // uploads the binary to the same storageKey and
        // confirms it (PhotosService handles the reuse).
        if (job.status === 'COMPLETED' || job.status === 'CANCELLED') return { rejected: 'INVALID_STATE' };
        const key = payload.storageKey;
        if (typeof key !== 'string' || !key.startsWith(`jobs/${job.id}/`)) return { rejected: 'INVALID_PAYLOAD' };
        if (typeof payload.originalFilename !== 'string' || payload.originalFilename.length === 0) return { rejected: 'INVALID_PAYLOAD' };
        return {
          conflict,
          action: 'PHOTO_ADDED',
          toValue: { storageKey: key, originalFilename: payload.originalFilename, offline: true },
          apply: async (tx: any) => {
            const existing = await tx.photo.findFirst({ where: { jobId: job.id, storageKey: key, deletedAt: null } });
            if (!existing) {
              await tx.photo.create({
                data: {
                  jobId: job.id,
                  uploadedById: user.dbUser!.id,
                  storageKey: key,
                  originalFilename: payload.originalFilename,
                  caption: payload.caption ?? null,
                  fileSizeBytes: payload.fileSizeBytes ?? null,
                  status: 'PENDING',
                },
              });
            }
            return tx.job.update({ where: { id: job.id }, data: { version: { increment: 1 } } });
          },
        };
      }

      default:
        return { rejected: 'UNKNOWN_TYPE' };
    }
  }
}
