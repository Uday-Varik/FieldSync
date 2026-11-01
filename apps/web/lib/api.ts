/**
 * Server-side API client for the NestJS API.
 * The Clerk session token is passed as a Bearer token, exactly
 * as the API guard expects. API downtime is returned as data,
 * not thrown, so a page can render an honest "API unavailable"
 * state instead of crashing the build or the request.
 */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// The API error code is preserved (errorCode) so pages can tell a
// refused account apart from a down API: a signed-in user whose
// Clerk account is not linked to a company gets USER_NOT_LINKED
// (403), which must show the sign-up/invite rules — never the
// generic "API unavailable" text. `error` keeps its old strings
// so existing checks keep working.
async function fetchApi(token: string | null, path: string) {
  if (!token) return { status: 401, data: null, error: 'No session token', errorCode: 'UNAUTHENTICATED' };
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    return {
      status: res.status,
      data,
      error: res.ok ? null : 'API error',
      errorCode: res.ok ? null : (data?.error?.code ?? null),
    };
  } catch {
    return { status: 0, data: null, error: 'API unavailable', errorCode: null };
  }
}

export async function fetchMe(token: string | null) {
  return fetchApi(token, '/me');
}

export async function fetchJobs(token: string | null, query: string) {
  return fetchApi(token, `/jobs${query ? `?${query}` : ''}`);
}

export async function fetchJob(token: string | null, id: string) {
  return fetchApi(token, `/jobs/${id}`);
}

export async function fetchJobActivity(token: string | null, id: string) {
  return fetchApi(token, `/jobs/${id}/activity?limit=50`);
}

export type Me = {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'DISPATCHER' | 'TECHNICIAN';
  companyId: string;
  company: { id: string; name: string; timezone: string };
} | null;
