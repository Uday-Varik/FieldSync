import { clerkMiddleware } from '@clerk/nextjs/server';

/**
 * Loads Clerk auth state on every route. Protection itself is
 * done with auth().protect() in server components (see
 * app/page.tsx), so public pages can still render a signed-out
 * landing state instead of redirecting blindly.
 */
export default clerkMiddleware();

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
