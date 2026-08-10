// lib/auth/safe-callback-url.ts
// Validates a post-login redirect target. Only same-app relative paths pass;
// anything else (absolute URLs, protocol-relative, backslash escapes, control
// characters, auth pages that would loop) returns undefined so callers fall
// back to the default landing flow. Pure and client-safe — no server imports.

const AUTH_PAGE_PATHS = ['/auth/login', '/auth/signup', '/auth/post-login', '/login', '/signup'];

// Whitespace, backslash, and ASCII control chars (incl. NUL) never belong in
// an app path.
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS = /[\s\\\x00-\x1f\x7f]/;

export function safeCallbackUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  if (!raw.startsWith('/')) return undefined;
  // "//host" is protocol-relative; browsers also treat "\" as "/" in URLs.
  if (raw.startsWith('//')) return undefined;
  if (UNSAFE_CHARS.test(raw)) return undefined;

  const path = raw.split(/[?#]/)[0];
  if (AUTH_PAGE_PATHS.some(p => path === p || path.startsWith(`${p}/`))) return undefined;

  return raw;
}
