import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { AuthUser } from './auth-user';

/**
 * CompanyGuard: for routes whose :id (or :companyId) param is a
 * company id, the authenticated user's company must match it.
 * Mismatch returns 404, per the API spec: do not leak existence
 * of other companies' resources (a 403 would confirm the id
 * exists). Apply it only on company-scoped routes, alongside
 * ClerkAuthGuard, and after it (it needs req.user).
 */
@Injectable()
export class CompanyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    const companyId = request.params?.companyId ?? request.params?.id;
    if (!user?.dbUser || !companyId) return true;
    if (user.dbUser.companyId !== companyId) {
      throw new HttpException(
        { error: { code: 'NOT_FOUND', message: 'Not found' } },
        HttpStatus.NOT_FOUND,
      );
    }
    return true;
  }
}
