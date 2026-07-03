// Auth primitives — no database, no framework. Sessions and pairing tokens
// are HMAC-signed self-contained values; identity comes from fabbazaar's
// OAuth server, this service only proves "same bytes we issued, not expired".
import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

function hmac(body, secret) {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

function safeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function sign(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${hmac(body, secret)}`;
}

function verify(token, secret) {
  if (typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!safeEqual(sig, hmac(body, secret))) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch {
    return null;
  }
  if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
  return payload;
}

export function signSession(user, secret, ttlMs) {
  return sign({ ...user, exp: Date.now() + ttlMs }, secret);
}

export function verifySession(token, secret) {
  return verify(token, secret);
}

export function makePairingToken({ roomId, side, userId }, secret, ttlMs) {
  return sign({ t: 'pair', roomId, side, userId, exp: Date.now() + ttlMs }, secret);
}

export function verifyPairingToken(token, roomId, secret) {
  const payload = verify(token, secret);
  if (!payload || payload.t !== 'pair' || payload.roomId !== roomId) return null;
  return payload;
}

export function pkcePair() {
  const verifier = randomBytes(48).toString('base64url'); // 64 chars
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}
