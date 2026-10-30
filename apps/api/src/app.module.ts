// Phase 1: AuthModule, CompaniesModule, JobsModule, and
// ChecklistModule are real. Sync, realtime, files, job-sheets,
// and audit modules are added in later Phase 1 slices, one
// feature branch each.
//
// Merge resolution: this file keeps CompaniesModule (PR #3),
// JobsModule (PR #7, rebased jobs), and ChecklistModule —
// neither earlier branch's version alone is correct after
// the others merge.
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { JobsModule } from './jobs/jobs.module';
import { ChecklistModule } from './checklist/checklist.module';
import { PhotosModule } from './photos/photos.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [PrismaModule, AuthModule, CompaniesModule, JobsModule, ChecklistModule, PhotosModule, RealtimeModule],
})
export class AppModule {}
