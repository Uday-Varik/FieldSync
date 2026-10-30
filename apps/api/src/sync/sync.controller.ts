import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user';
import { SyncService } from './sync.service';
import { SyncRequestDto } from './dto/sync.dto';

/**
 * POST /sync — Phase 4 offline sync intake (docs/07).
 * Authenticated with the Clerk guard, same as every
 * other API route. ValidationPipe (whitelist, forbid
 * unknown fields) rejects batches over 50 mutations
 * and malformed mutation shapes before the service
 * sees them; per-mutation rejections are returned in
 * the response, never as HTTP errors, so one bad
 * mutation cannot fail the whole batch.
 */
@Controller('sync')
@UseGuards(ClerkAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  syncMutations(@CurrentUser() user: AuthUser, @Body() dto: SyncRequestDto) {
    return this.syncService.sync(user, dto.mutations);
  }
}
