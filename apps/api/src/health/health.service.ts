import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ThumbnailQueue } from '../photos/thumbnail-queue';

export type HealthStatus = 'ok' | 'degraded';
export type ComponentStatus = 'up' | 'down' | 'unconfigured';

export type Readiness = {
  status: HealthStatus;
  db: ComponentStatus;
  redis: ComponentStatus;
};

const CHECK_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) =>
      setTimeout(() => reject(new Error('health check timeout')), ms),
    ),
  ]);
}

/**
 * Phase 5: liveness + readiness for deploy health checks (docs/09 §5).
 * GET /health is public and only says the process is up. GET /health/db
 * reports component status with no connection details and is guarded,
 * so it is not a public probe of the infrastructure. Redis is
 * best-effort by design (thumbnail queue): unconfigured is not degraded,
 * but a configured Redis that does not answer is.
 */
@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly thumbnails: ThumbnailQueue,
  ) {}

  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  async readiness(): Promise<Readiness> {
    let db: ComponentStatus = 'down';
    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`, CHECK_TIMEOUT_MS);
      db = 'up';
    } catch {
      db = 'down';
    }

    let redis: ComponentStatus;
    if (!this.thumbnails.configured) {
      redis = 'unconfigured';
    } else {
      try {
        redis = (await withTimeout(this.thumbnails.ping(), CHECK_TIMEOUT_MS))
          ? 'up'
          : 'down';
      } catch {
        redis = 'down';
      }
    }

    return {
      status: db === 'up' && redis !== 'down' ? 'ok' : 'degraded',
      db,
      redis,
    };
  }
}
