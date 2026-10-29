/**
 * Server-side API client for the NestJS API.
 * The Clerk session token is passed as a Bearer token, exactly
 * as the API guard expects. API downtime is returned as data,
 * not thrown, so a page can render an honest "API unavailable"
 * state instead of crashing the build or the request.
 */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function fetchApi(token: string | null, path: string) {
  if (!token) return { status: 401, data: null, error: 'No session token' };
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data, error: res.ok ? null : 'API error' };
  } catch {
    return { status: 0, data: null, error: 'API unavailable' };
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
