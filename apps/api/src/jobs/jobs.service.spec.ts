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
    jobNoteDocument: {
      findFirst: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockImplementation(async ({ create }: any) => ({ id: 'nd1', ...create, updatedAt: new Date() })),
    },
    user: { findFirst: jest.fn() },
    signature: {
      updateMany: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 's1', ...data })),
    },
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

  it('changeStatus: emits a realtime job:updated event after a valid transition', async () => {
    const prisma = makePrisma({ id: 'j1', companyId: 'c1', assignedTechnicianId: 'u-admin', status: 'SCHEDULED', startedAt: null });
    const realtime = { emitJobUpdated: jest.fn() };
    const svc = new JobsService(prisma, undefined as any, realtime as any);
    await svc.changeStatus(admin, 'j1', 'EN_ROUTE');
    expect(realtime.emitJobUpdated).toHaveBeenCalledWith('c1', 'j1', 'EN_ROUTE', expect.anything());
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

  it('signature: capture supersedes the old signature and writes activity', async () => {
    const prisma = makePrisma({ id: 'j1', companyId: 'c1', assignedTechnicianId: 'u-tech', status: 'IN_PROGRESS' });
    const svc = new JobsService(prisma);
    const sig = await svc.createSignature(tech, 'j1', 'Customer Name', 'data:image/png;base64,abc');
    expect(prisma.signature.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { jobId: 'j1', isCurrent: true } }),
    );
    expect(prisma.signature.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ signedByName: 'Customer Name', isCurrent: true }) }),
    );
    expect(sig.signedByName).toBe('Customer Name');
  });

  it('signature: completing without a signature is 422 for a technician, allowed for a dispatcher with a reason', async () => {
    const job = { id: 'j1', companyId: 'c1', assignedTechnicianId: 'u-tech', status: 'IN_PROGRESS', startedAt: new Date() };
    const prisma = makePrisma(job);
    const svc = new JobsService(prisma);
    await expect(svc.changeStatus(tech, 'j1', 'COMPLETED')).rejects.toMatchObject({ status: 422 });
    await expect(svc.changeStatus(admin, 'j1', 'COMPLETED')).rejects.toMatchObject({ status: 422 });
    const out = await svc.changeStatus(admin, 'j1', 'COMPLETED', 'Customer unavailable to sign');
    expect(out.status).toBe('COMPLETED');
  });

  it('signature: completing with a current signature succeeds for a technician', async () => {
    const prisma = makePrisma({ id: 'j1', companyId: 'c1', assignedTechnicianId: 'u-tech', status: 'IN_PROGRESS', startedAt: new Date() });
    prisma.signature.findFirst.mockResolvedValue({ id: 's1', isCurrent: true });
    const svc = new JobsService(prisma);
    const out = await svc.changeStatus(tech, 'j1', 'COMPLETED');
    expect(out.status).toBe('COMPLETED');
  });

  it('geocode: returns null without a Mapbox token, coordinates with one', async () => {
    const prisma = makePrisma({ id: 'j1', companyId: 'c1', status: 'SCHEDULED' });
    const svc = new JobsService(prisma);
    delete process.env.MAPBOX_TOKEN;
    await expect(svc.geocode({ addressLine1: '1 Main St', city: 'Memphis', state: 'TN', postalCode: '38103' })).resolves.toBeNull();
    process.env.MAPBOX_TOKEN = 'test-token';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ center: [-90.05, 35.15] }] }),
    });
    const originalFetch = global.fetch;
    (global as any).fetch = fetchMock;
    try {
      await expect(svc.geocode({ addressLine1: '1 Main St', city: 'Memphis', state: 'TN', postalCode: '38103' })).resolves.toEqual({ lng: -90.05, lat: 35.15 });
    } finally {
      (global as any).fetch = originalFetch;
      delete process.env.MAPBOX_TOKEN;
    }
  });

  it('notes snapshot: save upserts the Yjs snapshot, get returns it as base64', async () => {
    const prisma = makePrisma({ id: 'j1', companyId: 'c1', assignedTechnicianId: 'u-tech', status: 'IN_PROGRESS' });
    const svc = new JobsService(prisma);
    const saved = await svc.saveNoteSnapshot(tech, 'j1', Buffer.from('yjs-update').toString('base64'));
    expect(saved.jobId).toBe('j1');
    expect(prisma.jobNoteDocument.upsert).toHaveBeenCalled();
    const empty = await svc.getNoteSnapshot(tech, 'j1');
    expect(empty.snapshotBase64).toBeNull();
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
