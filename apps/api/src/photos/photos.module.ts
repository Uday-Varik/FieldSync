import { Module } from '@nestjs/common';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { StorageService } from './storage.service';
import { ThumbnailService } from './thumbnail.service';
import { ThumbnailQueue } from './thumbnail-queue';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [PhotosController],
  providers: [PhotosService, StorageService, ThumbnailService, ThumbnailQueue],
  exports: [PhotosService],
})
export class PhotosModule {}
