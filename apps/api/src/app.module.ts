// Phase 1: AuthModule, CompaniesModule, and JobsModule are
// real. Checklist, sync, realtime, files, job-sheets, and
// audit modules are added in later Phase 1 slices, one
// feature branch each.
//
// Merge resolution (PR #4 after PR #3): this file keeps BOTH
// CompaniesModule (PR #3) and JobsModule (PR #4) — neither
// branch's version alone is correct after the other merges.
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [PrismaModule, AuthModule, CompaniesModule, JobsModule],
})
export class AppModule {}
