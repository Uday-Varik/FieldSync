import { Module } from '@nestjs/common';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { StorageService } from './storage.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PhotosController],
  providers: [PhotosService, StorageService],
  exports: [PhotosService],
})
export class PhotosModule {}
