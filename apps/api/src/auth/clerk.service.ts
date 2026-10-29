import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createClerkClient, verifyToken } from '@clerk/backend';

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

  /**
   * Real Clerk profile for a verified user id: primary email and
   * display name. Used by company creation and invite accept,
   * because the FieldSync User row requires email + name and
   * those must come from Clerk, not from a client-supplied body
   * (a client could otherwise claim someone else's email).
   */
  async getProfile(clerkUserId: string): Promise<{ email: string; name: string }> {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey || secretKey.includes('placeholder')) {
      throw new HttpException(
        { error: { code: 'AUTH_NOT_CONFIGURED', message: 'Clerk is not configured' } },
        HttpStatus.UNAUTHORIZED,
      );
    }
    try {
      const client = createClerkClient({ secretKey });
      const clerkUser = await client.users.getUser(clerkUserId);
      const email =
        clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
          ?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;
      if (!email) throw new Error('No email on Clerk user');
      const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ');
      return { email, name: fullName || email.split('@')[0] };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        { error: { code: 'CLERK_PROFILE_FAILED', message: 'Could not load Clerk profile' } },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
