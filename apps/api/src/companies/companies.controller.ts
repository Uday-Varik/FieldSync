import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CompaniesService } from './companies.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CompanyGuard } from '../auth/company.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AllowUnlinked } from '../auth/public.decorator';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import type { AuthUser } from '../auth/auth-user';

@Controller()
@UseGuards(ClerkAuthGuard)
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  /** Signup flow: verified but unlinked Clerk user creates a company and becomes its ADMIN. */
  @Post('companies')
  @AllowUnlinked()
  createCompany(@CurrentUser() user: AuthUser, @Body() dto: CreateCompanyDto) {
    return this.companies.createCompany(user.clerkUserId, dto);
  }

  /** Admin only, and only for their own company (CompanyGuard: other-company id => 404). */
  @Post('companies/:id/invites')
  @UseGuards(RolesGuard, CompanyGuard)
  @Roles(Role.ADMIN)
  createInvite(
    @Param('id') companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateInviteDto,
  ) {
    return this.companies.createInvite(companyId, user.dbUser!.id, dto);
  }

  /** Token possession is the proof; route allows unlinked users so they can link. */
  @Post('invites/accept')
  @AllowUnlinked()
  acceptInvite(@CurrentUser() user: AuthUser, @Body() dto: AcceptInviteDto) {
    return this.companies.acceptInvite(user.clerkUserId, dto);
  }
}
