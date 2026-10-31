import { HealthService } from './health.service';

function makeService(db: () => Promise<unknown>, redis: { configured: boolean; ping: () => Promise<boolean> }) {
  const prisma: any = { $queryRaw: db };
  const queue: any = { configured: redis.configured, ping: redis.ping };
  return new HealthService(prisma, queue);
}

describe('HealthService', () => {
  it('liveness always reports ok', () => {
    const svc = makeService(async () => [{ '?column?': 1 }], { configured: false, ping: async () => false });
    expect(svc.liveness()).toEqual({ status: 'ok' });
  });

  it('readiness is ok when db is up and redis is unconfigured', async () => {
    const svc = makeService(async () => [{ '?column?': 1 }], { configured: false, ping: async () => false });
    await expect(svc.readiness()).resolves.toEqual({ status: 'ok', db: 'up', redis: 'unconfigured' });
  });

  it('readiness is ok when db and redis are both up', async () => {
    const svc = makeService(async () => [{ '?column?': 1 }], { configured: true, ping: async () => true });
    await expect(svc.readiness()).resolves.toEqual({ status: 'ok', db: 'up', redis: 'up' });
  });

  it('readiness is degraded when db is down, even if redis answers', async () => {
    const svc = makeService(async () => {
      throw new Error('connection refused');
    }, { configured: true, ping: async () => true });
    await expect(svc.readiness()).resolves.toEqual({ status: 'degraded', db: 'down', redis: 'up' });
  });

  it('readiness is degraded when configured redis does not answer', async () => {
    const svc = makeService(async () => [{ '?column?': 1 }], { configured: true, ping: async () => false });
    await expect(svc.readiness()).resolves.toEqual({ status: 'degraded', db: 'up', redis: 'down' });
  });

  it('readiness is degraded when redis ping throws', async () => {
    const svc = makeService(async () => [{ '?column?': 1 }], {
      configured: true,
      ping: async () => {
        throw new Error('timeout');
      },
    });
    await expect(svc.readiness()).resolves.toEqual({ status: 'degraded', db: 'up', redis: 'down' });
  });
});
