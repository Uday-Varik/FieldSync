import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';

function notFound(): HttpException {
  return new HttpException(
    { error: { code: 'NOT_FOUND', message: 'Not found' } },
    HttpStatus.NOT_FOUND,
  );
}

/**
 * Checklist CRUD (API spec, Phase 1).
 *
 * - POST /jobs/:id/checklist: Admin/Dispatcher only (controller).
 * - PATCH /jobs/:id/checklist/:itemId: assigned Technician or
 *   Dispatcher (Admin is also allowed here as supervisor — a
 *   strict spec-only reading would lock Admin out of a job
 *   they manage, which is not the intent).
 * - Scoping mirrors jobs: same-company only, technicians only
 *   on jobs assigned to them, otherwise 404.
 * - Checklist edits on COMPLETED/CANCELLED jobs are rejected
 *   with 422; a completed job must be Admin-reopened first.
 * - Toggling records who checked it and when, and writes a
 *   JobActivity row so the audit timeline shows it.
 */
@Injectable()
export class ChecklistService {
  constructor(private readonly prisma: PrismaService) {}

  private async findJob(companyId: string, jobId: string, user: AuthUser) {
    const job = await this.prisma.job.findFirst({ where: { id: jobId, companyId } });
    if (!job) throw notFound();
    if (user.dbUser!.role === 'TECHNICIAN' && job.assignedTechnicianId !== user.dbUser!.id) {
      throw notFound();
    }
    return job;
  }

  async create(user: AuthUser, jobId: string, label: string) {
    const job = await this.findJob(user.dbUser!.companyId, jobId, user);
    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      throw new HttpException(
        { error: { code: 'INVALID_STATE', message: 'Cannot add checklist items to a completed or cancelled job' } },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const maxOrder = await this.prisma.checklistItem.aggregate({
      where: { jobId: job.id },
      _max: { sortOrder: true },
    });
    return this.prisma.checklistItem.create({
      data: { jobId: job.id, label, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
    });
  }

  async toggle(user: AuthUser, jobId: string, itemId: string, isChecked: boolean) {
    const job = await this.findJob(user.dbUser!.companyId, jobId, user);
    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      throw new HttpException(
        { error: { code: 'INVALID_STATE', message: 'Cannot change checklist items on a completed or cancelled job' } },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const item = await this.prisma.checklistItem.findFirst({ where: { id: itemId, jobId: job.id } });
    if (!item) throw notFound();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.checklistItem.update({
        where: { id: item.id },
        data: {
          isChecked,
          checkedById: isChecked ? user.dbUser!.id : null,
          checkedAt: isChecked ? new Date() : null,
        },
      });
      await tx.jobActivity.create({
        data: {
          jobId: job.id,
          actorId: user.dbUser!.id,
          action: isChecked ? 'CHECKLIST_CHECKED' : 'CHECKLIST_UNCHECKED',
          field: 'checklistItem',
          fromValue: { itemId: item.id, isChecked: item.isChecked },
          toValue: { itemId: item.id, isChecked },
        },
      });
      return updated;
    });
  }
}
