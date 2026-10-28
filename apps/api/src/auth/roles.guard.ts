import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import type { Role } from '@prisma/client';
import type { AuthUser } from './auth-user';

/**
 * RolesGuard: after ClerkAuthGuard, allow only the roles listed
 * by @Roles(). No @Roles() on a route means any authenticated,
 * linked, active user may use it. Wrong role: 403, not 404 —
 * the route itself exists; the user simply may not use it.
 * (Cross-company resource access is a different guard: it
 * returns 404, so existence does not leak across companies.)
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user?.dbUser || !required.includes(user.dbUser.role)) {
      throw new HttpException(
        { error: { code: 'FORBIDDEN', message: 'Role does not allow this action' } },
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
