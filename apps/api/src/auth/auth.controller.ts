import { Controller, Get, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { AllowUnlinked } from './public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './auth-user';

/**
 * GET /me — current user + company + role (API spec).
 * @AllowUnlinked(): a verified Clerk user with no DB row yet
 * gets a clear 404 USER_NOT_LINKED here, instead of the
 * guard's 403, so the client can route them to company
 * creation / invite accept (next slices in Phase 1).
 */
@Controller()
@UseGuards(ClerkAuthGuard)
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  @AllowUnlinked()
  async me(@CurrentUser() user: AuthUser) {
    if (!user.dbUser) {
      throw new HttpException(
        { error: { code: 'USER_NOT_LINKED', message: 'Clerk user is not linked to a company yet' } },
        HttpStatus.NOT_FOUND,
      );
    }
    const company = await this.prisma.company.findUnique({
      where: { id: user.dbUser.companyId },
      select: { id: true, name: true, timezone: true },
    });
    if (!company) {
      throw new HttpException(
        { error: { code: 'NOT_FOUND', message: 'Not found' } },
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      id: user.dbUser.id,
      email: user.dbUser.email,
      name: user.dbUser.name,
      role: user.dbUser.role,
      companyId: user.dbUser.companyId,
      company,
    };
  }
}
