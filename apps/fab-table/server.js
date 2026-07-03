// fab-table server — webcam play companion for FaB Bazaar.
// Crash-only, framework-free: static pages + an event relay (POST + SSE) +
// fabbazaar OAuth. Rooms live in memory (bounded, TTL-swept); the process is
// safe to kill at any moment — sessions are signed cookies, video is P2P.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createLogger } from './lib/log.js';
import { createRooms, RoomError } from './lib/rooms.js';
import { createRateLimiter } from './lib/ratelimit.js';
import {
  signSession,
  verifySession,
  makePairingToken,
  verifyPairingToken,
  pkcePair,
} from './lib/auth.js';

// --- Config ------------------------------------------------------------------
const {
  PORT = 8787,
  PUBLIC_URL = `http://localhost:${PORT}`,
  FABBAZAAR_URL = 'https://fabbazaar.app',
  OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET,
  SESSION_SECRET,
  DEBUG,
} = process.env;

const BUILD = process.env.BUILD_SHA || 'dev';
const log = createLogger({ name: 'fab-table', debug: DEBUG === '1' });

if (!SESSION_SECRET) {
  log.error('SESSION_SECRET is required (any long random string)', {});
  process.exit(1);
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PAIRING_TTL_MS = 4 * 60 * 60 * 1000; // matches room TTL; camera reuses it all game

const rooms = createRooms({ log });
const eventLimiter = createRateLimiter({ capacity: 30, refillPerSec: 10 });
const authLimiter = createRateLimiter({ capacity: 10, refillPerSec: 0.2 });

setInterval(() => rooms.sweep(), 60_000).unref();
setInterval(() => { eventLimiter.prune(); authLimiter.prune(); }, 300_000).unref();

// --- Verbose-by-default error surface -----------------------------------------
class HttpError extends Error {
  constructor(status, code, message, context = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.context = context;
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function sendError(res, requestId, err) {
  const status = err.status || (err instanceof RoomError ? 404 : 500);
  const body = {
    error: err.message,
    code: err.code || 'INTERNAL',
    requestId,
    // Context is intentionally verbose: enough for an agent reading the
    // response (or the matching log line by requestId) to diagnose.
    ...(err.context ? { context: err.context } : {}),
  };
  if (status >= 500) log.error('request failed', { requestId, err });
  else log.warn('request rejected', { requestId, status, code: body.code, context: err.context });
  sendJson(res, status, body);
}

// --- Small helpers -------------------------------------------------------------
function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

function setCookie(res, name, value, { maxAgeS, httpOnly = true } = {}) {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'SameSite=Lax',
    ...(PUBLIC_URL.startsWith('https') ? ['Secure'] : []),
    ...(httpOnly ? ['HttpOnly'] : []),
    ...(maxAgeS ? [`Max-Age=${maxAgeS}`] : []),
  ];
  const prev = res.getHeader('Set-Cookie') || [];
  res.setHeader('Set-Cookie', [...(Array.isArray(prev) ? prev : [prev]), attrs.join('; ')]);
}

function requireSession(req) {
  const session = verifySession(parseCookies(req).ft_session, SESSION_SECRET);
  if (!session) {
    throw new HttpError(401, 'NOT_SIGNED_IN', 'Sign in with FaB Bazaar to continue', {
      loginUrl: '/auth/login',
    });
  }
  return session;
}

// Camera devices authenticate with a pairing token instead of a session
function identify(req, url, roomId) {
  const pairToken = url.searchParams.get('pair');
  if (pairToken) {
    const pair = verifyPairingToken(pairToken, roomId, SESSION_SECRET);
    if (!pair) {
      throw new HttpError(401, 'BAD_PAIRING_TOKEN', 'Pairing token invalid or expired — rescan the QR on the table page', { roomId });
    }
    return { userId: pair.userId, side: pair.side, via: 'pairing' };
  }
  const session = requireSession(req);
  const side = rooms.memberSide(roomId, session.userId);
  if (!side) {
    throw new HttpError(403, 'NOT_A_MEMBER', 'You are not seated at this table', {
      roomId,
      userId: session.userId,
    });
  }
  return { userId: session.userId, side, via: 'session' };
}

async function readBody(req, limit = 16 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'BODY_TOO_LARGE', `Request body exceeded ${limit} bytes`, { size });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString() || '{}');
  } catch (e) {
    throw new HttpError(400, 'BAD_JSON', 'Request body is not valid JSON', { detail: String(e) });
  }
}

// --- Printing metadata proxy (fabbazaar is the source of truth) ----------------
const printingCache = new Map(); // pid -> {ok, body} — identity is immutable
const PRINTING_CACHE_MAX = 5000;

async function fetchPrinting(pid) {
  if (printingCache.has(pid)) return printingCache.get(pid);
  const res = await fetch(`${FABBAZAAR_URL}/api/printings/${pid}`);
  const body = await res.json().catch(() => null);
  const entry = { status: res.status, body };
  if (res.status === 200 || res.status === 404) {
    if (printingCache.size >= PRINTING_CACHE_MAX) {
      printingCache.delete(printingCache.keys().next().value); // FIFO evict
    }
    printingCache.set(pid, entry);
  }
  return entry;
}

// --- Static files ---------------------------------------------------------------
const PUBLIC_DIR = new URL('./public/', import.meta.url).pathname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function serveFile(res, relPath, status = 200) {
  const safe = normalize(relPath).replace(/^(\.\.[/\\])+/, '');
  const full = join(PUBLIC_DIR, safe);
  if (!existsSync(full)) return false;
  res.writeHead(status, {
    'Content-Type': MIME[extname(full)] || 'application/octet-stream',
    'Cache-Control': 'no-store', // pages iterate; wasm/js are small
  });
  res.end(readFileSync(full));
  return true;
}

// --- OAuth (fabbazaar is the identity provider) ----------------------------------
function authLogin(req, res, url) {
  const ip = req.socket.remoteAddress || 'unknown';
  const gate = authLimiter.take(`login:${ip}`);
  if (!gate.ok) throw new HttpError(429, 'RATE_LIMITED', 'Too many login attempts', { retryAfterMs: gate.retryAfterMs });

  const { verifier, challenge } = pkcePair();
  const state = randomBytes(16).toString('base64url');
  const next = url.searchParams.get('next') || '/';
  setCookie(res, 'ft_oauth', JSON.stringify({ verifier, state, next }), { maxAgeS: 600 });

  const authorize = new URL('/oauth/authorize', FABBAZAAR_URL);
  authorize.searchParams.set('client_id', OAUTH_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', `${PUBLIC_URL}/auth/callback`);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', 'read');
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('code_challenge', challenge);
  authorize.searchParams.set('code_challenge_method', 'S256');
  res.writeHead(302, { Location: authorize.toString() });
  res.end();
}

async function authCallback(req, res, url, requestId) {
  const stash = JSON.parse(parseCookies(req).ft_oauth || 'null');
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  if (!stash || !code || state !== stash.state) {
    throw new HttpError(400, 'OAUTH_STATE_MISMATCH', 'Login flow state did not match — start again from /auth/login', {
      haveStash: !!stash,
      haveCode: !!code,
    });
  }

  const tokenRes = await fetch(new URL('/oauth/token', FABBAZAAR_URL), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET,
      code_verifier: stash.verifier,
      redirect_uri: `${PUBLIC_URL}/auth/callback`,
    }),
  });
  const token = await tokenRes.json().catch(() => null);
  if (!tokenRes.ok || !token?.access_token) {
    throw new HttpError(500, 'TOKEN_EXCHANGE_FAILED', 'fabbazaar rejected the code exchange', {
      status: tokenRes.status,
      response: token,
    });
  }

  const meRes = await fetch(new URL('/api/users/me', FABBAZAAR_URL), {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const me = await meRes.json().catch(() => null);
  if (!meRes.ok || !me?.data?.userId) {
    throw new HttpError(500, 'IDENTITY_LOOKUP_FAILED', 'Could not resolve token to a fabbazaar user', {
      status: meRes.status,
      response: me,
    });
  }

  const session = signSession(
    { userId: me.data.userId, username: me.data.displayUsername || me.data.username },
    SESSION_SECRET,
    SESSION_TTL_MS
  );
  setCookie(res, 'ft_session', session, { maxAgeS: SESSION_TTL_MS / 1000 });
  setCookie(res, 'ft_oauth', '', { maxAgeS: 0 });
  log.info('user signed in', { requestId, userId: me.data.userId });
  res.writeHead(302, { Location: stash.next || '/' });
  res.end();
}

// --- Router -----------------------------------------------------------------------
const started = Date.now();

const server = createServer(async (req, res) => {
  const requestId = randomBytes(6).toString('base64url');
  const url = new URL(req.url, PUBLIC_URL);
  const path = url.pathname;
  log.debug('request', { requestId, method: req.method, path });

  try {
    // Health & meta
    if (path === '/healthz') {
      return sendJson(res, 200, {
        ok: true,
        build: BUILD,
        uptimeS: Math.round((Date.now() - started) / 1000),
        rooms: rooms.stats().rooms,
        rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      });
    }

    // Auth
    if (path === '/auth/login') return authLogin(req, res, url);
    if (path === '/auth/callback') return await authCallback(req, res, url, requestId);
    if (path === '/auth/logout') {
      setCookie(res, 'ft_session', '', { maxAgeS: 0 });
      res.writeHead(302, { Location: '/' });
      return res.end();
    }
    if (path === '/api/whoami') {
      const session = verifySession(parseCookies(req).ft_session, SESSION_SECRET);
      return sendJson(res, 200, { signedIn: !!session, ...(session ? { username: session.username } : {}) });
    }

    // Rooms
    if (path === '/api/rooms' && req.method === 'POST') {
      const session = requireSession(req);
      const { id, side } = rooms.create(session.userId);
      return sendJson(res, 200, { success: true, data: { roomId: id, side } });
    }

    let m;
    if ((m = path.match(/^\/api\/rooms\/([\w-]+)\/join$/)) && req.method === 'POST') {
      const session = requireSession(req);
      const { side } = rooms.join(m[1], session.userId);
      return sendJson(res, 200, { success: true, data: { side } });
    }

    if ((m = path.match(/^\/api\/rooms\/([\w-]+)\/pair$/)) && req.method === 'GET') {
      const session = requireSession(req);
      const side = rooms.memberSide(m[1], session.userId);
      if (!side) throw new HttpError(403, 'NOT_A_MEMBER', 'Join the table before pairing a camera', { roomId: m[1] });
      const token = makePairingToken({ roomId: m[1], side, userId: session.userId }, SESSION_SECRET, PAIRING_TTL_MS);
      const camUrl = `${PUBLIC_URL}/r/${m[1]}/cam?pair=${encodeURIComponent(token)}`;
      return sendJson(res, 200, { success: true, data: { camUrl, expiresInS: PAIRING_TTL_MS / 1000 } });
    }

    if ((m = path.match(/^\/api\/rooms\/([\w-]+)\/events$/)) && req.method === 'POST') {
      const who = identify(req, url, m[1]);
      const gate = eventLimiter.take(`${m[1]}:${who.userId}`);
      if (!gate.ok) {
        throw new HttpError(429, 'RATE_LIMITED', 'Event rate exceeded for this table', {
          retryAfterMs: gate.retryAfterMs,
          roomId: m[1],
          userId: who.userId,
        });
      }
      const event = await readBody(req);
      event.side = who.side; // side is server-assigned, never client-claimed
      rooms.append(m[1], event);
      return sendJson(res, 200, { success: true });
    }

    // Diagnostic dump: the room's bounded event buffer + snapshot. Member-only.
    if ((m = path.match(/^\/api\/rooms\/([\w-]+)\/dump$/)) && req.method === 'GET') {
      identify(req, url, m[1]);
      return sendJson(res, 200, {
        success: true,
        data: { events: rooms.dump(m[1]), snapshot: rooms.snapshot(m[1]) },
      });
    }

    if ((m = path.match(/^\/api\/rooms\/([\w-]+)\/stream$/)) && req.method === 'GET') {
      const who = identify(req, url, m[1]);
      // Resolve the replay BEFORE committing a 200: rooms are in-memory, so a
      // deploy wipes them — a swept/never-existed room must be a clean 404 the
      // EventSource client can react to, not a stream that dies mid-handshake
      // and silently retries forever.
      const replay = rooms.snapshot(m[1]);
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
      });
      res.write(`data: ${JSON.stringify({ type: 'welcome', side: who.side, build: BUILD })}\n\n`);
      for (const ev of replay) res.write(`data: ${JSON.stringify(ev)}\n\n`);
      const unsub = rooms.subscribe(m[1], (ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`));
      const ping = setInterval(() => res.write(': ping\n\n'), 15_000);
      req.on('close', () => { unsub(); clearInterval(ping); });
      return; // connection stays open
    }

    // Printing metadata proxy
    if ((m = path.match(/^\/api\/printing\/([A-Za-z0-9_-]{21})$/)) && req.method === 'GET') {
      const entry = await fetchPrinting(m[1]);
      return sendJson(res, entry.status, entry.body ?? { error: 'Upstream returned no body' });
    }

    // Pages
    if (path === '/' && serveFile(res, 'index.html')) return;
    if (/^\/r\/[\w-]+(\/cam)?$/.test(path) && serveFile(res, 'table.html')) return;
    if (serveFile(res, path.slice(1))) return;

    throw new HttpError(404, 'NOT_FOUND', `No route for ${req.method} ${path}`, {});
  } catch (err) {
    if (!res.headersSent) sendError(res, requestId, err);
    else {
      log.error('error after headers sent', { requestId, path, err });
      res.end();
    }
  }
});

// Crash loudly and verbosely — the container restarts us; silent zombie
// states are worse than a clean death.
process.on('unhandledRejection', (err) => {
  log.error('unhandledRejection — exiting for clean restart', { err });
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  log.error('uncaughtException — exiting for clean restart', { err });
  process.exit(1);
});

server.listen(Number(PORT), () => {
  log.info('fab-table listening', { port: Number(PORT), build: BUILD, publicUrl: PUBLIC_URL, fabbazaar: FABBAZAAR_URL });
});
