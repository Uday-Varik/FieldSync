import { JobsService } from './jobs.service';
import { canTransition } from './job-state-machine';

const admin = { clerkUserId: 'clerk-a', dbUser: { id: 'u-admin', companyId: 'c1', role: 'ADMIN' } } as any;
const tech = { clerkUserId: 'clerk-t', dbUser: { id: 'u-tech', companyId: 'c1', role: 'TECHNICIAN' } } as any;

function makePrisma(job: any) {
  const prisma: any = {
    job: {
      findFirst: jest.fn().mockResolvedValue(job),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn().mockImplementation(async ({ data }: any) => ({ ...job, ...data })),
    },
    jobActivity: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    user: { findFirst: jest.fn() },
    signature: { updateMany: jest.fn() },
    $transaction: async (fn: any) => fn(prisma),
  };
  return prisma;
}

describe('state machine', () => {
  it('allows SCHEDULED -> EN_ROUTE, rejects SCHEDULED -> COMPLETED and COMPLETED -> anything', () => {
    expect(canTransition('SCHEDULED', 'EN_ROUTE')).toBe(true);
    expect(canTransition('SCHEDULED', 'COMPLETED')).toBe(false);
    expect(canTransition('COMPLETED', 'IN_PROGRESS')).toBe(false);
  });
});

describe('JobsService', () => {
  it('get: technician sees only their assigned job, other jobs are 404', async () => {
    const prisma = makePrisma({ id: 'j1', companyId: 'c1', assignedTechnicianId: 'u-other', status: 'SCHEDULED' });
    const svc = new JobsService(prisma);
    await expect(svc.get(tech, 'j1')).rejects.toMatchObject({ status: 404 });
  });

  it('changeStatus: invalid transition is 422, valid transition writes activity + bumps version', async () => {
    const prisma = makePrisma({ id: 'j1', companyId: 'c1', assignedTechnicianId: 'u-admin', status: 'SCHEDULED', startedAt: null });
    const svc = new JobsService(prisma);
    await expect(svc.changeStatus(admin, 'j1', 'COMPLETED')).rejects.toMatchObject({ status: 422 });
    const out = await svc.changeStatus(admin, 'j1', 'EN_ROUTE');
    expect(prisma.jobActivity.create).toHaveBeenCalled();
    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'EN_ROUTE' }) }),
    );
    expect(out.status).toBe('EN_ROUTE');
  });

  it('changeStatus: CANCELLED via status endpoint is rejected (use cancel endpoint)', async () => {
    const prisma = makePrisma({ id: 'j1', companyId: 'c1', status: 'SCHEDULED' });
    const svc = new JobsService(prisma);
    await expect(svc.changeStatus(admin, 'j1', 'CANCELLED')).rejects.toMatchObject({ status: 422 });
  });

  it('reopen (REOPEN-01/02): only COMPLETED, returns to IN_PROGRESS, clears completedAt, supersedes signature', async () => {
    const prisma = makePrisma({ id: 'j1', companyId: 'c1', status: 'COMPLETED', completedAt: new Date() });
    const svc = new JobsService(prisma);
    const out = await svc.reopen(admin, 'j1', 'Customer asked to redo');
    expect(prisma.signature.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { jobId: 'j1', isCurrent: true } }),
    );
    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'IN_PROGRESS', completedAt: null, reopenReason: 'Customer asked to redo' }),
      }),
    );
    expect(out.status).toBe('IN_PROGRESS');

    const prisma2 = makePrisma({ id: 'j1', companyId: 'c1', status: 'IN_PROGRESS' });
    const svc2 = new JobsService(prisma2);
    await expect(svc2.reopen(admin, 'j1', 'x')).rejects.toMatchObject({ status: 422 });
  });

  it('list: technician is forced to their own jobs regardless of query', async () => {
    const prisma = makePrisma({ id: 'j1', companyId: 'c1', status: 'SCHEDULED' });
    const svc = new JobsService(prisma);
    await svc.list(tech, { assignedTechnicianId: 'u-other', page: 1, limit: 20 });
    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: 'c1', assignedTechnicianId: 'u-tech' }),
      }),
    );
  });
});
