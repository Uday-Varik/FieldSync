import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

/**
 * BullMQ thumbnail queue. Connection comes from REDIS_URL
 * or REDIS_HOST/REDIS_PORT; with neither set, there is no
 * queue and enqueue() returns false instead of throwing.
 * enqueue() is best-effort by design: a Redis outage must
 * not fail a photo confirm (the photo is already READY,
 * and the grid falls back to the original).
 * The worker is src/photos/thumbnail-worker.ts, run with
 * `npm run worker:thumbnails` in the API workspace.
 */
@Injectable()
export class ThumbnailQueue {
  private queue: Queue | null = null;
  private readonly connection: any;

  constructor() {
    if (process.env.REDIS_URL) {
      this.connection = { url: process.env.REDIS_URL };
    } else if (process.env.REDIS_HOST) {
      this.connection = { host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT ?? 6379) };
    } else {
      this.connection = null;
    }
  }

  get configured(): boolean {
    return this.connection !== null;
  }

  async enqueue(photoId: string): Promise<boolean> {
    if (!this.connection) return false;
    try {
      if (!this.queue) {
        this.queue = new Queue('thumbnails', { connection: this.connection });
        this.queue.on('error', () => {});
      }
      await this.queue.add('thumbnail', { photoId }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
      return true;
    } catch {
      return false;
    }
  }
}
