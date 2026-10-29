import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JobsService } from './jobs.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { AssignJobDto, CancelJobDto, ChangeStatusDto, ReopenJobDto } from './dto/job-action.dto';
import { CreateSignatureDto } from './dto/signature.dto';
import type { AuthUser } from '../auth/auth-user';
import type { JobStatus } from '@prisma/client';

@Controller('jobs')
@UseGuards(ClerkAuthGuard)
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: JobStatus,
    @Query('assignedTechnicianId') assignedTechnicianId?: string,
    @Query('priority') priority?: string,
    @Query('search') search?: string,
    @Query('date') date?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.jobs.list(user, {
      status, assignedTechnicianId, priority, search, date, dateFrom, dateTo,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.jobs.get(user, id);
  }

  @Get(':id/activity')
  activity(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.jobs.activityList(user, id, page ? parseInt(page, 10) : 1, limit ? parseInt(limit, 10) : 20);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.DISPATCHER)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateJobDto) {
    return this.jobs.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateJobDto) {
    return this.jobs.update(user, id, dto);
  }

  @Post(':id/status')
  changeStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ChangeStatusDto) {
    return this.jobs.changeStatus(user, id, dto.status, dto.reason);
  }

  @Post(':id/signature')
  createSignature(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateSignatureDto) {
    return this.jobs.createSignature(user, id, dto.signedByName, dto.imageDataUrl);
  }

  @Post(':id/assign')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.DISPATCHER)
  assign(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AssignJobDto) {
    return this.jobs.assign(user, id, dto.technicianId);
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.DISPATCHER)
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CancelJobDto) {
    return this.jobs.cancel(user, id, dto.reason);
  }

  @Post(':id/reopen')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  reopen(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReopenJobDto) {
    return this.jobs.reopen(user, id, dto.reason);
  }
}
