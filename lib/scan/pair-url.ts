// lib/scan/pair-url.ts — the base URL a phone must open to pair with the desktop.
// "localhost" in a QR means "this phone", so in development it is swapped for
// the machine's LAN ip. SCAN_PAIR_BASE_URL overrides everything (tunnels, staging).
import os from 'node:os';

export interface PairUrlEnv {
  lanIp: string | null;
  production: boolean;
  override?: string | null;
}

export function pairBaseUrl(origin: string, env: PairUrlEnv): string {
  if (env.override) return env.override.replace(/\/+$/, '');
  if (env.production || !env.lanIp) return origin;
  try {
    const u = new URL(origin);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]') {
      u.hostname = env.lanIp;
      return u.origin;
    }
  } catch { /* fall through */ }
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

export function pairBaseUrlForRequest(origin: string): string {
  return pairBaseUrl(origin, {
    lanIp: detectLanIp(),
    production: process.env.NODE_ENV === 'production',
    override: process.env.SCAN_PAIR_BASE_URL ?? null,
  });
}
