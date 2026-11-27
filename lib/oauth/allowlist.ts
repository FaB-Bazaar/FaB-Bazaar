// Which OAuth apps may connect to FaB Bazaar at all (migration 0136; managed
// at /admin/oauth-apps). Pure rules — the entries come from the database.
//
// Two kinds of entry:
//  - redirect_host: every app whose return addresses are ALL on this host
//    (exact host name; any port). For AI assistants (claude.ai, chatgpt.com…)
//    that register a fresh client per connection, so ids can't be listed. A
//    copycat can't use a host it doesn't control: the approval code is only
//    ever sent to the registered return address.
//  - client_id: one specific registered app (a partner such as Cintari).
//
// `access` says what the entry approves: 'full' = full-account grants (the
// legacy "read write" MCP hosts ask for), 'partner' = partner API scopes,
// 'all' = both.

import { classifyScopeRequest } from './consent';

export type AllowlistKind = 'redirect_host' | 'client_id';
export type AllowlistAccess = 'full' | 'partner' | 'all';
export type AccessKind = 'full' | 'partner';

export interface AllowlistEntry {
  kind: AllowlistKind;
  value: string;
  access: AllowlistAccess;
}

const covers = (access: AllowlistAccess, kind: AccessKind) => access === 'all' || access === kind;

/** A return address's host name, lowercased, without port; null if it isn't a URL. */
export function redirectHost(uri: string): string | null {
  try {
    const host = new URL(uri).hostname.toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

/** What a grant with this scope string is: partner scopes only, or full account. */
export function accessKindOfScope(scope: string | null | undefined): AccessKind {
  return classifyScopeRequest(scope).kind === 'partner' ? 'partner' : 'full';
}

/**
 * Is this app approved for this kind of access? Approved by its client id, or
 * — when it has return addresses — by every one of them being on an allowed host.
 */
export function isApproved(
  app: { clientId: string; redirectUris: string[] },
  kind: AccessKind,
  entries: AllowlistEntry[],
): boolean {
  const usable = entries.filter(e => covers(e.access, kind));
  if (usable.some(e => e.kind === 'client_id' && e.value === app.clientId)) return true;

  const hosts = new Set(usable.filter(e => e.kind === 'redirect_host').map(e => e.value));
  if (app.redirectUris.length === 0 || hosts.size === 0) return false;
  return app.redirectUris.every(uri => {
    const host = redirectHost(uri);
    return host !== null && hosts.has(host);
  });
}

const HOST_NAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/;
const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;

/**
 * A host typed in the admin page ("chatgpt.com", "https://chatgpt.com/cb",
 * "host:443") as stored: the lowercase host name alone. null when it isn't a
 * host name (no wildcards, no single-label names except localhost).
 */
export function normalizeAllowedHost(input: string): string | null {
  const text = input.trim().toLowerCase();
  if (!text || /\s/.test(text)) return null;
  let host: string;
  try {
    host = new URL(text.includes('://') ? text : `http://${text}`).hostname;
  } catch {
    return null;
  }
  if (host === 'localhost') return host;
  // The only IP worth allowing is loopback (desktop apps on the player's own
  // machine). A public or LAN IP would approve whoever controls that address.
  if (IPV4.test(host)) return host === '127.0.0.1' ? host : null;
  return HOST_NAME.test(host) ? host : null;
}

/** What an app not on the allow-list is told (approval link, refresh, partner API). */
export const APP_NOT_APPROVED = 'This app is not approved to connect to FaB Bazaar';
