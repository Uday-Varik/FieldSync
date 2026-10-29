import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { canTransition } from './job-state-machine';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import type { AuthUser } from '../auth/auth-user';

function notFound(): HttpException {
  return new HttpException(
    { error: { code: 'NOT_FOUND', message: 'Not found' } },
    HttpStatus.NOT_FOUND,
  );
}

function invalidState(message: string): HttpException {
  return new HttpException(
    { error: { code: 'INVALID_STATE', message } },
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
}

export interface JobListQuery {
  status?: JobStatus;
  assignedTechnicianId?: string;
  priority?: string;
  search?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

/**
 * Jobs CRUD + server state machine (API spec).
 *
 * Scoping rules, enforced here (not only in the controller):
 * - Every query is filtered to the caller's company.
 * - Technicians see only jobs assigned to them; asking for
 *   another job, or listing, returns only their own (other
 *   jobs are 404, never 403, so existence does not leak).
 * - Status changes go through VALID_NEXT_STATUSES only.
 *   CANCELLED must go through POST /:id/cancel (reason
 *   required), not through the status endpoint.
 * - Every status/assign/cancel/reopen change writes a
 *   JobActivity row and bumps Job.version.
 */
@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  private async findScoped(companyId: string, jobId: string, user: AuthUser) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, companyId },
      include: {
        checklist: { orderBy: { sortOrder: 'asc' } },
        // Current signature only, for the job detail page.
        // storageKey holds a data URL in Phase 2 (see signature.dto.ts).
        signatures: {
          where: { isCurrent: true },
          select: { id: true, signedByName: true, signedAt: true, storageKey: true },
        },
      },
    });
    if (!job) throw notFound();
    if (user.dbUser!.role === 'TECHNICIAN' && job.assignedTechnicianId !== user.dbUser!.id) {
      throw notFound();
    }
    return job;
  }

  private async assertTechnician(companyId: string, technicianId: string) {
    const tech = await this.prisma.user.findFirst({
      where: { id: technicianId, companyId, role: 'TECHNICIAN', isActive: true },
    });
    if (!tech) throw notFound();
    return tech;
  }

  private async activity(tx: any, jobId: string, actorId: string, action: string, fromValue: any, toValue: any, metadata?: any) {
    await tx.jobActivity.create({
      data: { jobId, actorId, action, fromValue: fromValue ?? undefined, toValue: toValue ?? undefined, metadata: metadata ?? undefined },
    });
  }

  async list(user: AuthUser, q: JobListQuery) {
    const companyId = user.dbUser!.companyId;
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(100, Math.max(1, q.limit ?? 20));
    const where: Prisma.JobWhereInput = { companyId };
    if (q.status) where.status = q.status;
    if (q.priority) where.priority = q.priority as any;
    if (user.dbUser!.role === 'TECHNICIAN') {
      where.assignedTechnicianId = user.dbUser!.id;
    } else if (q.assignedTechnicianId) {
      where.assignedTechnicianId = q.assignedTechnicianId;
    }
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { customerName: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    if (q.date) {
      where.scheduledDate = new Date(q.date);
    } else if (q.dateFrom || q.dateTo) {
      where.scheduledDate = {
        ...(q.dateFrom ? { gte: new Date(q.dateFrom) } : {}),
        ...(q.dateTo ? { lte: new Date(q.dateTo) } : {}),
      };
    }
    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.job.count({ where }),
    ]);
    return { data: jobs, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async get(user: AuthUser, jobId: string) {
    return this.findScoped(user.dbUser!.companyId, jobId, user);
  }

  async create(user: AuthUser, dto: CreateJobDto) {
    const companyId = user.dbUser!.companyId;
    if (dto.assignedTechnicianId) {
      await this.assertTechnician(companyId, dto.assignedTechnicianId);
    }
    const { checklistLabels, ...rest } = dto;
    const job = await this.prisma.job.create({
      data: {
        ...rest,
        scheduledDate: new Date(dto.scheduledDate),
        companyId,
        status: 'SCHEDULED',
        ...(checklistLabels
          ? { checklist: { create: checklistLabels.map((label, i) => ({ label, sortOrder: i })) } }
          : {}),
      },
      include: { checklist: { orderBy: { sortOrder: 'asc' } } },
    });
    await this.prisma.jobActivity.create({
      data: { jobId: job.id, actorId: user.dbUser!.id, action: 'CREATED', toValue: { status: 'SCHEDULED' } },
    });
    return job;
  }

  async update(user: AuthUser, jobId: string, dto: UpdateJobDto) {
    const job = await this.findScoped(user.dbUser!.companyId, jobId, user);
    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      throw invalidState('Completed or cancelled jobs cannot be edited; use reopen for completed jobs');
    }
    const { scheduledDate, ...rest } = dto;
    return this.prisma.job.update({
      where: { id: job.id },
      data: {
        ...rest,
        ...(scheduledDate ? { scheduledDate: new Date(scheduledDate) } : {}),
        version: { increment: 1 },
        lastEditedById: user.dbUser!.id,
        lastEditedAt: new Date(),
      },
    });
  }

  async changeStatus(user: AuthUser, jobId: string, to: JobStatus, reason?: string) {
    if (to === 'CANCELLED') {
      throw invalidState('Use POST /jobs/:id/cancel to cancel a job (reason required)');
    }
    const job = await this.findScoped(user.dbUser!.companyId, jobId, user);
    if (!canTransition(job.status, to)) {
      throw invalidState(`Cannot move job from ${job.status} to ${to}`);
    }
    // Phase 2 completion flow: a signature is required to
    // complete. A dispatcher or admin may override with a
    // reason (reusing the status endpoint's reason field);
    // a technician may not override their own missing signature.
    let completionOverride = false;
    if (to === 'COMPLETED') {
      const signature = await this.prisma.signature.findFirst({
        where: { jobId: job.id, isCurrent: true },
      });
      if (!signature) {
        const role = user.dbUser!.role;
        if (role !== 'ADMIN' && role !== 'DISPATCHER') {
          throw invalidState('Completion requires a signature; capture one on the job first');
        }
        if (!reason) {
          throw invalidState('Completing without a signature requires a reason (dispatcher/admin override)');
        }
        completionOverride = true;
      }
    }
    const data: Prisma.JobUpdateInput = {
      status: to,
      version: { increment: 1 },
      lastEditedById: user.dbUser!.id,
      lastEditedAt: new Date(),
    };
    if (to === 'ON_HOLD') data.previousStatus = job.status;
    if (job.status === 'ON_HOLD') data.previousStatus = null;
    if (to === 'IN_PROGRESS' && !job.startedAt) data.startedAt = new Date();
    if (to === 'COMPLETED') data.completedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.job.update({ where: { id: job.id }, data });
      await this.activity(
        tx, job.id, user.dbUser!.id, 'STATUS_CHANGED', job.status, to,
        reason ? { reason, ...(completionOverride ? { completionOverride: true } : {}) } : undefined,
      );
      return updated;
    });
  }

  async createSignature(user: AuthUser, jobId: string, signedByName: string, imageDataUrl: string) {
    const job = await this.findScoped(user.dbUser!.companyId, jobId, user);
    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      throw invalidState(`Cannot capture a signature on a ${job.status} job`);
    }
    return this.prisma.$transaction(async (tx) => {
      // Supersede the previous current signature (same rule as
      // reopen: exactly one current signature per job).
      await tx.signature.updateMany({
        where: { jobId: job.id, isCurrent: true },
        data: { isCurrent: false, supersededAt: new Date() },
      });
      const signature = await tx.signature.create({
        data: {
          jobId: job.id,
          storageKey: imageDataUrl,
          signedByName,
          signedAt: new Date(),
          capturedById: user.dbUser!.id,
          isCurrent: true,
        },
      });
      await this.activity(tx, job.id, user.dbUser!.id, 'SIGNATURE_CAPTURED', null, { signedByName });
      return signature;
    });
  }

  async assign(user: AuthUser, jobId: string, technicianId: string | null | undefined) {
    const job = await this.findScoped(user.dbUser!.companyId, jobId, user);
    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      throw invalidState('Completed or cancelled jobs cannot be reassigned');
    }
    if (technicianId) {
      await this.assertTechnician(user.dbUser!.companyId, technicianId);
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.job.update({
        where: { id: job.id },
        data: {
          assignedTechnicianId: technicianId ?? null,
          version: { increment: 1 },
          lastEditedById: user.dbUser!.id,
          lastEditedAt: new Date(),
        },
      });
      await this.activity(tx, job.id, user.dbUser!.id, technicianId ? 'ASSIGNED' : 'UNASSIGNED', job.assignedTechnicianId, technicianId ?? null);
      return updated;
    });
  }

  async cancel(user: AuthUser, jobId: string, reason: string) {
    const job = await this.findScoped(user.dbUser!.companyId, jobId, user);
    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      throw invalidState(`Cannot cancel a ${job.status} job`);
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.job.update({
        where: { id: job.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: reason,
          version: { increment: 1 },
          lastEditedById: user.dbUser!.id,
          lastEditedAt: new Date(),
        },
      });
      await this.activity(tx, job.id, user.dbUser!.id, 'CANCELLED', job.status, 'CANCELLED', { reason });
      return updated;
    });
  }

  async reopen(user: AuthUser, jobId: string, reason: string) {
    const job = await this.findScoped(user.dbUser!.companyId, jobId, user);
    if (job.status !== 'COMPLETED') {
      throw invalidState('Only a completed job can be reopened');
    }
    return this.prisma.$transaction(async (tx) => {
      // Supersede the current signature so re-completion can
      // capture a new one (audit REOPEN-01/02). Photos are retained.
      await tx.signature.updateMany({
        where: { jobId: job.id, isCurrent: true },
        data: { isCurrent: false, supersededAt: new Date() },
      });
      const updated = await tx.job.update({
        where: { id: job.id },
        data: {
          status: 'IN_PROGRESS',
          completedAt: null,
          previousStatus: null,
          reopenReason: reason,
          version: { increment: 1 },
          lastEditedById: user.dbUser!.id,
          lastEditedAt: new Date(),
        },
      });
      await this.activity(tx, job.id, user.dbUser!.id, 'REOPENED', 'COMPLETED', 'IN_PROGRESS', { reason });
      return updated;
    });
  }

  async activityList(user: AuthUser, jobId: string, page: number, limit: number) {
    await this.findScoped(user.dbUser!.companyId, jobId, user);
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const where = { jobId };
    const [items, total] = await Promise.all([
      this.prisma.jobActivity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.jobActivity.count({ where }),
    ]);
    return { data: items, page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) };
  }
}
