import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { verifyToken } from '@clerk/backend';

/**
 * Verifies a Clerk session token and returns the Clerk user id (sub).
 *
 * No dev bypass, no test-token backdoor: a token is either valid
 * with Clerk, or the request is unauthenticated. Local testing
 * therefore needs real Clerk keys (see apps/api/.env.example) —
 * that is a documented Phase 1 requirement, not something to fake.
 *
 * Errors use the API spec shape: { error: { code, message } }.
 */
@Injectable()
export class ClerkService {
  async verify(token: string): Promise<string> {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey || secretKey.includes('placeholder')) {
      throw new HttpException(
        { error: { code: 'AUTH_NOT_CONFIGURED', message: 'Clerk is not configured' } },
        HttpStatus.UNAUTHORIZED,
      );
    }
    try {
      const payload = await verifyToken(token, { secretKey });
      if (!payload?.sub) {
        throw new Error('Missing sub');
      }
      return payload.sub;
    } catch {
      throw new HttpException(
        { error: { code: 'INVALID_TOKEN', message: 'Invalid Clerk token' } },
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
}
