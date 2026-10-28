import { HttpException } from '@nestjs/common';
import { CompaniesService, hashInviteToken } from './companies.service';

function makePrisma(overrides: any = {}) {
  const prisma: any = {
    user: { findUnique: jest.fn(), create: jest.fn() },
    company: { create: jest.fn() },
    invite: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: async (fn: any) => fn(prisma),
    ...overrides,
  };
  return prisma;
}

describe('CompaniesService', () => {
  it('createCompany: rejects an already-linked user with 409', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    const svc = new CompaniesService(prisma, { getProfile: jest.fn() } as any);
    await expect(
      svc.createCompany('clerk-1', { name: 'Acme', timezone: 'America/Chicago' }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('createCompany: creates company + ADMIN user in one transaction', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.company.create.mockResolvedValue({ id: 'c1', name: 'Acme', timezone: 'America/Chicago' });
    prisma.user.create.mockResolvedValue({ id: 'u1', email: 'a@x.com', name: 'Ava', role: 'ADMIN' });
    const svc = new CompaniesService(prisma, {
      getProfile: jest.fn().mockResolvedValue({ email: 'a@x.com', name: 'Ava' }),
    } as any);
    const out = await svc.createCompany('clerk-1', { name: 'Acme', timezone: 'America/Chicago' });
    expect(out.user.role).toBe('ADMIN');
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'ADMIN' }) }),
    );
  });

  it('createInvite: rejects a duplicate pending invite, and stores only a hash', async () => {
    const prisma = makePrisma();
    prisma.invite.findFirst.mockResolvedValue({ id: 'i-old' });
    const svc = new CompaniesService(prisma, {} as any);
    await expect(
      svc.createInvite('c1', 'u1', { email: 'tina@x.com', role: 'TECHNICIAN' as any }),
    ).rejects.toMatchObject({ status: 409 });

    prisma.invite.findFirst.mockResolvedValue(null);
    prisma.invite.create.mockImplementation(async ({ data }: any) => ({ ...data, id: 'i1' }));
    const out = await svc.createInvite('c1', 'u1', { email: 'tina@x.com', role: 'TECHNICIAN' as any });
    expect(out.token).toBeTruthy();
    const stored = prisma.invite.create.mock.calls[0][0].data;
    expect(stored.tokenHash).toBe(hashInviteToken(out.token));
    expect(stored.tokenHash).not.toBe(out.token);
  });

  it('acceptInvite: unknown token 404, used invite 409, expired invite 422 + marked EXPIRED', async () => {
    const prisma = makePrisma();
    const svc = new CompaniesService(prisma, { getProfile: jest.fn() } as any);
    prisma.invite.findUnique.mockResolvedValue(null);
    await expect(svc.acceptInvite('clerk-9', { token: 'nope' })).rejects.toMatchObject({ status: 404 });

    prisma.invite.findUnique.mockResolvedValue({ id: 'i1', status: 'ACCEPTED', expiresAt: new Date(Date.now() + 1000) });
    await expect(svc.acceptInvite('clerk-9', { token: 't' })).rejects.toMatchObject({ status: 409 });

    prisma.invite.findUnique.mockResolvedValue({ id: 'i1', status: 'PENDING', expiresAt: new Date(Date.now() - 1000) });
    await expect(svc.acceptInvite('clerk-9', { token: 't' })).rejects.toMatchObject({ status: 422 });
    expect(prisma.invite.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'EXPIRED' } }),
    );
  });

  it('acceptInvite: creates the user with the invite role and marks the invite ACCEPTED', async () => {
    const prisma = makePrisma();
    prisma.invite.findUnique.mockResolvedValue({
      id: 'i1', status: 'PENDING', expiresAt: new Date(Date.now() + 100000),
      email: 'tina@x.com', role: 'TECHNICIAN', companyId: 'c1',
    });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u2', email: 'tina@x.com', name: 'Tina', role: 'TECHNICIAN', companyId: 'c1' });
    prisma.invite.update.mockResolvedValue({ id: 'i1', status: 'ACCEPTED' });
    const svc = new CompaniesService(prisma, {
      getProfile: jest.fn().mockResolvedValue({ email: 'tina@x.com', name: 'Tina' }),
    } as any);
    const out = await svc.acceptInvite('clerk-9', { token: 'raw-token' });
    expect(out.user.role).toBe('TECHNICIAN');
    expect(out.invite.status).toBe('ACCEPTED');
    expect(prisma.invite.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashInviteToken('raw-token') },
    });
  });
});
