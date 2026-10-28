import { HttpException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { CompanyGuard } from './company.guard';

function mockContext(request: any) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

describe('RolesGuard', () => {
  it('allows a listed role and rejects others with 403', () => {
    const guard = new RolesGuard({ getAllAndOverride: () => ['ADMIN'] } as any);
    expect(
      guard.canActivate(
        mockContext({ user: { dbUser: { role: 'ADMIN' } } }),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(mockContext({ user: { dbUser: { role: 'TECHNICIAN' } } })),
    ).toThrow(HttpException);
  });

  it('allows any authenticated user when no @Roles() is set', () => {
    const guard = new RolesGuard({ getAllAndOverride: () => undefined } as any);
    expect(
      guard.canActivate(mockContext({ user: { dbUser: { role: 'TECHNICIAN' } } })),
    ).toBe(true);
  });
});

describe('CompanyGuard', () => {
  it('returns 404 (not 403) for another company, so existence does not leak', () => {
    const guard = new CompanyGuard();
    expect(
      guard.canActivate(
        mockContext({
          params: { id: 'company-1' },
          user: { dbUser: { companyId: 'company-1' } },
        }),
      ),
    ).toBe(true);
    try {
      guard.canActivate(
        mockContext({
          params: { id: 'company-2' },
          user: { dbUser: { companyId: 'company-1' } },
        }),
      );
      fail('should have thrown');
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(404);
    }
  });
});
