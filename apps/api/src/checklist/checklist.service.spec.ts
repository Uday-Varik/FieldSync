import { ChecklistService } from './checklist.service';

const tech = { clerkUserId: 'clerk-t', dbUser: { id: 'u-tech', companyId: 'c1', role: 'TECHNICIAN' } } as any;
const dispatcher = { clerkUserId: 'clerk-d', dbUser: { id: 'u-disp', companyId: 'c1', role: 'DISPATCHER' } } as any;

function makePrisma(job: any, item: any = null) {
  const prisma: any = {
    job: { findFirst: jest.fn().mockResolvedValue(job) },
    checklistItem: {
      aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 2 } }),
      create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'item-new', ...data })),
      findFirst: jest.fn().mockResolvedValue(item),
      update: jest.fn().mockImplementation(async ({ data }: any) => ({ ...item, ...data })),
    },
    jobActivity: { create: jest.fn() },
    $transaction: async (fn: any) => fn(prisma),
  };
  return prisma;
}

describe('ChecklistService', () => {
  it('create: appends at next sortOrder, and rejects terminal jobs', async () => {
    const prisma = makePrisma({ id: 'j1', companyId: 'c1', status: 'IN_PROGRESS' });
    const svc = new ChecklistService(prisma);
    const out = await svc.create(dispatcher, 'j1', 'Turn off power');
    expect(out.sortOrder).toBe(3);

    const prisma2 = makePrisma({ id: 'j1', companyId: 'c1', status: 'COMPLETED' });
    await expect(new ChecklistService(prisma2).create(dispatcher, 'j1', 'x')).rejects.toMatchObject({ status: 422 });
  });

  it('toggle: technician on another job is 404, assigned technician toggles + writes activity', async () => {
    const prisma = makePrisma({ id: 'j1', companyId: 'c1', status: 'IN_PROGRESS', assignedTechnicianId: 'u-other' });
    await expect(
      new ChecklistService(prisma).toggle(tech, 'j1', 'item-1', true),
    ).rejects.toMatchObject({ status: 404 });

    const prisma2 = makePrisma(
      { id: 'j1', companyId: 'c1', status: 'IN_PROGRESS', assignedTechnicianId: 'u-tech' },
      { id: 'item-1', isChecked: false },
    );
    const out = await new ChecklistService(prisma2).toggle(tech, 'j1', 'item-1', true);
    expect(out.isChecked).toBe(true);
    expect(out.checkedById).toBe('u-tech');
    expect(prisma2.jobActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'CHECKLIST_CHECKED' }) }),
    );
  });

  it('toggle: unknown item on a scoped job is 404', async () => {
    const prisma = makePrisma({ id: 'j1', companyId: 'c1', status: 'IN_PROGRESS', assignedTechnicianId: 'u-tech' }, null);
    await expect(new ChecklistService(prisma).toggle(tech, 'j1', 'missing', true)).rejects.toMatchObject({ status: 404 });
  });
});
