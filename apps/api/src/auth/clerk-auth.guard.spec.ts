import { HttpException } from '@nestjs/common';
import { ClerkAuthGuard } from './clerk-auth.guard';

function mockContext(request: any, allowUnlinked = false) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

const dbUser = {
  id: 'user-1',
  email: 'tina@demo.fieldsync',
  name: 'Tina',
  companyId: 'company-1',
  role: 'TECHNICIAN',
  isActive: true,
};

describe('ClerkAuthGuard', () => {
  it('rejects a missing Bearer token with 401', async () => {
    const guard = new ClerkAuthGuard({ verify: jest.fn() } as any, {} as any, {
      getAllAndOverride: () => false,
    } as any);
    await expect(guard.canActivate(mockContext({ headers: {} }))).rejects.toThrow(HttpException);
    try {
      await guard.canActivate(mockContext({ headers: {} }));
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(401);
    }
  });

  it('attaches req.user for a valid token + linked user', async () => {
    const request: any = { headers: { authorization: 'Bearer good-token' } };
    const guard = new ClerkAuthGuard(
      { verify: jest.fn().mockResolvedValue('clerk-123') } as any,
      { user: { findUnique: jest.fn().mockResolvedValue(dbUser) } } as any,
      { getAllAndOverride: () => false } as any,
    );
    expect(await guard.canActivate(mockContext(request))).toBe(true);
    expect(request.user.clerkUserId).toBe('clerk-123');
    expect(request.user.dbUser.companyId).toBe('company-1');
  });

  it('rejects an unlinked user with 403, unless @AllowUnlinked()', async () => {
    const clerk = { verify: jest.fn().mockResolvedValue('clerk-999') };
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } };
    const strict = new ClerkAuthGuard(clerk as any, prisma as any, {
      getAllAndOverride: () => false,
    } as any);
    await expect(
      strict.canActivate(mockContext({ headers: { authorization: 'Bearer t' } })),
    ).rejects.toMatchObject({ status: 403 });

    const request: any = { headers: { authorization: 'Bearer t' } };
    const lenient = new ClerkAuthGuard(clerk as any, prisma as any, {
      getAllAndOverride: () => true,
    } as any);
    expect(await lenient.canActivate(mockContext(request))).toBe(true);
    expect(request.user.dbUser).toBeNull();
  });

  it('rejects an inactive user with 403', async () => {
    const guard = new ClerkAuthGuard(
      { verify: jest.fn().mockResolvedValue('clerk-123') } as any,
      { user: { findUnique: jest.fn().mockResolvedValue({ ...dbUser, isActive: false }) } } as any,
      { getAllAndOverride: () => false } as any,
    );
    await expect(
      guard.canActivate(mockContext({ headers: { authorization: 'Bearer t' } })),
    ).rejects.toMatchObject({ status: 403 });
  });
});
