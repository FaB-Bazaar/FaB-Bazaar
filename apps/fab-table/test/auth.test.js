// Auth primitives: HMAC-signed session cookies, one-time pairing tokens for
// camera devices, and PKCE helpers for the fabbazaar OAuth code flow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  signSession,
  verifySession,
  makePairingToken,
  verifyPairingToken,
  pkcePair,
} from '../lib/auth.js';

const SECRET = 'test-secret';

test('session round-trips through sign/verify', () => {
  const token = signSession({ userId: 'u1', username: 'eko' }, SECRET, 60_000);
  const out = verifySession(token, SECRET);
  assert.equal(out.userId, 'u1');
  assert.equal(out.username, 'eko');
});

test('tampered session is rejected', () => {
  const token = signSession({ userId: 'u1' }, SECRET, 60_000);
  const [body, sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ userId: 'admin', exp: Date.now() + 60_000 }))
    .toString('base64url');
  assert.equal(verifySession(`${forged}.${sig}`, SECRET), null);
  assert.equal(verifySession(`${body}.deadbeef`, SECRET), null);
});

test('expired session is rejected', () => {
  const token = signSession({ userId: 'u1' }, SECRET, -1);
  assert.equal(verifySession(token, SECRET), null);
});

test('session signed with another secret is rejected', () => {
  const token = signSession({ userId: 'u1' }, 'other-secret', 60_000);
  assert.equal(verifySession(token, SECRET), null);
});

test('pairing token binds room, side, and user', () => {
  const t = makePairingToken({ roomId: 'r1', side: '1', userId: 'u1' }, SECRET, 60_000);
  const ok = verifyPairingToken(t, 'r1', SECRET);
  assert.equal(ok.userId, 'u1');
  assert.equal(ok.side, '1');
  // Same token presented for a different room fails
  assert.equal(verifyPairingToken(t, 'r2', SECRET), null);
});

test('expired pairing token is rejected', () => {
  const t = makePairingToken({ roomId: 'r1', side: '1', userId: 'u1' }, SECRET, -1);
  assert.equal(verifyPairingToken(t, 'r1', SECRET), null);
});

test('pkcePair produces an S256 challenge of the verifier', () => {
  const { verifier, challenge } = pkcePair();
  assert.ok(verifier.length >= 43); // RFC 7636 minimum
  const expected = createHash('sha256').update(verifier).digest('base64url');
  assert.equal(challenge, expected);
  // Two pairs are independent
  assert.notEqual(pkcePair().verifier, verifier);
});
