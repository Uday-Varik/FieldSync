import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ChecklistService } from './checklist.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateChecklistDto, UpdateChecklistDto } from './dto/checklist.dto';
import type { AuthUser } from '../auth/auth-user';

@Controller('jobs/:id/checklist')
@UseGuards(ClerkAuthGuard)
export class ChecklistController {
  constructor(private readonly checklist: ChecklistService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.DISPATCHER)
  create(@CurrentUser() user: AuthUser, @Param('id') jobId: string, @Body() dto: CreateChecklistDto) {
    return this.checklist.create(user, jobId, dto.label);
  }

  @Patch(':itemId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.DISPATCHER, Role.TECHNICIAN)
  toggle(
    @CurrentUser() user: AuthUser,
    @Param('id') jobId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateChecklistDto,
  ) {
    return this.checklist.toggle(user, jobId, itemId, dto.isChecked);
  }
}
