// Shared wrapper for every /api/partner/v1 route: scope-checked OAuth auth,
// one response envelope, and no internal error text in a 500.
import { NextRequest, NextResponse } from 'next/server';
import { authenticatePartner, type PartnerAuth } from './auth';
import type { PartnerScope } from './scopes';

export function partnerOk(data: unknown, extra: Record<string, unknown> = {}, status = 200) {
  return NextResponse.json({ success: true, data, ...extra }, { status });
}

export function partnerError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { success: false, error: details === undefined ? { code, message } : { code, message, details } },
    { status, headers: status === 401 ? { 'WWW-Authenticate': 'Bearer' } : undefined },
  );
}

type Authed = Extract<PartnerAuth, { ok: true }>;

export function partnerRoute<P = Record<string, never>>(
  scope: PartnerScope,
  handler: (ctx: { request: NextRequest; auth: Authed; params: P }) => Promise<NextResponse>,
) {
  return async (request: NextRequest, context: { params: Promise<P> }) => {
    const auth = await authenticatePartner(request, scope);
    if (!auth.ok) return partnerError(auth.status, auth.code, auth.message);
    try {
      return await handler({ request, auth, params: await context.params });
    } catch (error) {
      console.error('[PartnerAPI] unhandled error', error);
      return partnerError(500, 'internal_error', 'Something went wrong on our side.');
    }
  };
}

/** Whole-number query parameter, clamped; falls back when absent or not a number. */
export function intParam(url: URL, name: string, fallback: number, max: number): number {
  const value = Number.parseInt(url.searchParams.get(name) ?? '', 10);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(value, max);
}

/** The request body as a JSON object, or null when it is not one. */
export async function readJsonObject(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

/** A copy count: absent means 1; otherwise a whole number from 1 to 999, else null. */
export function quantityOf(value: unknown): number | null {
  if (value === undefined) return 1;
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 999 ? value : null;
}

/** A non-empty list of objects no longer than `max`, else null. */
export function listOf(value: unknown, max: number): Array<Record<string, unknown>> | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > max) return null;
  return value.every(entry => entry && typeof entry === 'object') ? value : null;
}
