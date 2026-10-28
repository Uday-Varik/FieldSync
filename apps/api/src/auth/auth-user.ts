import type { Role } from '@prisma/client';

/**
 * What a guard attaches to the request after authentication.
 * dbUser is null only on routes marked @AllowUnlinked() (for
 * example GET /me, where an unlinked Clerk user needs a clear
 * USER_NOT_LINKED answer instead of a generic 401).
 */
export interface AuthUser {
  clerkUserId: string;
  dbUser: {
    id: string;
    email: string;
    name: string;
    companyId: string;
    role: Role;
    isActive: boolean;
  } | null;
}
