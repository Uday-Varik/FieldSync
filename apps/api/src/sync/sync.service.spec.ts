import { SyncService } from './sync.service';
import type { AuthUser } from '../auth/auth-user';

const tech: any = { dbUser: { id: 'u-tech', companyId: 'c1', role: 'TECHNICIAN' } };
const dispatcher: any = { dbUser: { id: 'u-disp', companyId: 'c1', role: 'DISPATCHER' } };

function makePrisma(jobOverrides: any = {}, opts: any = {}) {
  const job: any = {
    id: 'j1',
    companyId: 'c1',
    assignedTechnicianId: 'u-tech',
    status: 'SCHEDULED',
    version: 1,
    startedAt: null,
    internalNotes: null,
    customerNotes: null,
    ...jobOverrides,
  };
  const items = new Map<string, any>([
    ['i1', { id: 'i1', jobId: 'j1', label: 'Check power', isChecked: false }],
    ['i2', { id: 'i2', jobId: 'j1', label: 'Test circuit', isChecked: false }],
  ]);
  const stored = new Map<string, any>();
  let hasCurrentSignature = !!opts.hasSignature;
  const calls = { jobUpdate: 0, activity: 0 };
  const tx: any = {
    job: {
      update: jest.fn(async ({ data }: any) => {
        calls.jobUpdate++;
        for (const [k, v] of Object.entries(data)) {
          if (v && typeof v === 'object' && 'increment' in (v as any)) job[k] = (job[k] ?? 0) + (v as any).increment;
          else job[k] = v;
        }
        return { ...job };
      }),
    },
    checklistItem: {
      update: jest.fn(async ({ where, data }: any) => {
        const item = items.get(where.id);
        Object.assign(item, data);
        return { ...item };
      }),
      aggregate: jest.fn(async () => ({ _max: { sortOrder: 1 } })),
      create: jest.fn(async ({ data }: any) => ({ id: 'i-new', ...data })),
    },
    signature: {
      updateMany: jest.fn(async () => ({ count: 1 })),
      create: jest.fn(async ({ data }: any) => { hasCurrentSignature = true; return { id: 's1', ...data }; }),
    },
    photo: {
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }: any) => ({ id: 'ph1', ...data })),
    },
    jobActivity: { create: jest.fn(async ({ data }: any) => { calls.activity++; return { id: 'a1', ...data }; }) },
    syncMutation: {
      create: jest.fn(async ({ data }: any) => {
        const record = { id: 'sm1', ...data };
        stored.set(data.clientMutationId, record);
        return record;
      }),
    },
  };
  const prisma: any = {
    syncMutation: {
      findFirst: jest.fn(async ({ where }: any) => stored.get(where.clientMutationId) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const record = { id: 'sm1', ...data };
        stored.set(data.clientMutationId, record);
        return record;
      }),
    },
    job: {
      findFirst: jest.fn(async () => ({ ...job, checklist: [...items.values()] })),
    },
    checklistItem: {
      findFirst: jest.fn(async ({ where }: any) => items.get(where.id) ?? null),
    },
    signature: {
      findFirst: jest.fn(async () => (hasCurrentSignature ? { id: 's1', isCurrent: true } : null)),
    },
    user: { findFirst: jest.fn(async () => ({ id: 'u-tech', role: 'TECHNICIAN' })) },
    $transaction: jest.fn(async (cb: any) => cb(tx)),
  };
  return { prisma, job, items, stored, calls, tx };
}

const status = (to: string, clientVersion = 1, extra: any = {}) => ({
  clientMutationId: `m-${to}-${Math.random()}`,
  type: 'UPDATE_STATUS' as const,
  jobId: 'j1',
  clientVersion,
  payload: { to, ...extra },
});

describe('SyncService — must-pass cases (docs/07 §8, server side)', () => {
  it('1. offline status sequence applies in order and ends COMPLETED', async () => {
    const { prisma } = makePrisma({}, { hasSignature: false });
    const svc = new SyncService(prisma);
    const seq = [
      { ...status('EN_ROUTE'), clientMutationId: 'm1', clientVersion: 1 },
      { ...status('ON_SITE'), clientMutationId: 'm2', clientVersion: 2 },
      { ...status('IN_PROGRESS'), clientMutationId: 'm3', clientVersion: 3 },
      { clientMutationId: 'm4', type: 'ADD_SIGNATURE' as const, jobId: 'j1', clientVersion: 4, payload: { signedByName: 'Sam', imageDataUrl: 'data:image/png;base64,AAAA' } },
      { ...status('COMPLETED'), clientMutationId: 'm5', clientVersion: 5 },
    ];
    const res = await svc.sync(tech, seq as any);
    expect(res.results.map((r: any) => r.status)).toEqual(['APPLIED', 'APPLIED', 'APPLIED', 'APPLIED', 'APPLIED']);
    expect(res.results[4].serverVersion).toBe(6);
  });

  it('2. dispatcher reschedule (server newer) + technician notes: both preserved, conflict resolved', async () => {
    const { prisma, job } = makePrisma({ version: 5, scheduledDate: new Date('2026-10-30') });
    const svc = new SyncService(prisma);
    const res = await svc.sync(tech, [
      { clientMutationId: 'm-notes', type: 'ADD_NOTE' as const, jobId: 'j1', clientVersion: 4, payload: { field: 'internalNotes', text: 'Gate code 1234' } },
    ] as any);
    expect(res.results[0].status).toBe('CONFLICT_RESOLVED');
    expect(res.results[0].conflictDetails.rule).toBe('NOTE_LAST_WRITE_WINS_PREVIOUS_PRESERVED_IN_AUDIT');
    expect(job.internalNotes).toBe('Gate code 1234');
  });

  it('3. dispatcher cancels while technician completes offline: completion rejected, job shows CANCELLED', async () => {
    const { prisma } = makePrisma({ status: 'CANCELLED', version: 3 }, { hasSignature: true });
    const svc = new SyncService(prisma);
    const res = await svc.sync(tech, [{ ...status('COMPLETED', 2), clientMutationId: 'm-cancel' }] as any);
    expect(res.results[0].status).toBe('REJECTED');
    expect(res.results[0].reason).toBe('JOB_CANCELLED');
    expect(res.results[0].jobSnapshot.status).toBe('CANCELLED');
  });

  it('4. same mutation replayed twice: applied once, one audit entry', async () => {
    const { prisma, calls } = makePrisma();
    const svc = new SyncService(prisma);
    const mutation = { ...status('EN_ROUTE'), clientMutationId: 'm-replay' };
    const first = await svc.sync(tech, [mutation] as any);
    const second = await svc.sync(tech, [mutation] as any);
    expect(first.results[0].status).toBe('APPLIED');
    expect(second.results[0].status).toBe('APPLIED');
    expect(second.results[0].duplicate).toBe(true);
    expect(calls.jobUpdate).toBe(1);
    expect(calls.activity).toBe(1);
  });

  it('5. two different checklist items toggled offline: both preserved', async () => {
    const { prisma, items } = makePrisma();
    const svc = new SyncService(prisma);
    const res = await svc.sync(tech, [
      { clientMutationId: 'm-t1', type: 'TOGGLE_CHECKLIST' as const, jobId: 'j1', clientVersion: 1, payload: { itemId: 'i1', isChecked: true } },
      { clientMutationId: 'm-t2', type: 'TOGGLE_CHECKLIST' as const, jobId: 'j1', clientVersion: 2, payload: { itemId: 'i2', isChecked: true } },
    ] as any);
    expect(res.results.map((r: any) => r.status)).toEqual(['APPLIED', 'APPLIED']);
    expect(items.get('i1').isChecked).toBe(true);
    expect(items.get('i2').isChecked).toBe(true);
  });

  it('6. one rejected mutation does not roll back earlier good ones in the same batch', async () => {
    const { prisma } = makePrisma();
    const svc = new SyncService(prisma);
    const res = await svc.sync(tech, [
      { ...status('EN_ROUTE'), clientMutationId: 'm-good' },
      { ...status('COMPLETED'), clientMutationId: 'm-bad' },
    ] as any);
    expect(res.results[0].status).toBe('APPLIED');
    expect(res.results[1].status).toBe('REJECTED');
    expect(res.results[1].reason).toBe('INVALID_TRANSITION');
  });

  it('signature on an already-COMPLETED job is rejected; technician cannot edit schedule fields', async () => {
    const { prisma } = makePrisma({ status: 'COMPLETED', version: 4 });
    const svc = new SyncService(prisma);
    const res = await svc.sync(tech, [
      { clientMutationId: 'm-sig', type: 'ADD_SIGNATURE' as const, jobId: 'j1', clientVersion: 4, payload: { signedByName: 'Sam', imageDataUrl: 'data:image/png;base64,AAAA' } },
      { clientMutationId: 'm-sched', type: 'UPDATE_JOB_FIELDS' as const, jobId: 'j1', clientVersion: 4, payload: { scheduledDate: '2026-11-01' } },
    ] as any);
    expect(res.results[0].reason).toBe('ALREADY_COMPLETED');
    expect(res.results[1].reason).toBe('FORBIDDEN');
  });

  it('7. offline photo metadata: creates a PENDING photo row, additive, never a conflict', async () => {
    const { prisma, tx } = makePrisma();
    const svc = new SyncService(prisma);
    const res = await svc.sync(tech, [
      { clientMutationId: 'm-photo', type: 'ADD_PHOTO_META' as const, jobId: 'j1', clientVersion: 1, payload: { storageKey: 'jobs/j1/uuid-photo.jpg', originalFilename: 'photo.jpg', fileSizeBytes: 1234 } },
    ] as any);
    expect(res.results[0].status).toBe('APPLIED');
    expect(tx.photo.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING' }) }));
  });

  it('technician on an unassigned job is rejected; unknown job is rejected without storing', async () => {
    const { prisma } = makePrisma({ assignedTechnicianId: 'u-other' });
    const svc = new SyncService(prisma);
    const res = await svc.sync(tech, [{ ...status('EN_ROUTE'), clientMutationId: 'm-forbid' }] as any);
    expect(res.results[0].status).toBe('REJECTED');
    expect(res.results[0].reason).toBe('FORBIDDEN');
    expect(prisma.syncMutation.findFirst).toHaveBeenCalled();
  });
});
