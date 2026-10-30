import { Module } from '@nestjs/common';
import { JobsGateway } from './jobs.gateway';
import { RealtimeService } from './realtime.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [JobsGateway, RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
