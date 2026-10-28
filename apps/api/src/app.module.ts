// Phase 1: AuthModule + JobsModule are real. Companies,
// checklist, sync, realtime, files, job-sheets, and audit
// modules are added in later Phase 1 slices, one feature
// branch each, per docs/02.
//
// Note: this branch is based on main (after PR #2), not on
// PR #3 (company-invite). If PR #3 merges first, app.module
// will conflict on merge and must keep BOTH CompaniesModule
// and JobsModule — that is the expected, one-line resolution.
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [PrismaModule, AuthModule, JobsModule],
})
export class AppModule {}
