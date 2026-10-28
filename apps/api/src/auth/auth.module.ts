import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { ClerkService } from './clerk.service';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { RolesGuard } from './roles.guard';
import { CompanyGuard } from './company.guard';

@Module({
  controllers: [AuthController],
  providers: [ClerkService, ClerkAuthGuard, RolesGuard, CompanyGuard],
  exports: [ClerkService, ClerkAuthGuard, RolesGuard, CompanyGuard],
})
export class AuthModule {}
