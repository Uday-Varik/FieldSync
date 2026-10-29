import 'reflect-metadata';
import { Worker } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';
import { ThumbnailService } from './thumbnail.service';

/**
 * Standalone thumbnail worker. Run from apps/api with:
 *   npm run worker:thumbnails
 * It needs REDIS_URL (or REDIS_HOST/PORT) and S3 storage
 * configured; without them it exits with a clear message
 * instead of crashing in a restart loop.
 */
async function main() {
  const connection = process.env.REDIS_URL
    ? { url: process.env.REDIS_URL }
    : process.env.REDIS_HOST
      ? { host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT ?? 6379) }
      : null;
  if (!connection) {
    console.error('Thumbnail worker: REDIS_URL or REDIS_HOST is not set. Exiting.');
    process.exit(1);
  }
  const prisma = new PrismaService();
  const service = new ThumbnailService(prisma, new StorageService());
  const worker = new Worker(
    'thumbnails',
    async (job) => {
      await service.process(job.data.photoId);
    },
    { connection },
  );
  worker.on('failed', (job, err) => {
    console.error(`Thumbnail job ${job?.id} failed:`, err.message);
  });
  console.log('Thumbnail worker running (queue: thumbnails).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
