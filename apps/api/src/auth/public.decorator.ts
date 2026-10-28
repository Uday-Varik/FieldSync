import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNLINKED_KEY = 'allowUnlinked';

/**
 * Mark a route as allowing a verified Clerk user who has no
 * FieldSync DB row yet. The guard still verifies the token;
 * it just does not reject a missing DB user. Use only for
 * routes that must explain the unlinked state (GET /me).
 */
export const AllowUnlinked = () => SetMetadata(ALLOW_UNLINKED_KEY, true);
