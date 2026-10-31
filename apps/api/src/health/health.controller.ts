import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { HealthService } from './health.service';

/**
 * Phase 5 health endpoints (docs/09 §5).
 * GET /health is public: load balancers and Fly.io checks hit it
 * without credentials. GET /health/db needs a verified Clerk token
 * and returns 503 when the database is down, so a deploy target
 * can tell "process up, dependencies down" apart from "healthy".
 */
@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('health')
  liveness() {
    return this.health.liveness();
  }

  @Get('health/db')
  @UseGuards(ClerkAuthGuard)
  async readiness() {
    const result = await this.health.readiness();
    if (result.db === 'down') {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
