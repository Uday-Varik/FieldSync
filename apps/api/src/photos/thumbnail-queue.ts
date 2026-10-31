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

  private ensureQueue(): Queue | null {
    if (!this.connection) return null;
    if (!this.queue) {
      this.queue = new Queue('thumbnails', { connection: this.connection });
      this.queue.on('error', () => {});
    }
    return this.queue;
  }

  async enqueue(photoId: string): Promise<boolean> {
    const queue = this.ensureQueue();
    if (!queue) return false;
    try {
      await queue.add('thumbnail', { photoId }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Phase 5: Redis reachability for GET /health/db. Returns false when
   * Redis is unconfigured or does not answer; never throws, so a Redis
   * outage degrades readiness instead of failing the health check.
   */
  async ping(): Promise<boolean> {
    const queue = this.ensureQueue();
    if (!queue) return false;
    try {
      const client = (queue as any).client;
      const pong = await (typeof client?.ping === 'function' ? client.ping() : (await client).ping());
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}
