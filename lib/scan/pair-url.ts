// lib/scan/pair-url.ts — the base URL a phone must open to pair with the desktop.
// Behind Caddy the container sees itself as 0.0.0.0:3000, and "localhost" in a
// QR means "this phone", so the origin alone is never good enough. Precedence:
//   SCAN_PAIR_BASE_URL  →  proxy X-Forwarded-Host/Proto (what the user typed)
//   →  NEXT_PUBLIC_APP_URL / NEXTAUTH_URL in production when the origin is an
//   internal bind address  →  LAN ip for localhost in dev  →  the origin.
import os from 'node:os';
import type { NextRequest } from 'next/server';

export interface PairUrlEnv {
  lanIp: string | null;
  production: boolean;
  override?: string | null;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
  appUrl?: string | null;
}

const INTERNAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '[::]']);
const trimSlash = (u: string) => u.replace(/\/+$/, '');

export function pairBaseUrl(origin: string, env: PairUrlEnv): string {
  if (env.override) return trimSlash(env.override);
  if (env.forwardedHost) {
    const host = env.forwardedHost.split(',')[0].trim();
    const proto = (env.forwardedProto ?? '').split(',')[0].trim() || (env.production ? 'https' : 'http');
    if (host) return `${proto}://${host}`;
  }
  let hostname: string | null = null;
  try { hostname = new URL(origin).hostname; } catch { return origin; }
  const internal = INTERNAL_HOSTS.has(hostname);
  if (env.production) {
    if (internal && env.appUrl) return trimSlash(env.appUrl);
    return origin;
  }
  if (internal && env.lanIp) {
    const u = new URL(origin);
    u.hostname = env.lanIp;
    return u.origin;
  }
  return origin;
}

/** First non-internal IPv4 address of this machine, or null. */
export function detectLanIp(): string | null {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) return a.address;
    }
  }
  return null;
}

export function pairBaseUrlForRequest(request: NextRequest): string {
  return pairBaseUrl(request.nextUrl.origin, {
    lanIp: detectLanIp(),
    production: process.env.NODE_ENV === 'production',
    override: process.env.SCAN_PAIR_BASE_URL ?? null,
    forwardedHost: request.headers.get('x-forwarded-host'),
    forwardedProto: request.headers.get('x-forwarded-proto'),
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? null,
  });
}
