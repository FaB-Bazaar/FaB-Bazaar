// Shared by the partner route tests: a signed-in partner caller and requests.
import { NextRequest } from 'next/server';
import type { PartnerAuth } from '@/lib/partner-api/auth';

export const CALLER: PartnerAuth = {
  ok: true,
  userId: 'user-1',
  clientId: 'client-1',
  scopes: new Set(),
};

export const DENIED: PartnerAuth = {
  ok: false,
  status: 403,
  code: 'insufficient_scope',
  message: 'missing scope',
};

export function get(path: string) {
  return new NextRequest(`http://localhost/api/partner/v1${path}`);
}

export function post(path: string, body: unknown) {
  return new NextRequest(`http://localhost/api/partner/v1${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

export const ctx = <P>(params: P) => ({ params: Promise.resolve(params) });
