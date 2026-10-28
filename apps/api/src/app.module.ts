// Phase 1: AuthModule + ChecklistModule are real. Companies,
// jobs, sync, realtime, files, job-sheets, and audit modules
// are added in later Phase 1 slices, one feature branch each.
//
// Note: this branch is based on main (after PR #2), not on
// PR #3 or PR #4. If those merge first, app.module will
// conflict on merge and must keep ALL modules —
// CompaniesModule, JobsModule, and ChecklistModule.
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ChecklistModule } from './checklist/checklist.module';

@Module({
  imports: [PrismaModule, AuthModule, ChecklistModule],
})
export class AppModule {}
