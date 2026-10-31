import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PhotosModule } from '../photos/photos.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [AuthModule, PhotosModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
