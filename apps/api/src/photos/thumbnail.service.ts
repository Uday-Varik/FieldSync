import { Injectable } from '@nestjs/common';
import { Jimp } from 'jimp';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';

/**
 * Phase 2 thumbnail job (BullMQ job body lives in
 * thumbnail-queue.ts; this service is the work itself).
 *
 * A thumbnail is a 300px-wide JPEG of the original.
 * Jimp (pure JS) is used instead of sharp so the job has
 * no native-binary download — the Prisma-engine download
 * trouble in Phase 0 showed native binaries are fragile
 * in this environment.
 *
 * process() returns null (not an error) when the photo
 * is gone or storage is not configured: a missing
 * thumbnail must never fail the photo upload, which
 * already succeeded, and the grid falls back to the
 * original image.
 */
@Injectable()
export class ThumbnailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService = new StorageService(),
  ) {}

  async generateThumbnailBuffer(input: Buffer): Promise<Buffer> {
    const image = await Jimp.read(input);
    image.resize({ w: 300 });
    return image.getBuffer('image/jpeg');
  }

  async process(photoId: string): Promise<string | null> {
    const photo = await this.prisma.photo.findFirst({ where: { id: photoId, deletedAt: null } });
    if (!photo) return null;
    if (!this.storage.configured) return null;
    try {
      const original = await this.storage.downloadBuffer(photo.storageKey);
      const thumb = await this.generateThumbnailBuffer(original);
      const thumbnailKey = `thumbnails/${photo.id}.jpg`;
      await this.storage.uploadBuffer(thumbnailKey, thumb, 'image/jpeg');
      await this.prisma.photo.update({ where: { id: photo.id }, data: { thumbnailKey } });
      return thumbnailKey;
    } catch {
      return null;
    }
  }
}
