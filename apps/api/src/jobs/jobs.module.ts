import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobSheetService } from './job-sheet.service';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [JobsController],
  providers: [JobsService, JobSheetService],
  exports: [JobsService],
})
export class JobsModule {}
