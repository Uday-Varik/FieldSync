// Phase 1: AuthModule is real. Companies, jobs, sync, realtime,
// files, job-sheets, and audit modules are added in later
// Phase 1 slices, one feature branch each, per docs/02.
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
})
export class AppModule {}
