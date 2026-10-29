import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PhotosService } from './photos.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PhotoUploadUrlDto, PhotoConfirmDto } from './dto/photo.dto';
import type { AuthUser } from '../auth/auth-user';

@Controller('jobs/:jobId/photos')
@UseGuards(ClerkAuthGuard)
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @Post('upload-url')
  uploadUrl(@CurrentUser() user: AuthUser, @Param('jobId') jobId: string, @Body() dto: PhotoUploadUrlDto) {
    return this.photos.uploadUrl(user, jobId, dto.filename, dto.contentType);
  }

  @Post('confirm')
  confirm(@CurrentUser() user: AuthUser, @Param('jobId') jobId: string, @Body() dto: PhotoConfirmDto) {
    return this.photos.confirm(user, jobId, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('jobId') jobId: string) {
    return this.photos.list(user, jobId);
  }

  @Delete(':photoId')
  remove(@CurrentUser() user: AuthUser, @Param('jobId') jobId: string, @Param('photoId') photoId: string) {
    return this.photos.remove(user, jobId, photoId);
  }
}
