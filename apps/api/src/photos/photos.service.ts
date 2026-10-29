import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';
import { ThumbnailQueue } from './thumbnail-queue';
import type { AuthUser } from '../auth/auth-user';

function notFound(): HttpException {
  return new HttpException({ error: { code: 'NOT_FOUND', message: 'Not found' } }, HttpStatus.NOT_FOUND);
}

function invalidState(message: string): HttpException {
  return new HttpException({ error: { code: 'INVALID_STATE', message } }, HttpStatus.UNPROCESSABLE_ENTITY);
}

/**
 * Phase 2 photos: signed upload URL flow, confirm, list,
 * soft delete. Photos are additive and never conflict
 * (per the sync spec). Thumbnail generation (BullMQ) is
 * NOT in this slice — it needs a running Redis + a bucket,
 * both still outstanding — so thumbnailKey stays null
 * until that slice lands, and the UI shows the original.
 */
@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService = new StorageService(),
    private readonly thumbnails: ThumbnailQueue = new ThumbnailQueue(),
  ) {}

  private async findScoped(companyId: string, jobId: string, user: AuthUser) {
    const job = await this.prisma.job.findFirst({ where: { id: jobId, companyId } });
    if (!job) throw notFound();
    if (user.dbUser!.role === 'TECHNICIAN' && job.assignedTechnicianId !== user.dbUser!.id) throw notFound();
    return job;
  }

  async uploadUrl(user: AuthUser, jobId: string, filename: string, contentType: string) {
    const job = await this.findScoped(user.dbUser!.companyId, jobId, user);
    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      throw invalidState(`Cannot upload photos to a ${job.status} job`);
    }
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
    const key = `jobs/${job.id}/${randomUUID()}-${safeName}`;
    const url = await this.storage.uploadUrl(key, contentType);
    return { uploadUrl: url, storageKey: key };
  }

  async confirm(user: AuthUser, jobId: string, dto: any) {
    const job = await this.findScoped(user.dbUser!.companyId, jobId, user);
    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      throw invalidState(`Cannot add photos to a ${job.status} job`);
    }
    const photo = await this.prisma.photo.create({
      data: {
        jobId: job.id,
        uploadedById: user.dbUser!.id,
        storageKey: dto.storageKey,
        originalFilename: dto.originalFilename,
        caption: dto.caption ?? null,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        fileSizeBytes: dto.fileSizeBytes ?? null,
        status: 'READY',
      },
    });
    await this.prisma.jobActivity.create({
      data: { jobId: job.id, actorId: user.dbUser!.id, action: 'PHOTO_ADDED', toValue: { photoId: photo.id } },
    });
    // Best-effort: a missing Redis must not fail the confirm.
    await this.thumbnails.enqueue(photo.id);
    return photo;
  }

  async list(user: AuthUser, jobId: string) {
    await this.findScoped(user.dbUser!.companyId, jobId, user);
    const photos = await this.prisma.photo.findMany({
      where: { jobId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    const withUrls = [];
    for (const photo of photos) {
      let downloadUrl: string | null = null;
      let thumbnailUrl: string | null = null;
      if (this.storage.configured) {
        try {
          downloadUrl = await this.storage.downloadUrl(photo.storageKey);
          if (photo.thumbnailKey) thumbnailUrl = await this.storage.downloadUrl(photo.thumbnailKey);
        } catch {
          downloadUrl = null;
          thumbnailUrl = null;
        }
      }
      withUrls.push({ ...photo, downloadUrl, thumbnailUrl });
    }
    return { data: withUrls };
  }

  async remove(user: AuthUser, jobId: string, photoId: string) {
    const job = await this.findScoped(user.dbUser!.companyId, jobId, user);
    const photo = await this.prisma.photo.findFirst({ where: { id: photoId, jobId: job.id, deletedAt: null } });
    if (!photo) throw notFound();
    const deleted = await this.prisma.photo.update({ where: { id: photo.id }, data: { deletedAt: new Date() } });
    await this.prisma.jobActivity.create({
      data: { jobId: job.id, actorId: user.dbUser!.id, action: 'PHOTO_DELETED', toValue: { photoId: photo.id } },
    });
    return deleted;
  }
}
