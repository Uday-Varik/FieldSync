import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClerkService } from './clerk.service';
import { PrismaService } from '../prisma/prisma.service';
import { ALLOW_UNLINKED_KEY } from './public.decorator';
import type { AuthUser } from './auth-user';

/**
 * ClerkAuthGuard (API spec: Bearer token, company membership + role
 * checked by NestJS guards on every request).
 *
 * - No token, or an invalid token: 401.
 * - Valid token, no DB user, route not marked @AllowUnlinked():
 *   403 USER_NOT_LINKED (the Clerk account is real, it just has
 *   not been linked to a company yet — invite/accept flow).
 * - Valid token, DB user found but isActive = false: 403.
 * - Otherwise attaches req.user (AuthUser) for later guards
 *   (roles, company) and controllers (@CurrentUser()).
 */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly clerk: ClerkService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers?.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new HttpException(
        { error: { code: 'UNAUTHENTICATED', message: 'Missing Authorization Bearer token' } },
        HttpStatus.UNAUTHORIZED,
      );
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new HttpException(
        { error: { code: 'UNAUTHENTICATED', message: 'Missing Authorization Bearer token' } },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const clerkUserId = await this.clerk.verify(token);
    const dbUser = await this.prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true, email: true, name: true, companyId: true, role: true, isActive: true },
    });

    const allowUnlinked = this.reflector.getAllAndOverride<boolean>(ALLOW_UNLINKED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!dbUser) {
      if (allowUnlinked) {
        request.user = { clerkUserId, dbUser: null } satisfies AuthUser;
        return true;
      }
      throw new HttpException(
        { error: { code: 'USER_NOT_LINKED', message: 'Clerk user is not linked to a company yet' } },
        HttpStatus.FORBIDDEN,
      );
    }
    if (!dbUser.isActive) {
      throw new HttpException(
        { error: { code: 'USER_INACTIVE', message: 'User account is inactive' } },
        HttpStatus.FORBIDDEN,
      );
    }

    request.user = { clerkUserId, dbUser } satisfies AuthUser;
    return true;
  }
}
