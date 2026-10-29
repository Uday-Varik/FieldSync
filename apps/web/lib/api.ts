/**
 * Server-side API client for the NestJS API (PR #2: GET /me).
 * The Clerk session token is passed as a Bearer token, exactly
 * as the API guard expects. API downtime is returned as data,
 * not thrown, so a page can render an honest "API unavailable"
 * state instead of crashing the build or the request.
 */
export async function fetchMe(token: string | null) {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  if (!token) return { status: 401, data: null, error: 'No session token' };
  try {
    const res = await fetch(`${base}/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data, error: res.ok ? null : 'API error' };
  } catch {
    return { status: 0, data: null, error: 'API unavailable' };
  }
}
