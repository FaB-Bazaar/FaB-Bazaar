// Room-gone must be a clean, pre-header 404 on the SSE stream — not a 200
// that dies mid-handshake. Rooms are in-memory, so every deploy wipes them;
// clients left over from before a restart need a definitive status code to
// tell "table expired" apart from a network blip (EventSource retries a
// dropped 200 forever, silently).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makePairingToken } from '../lib/auth.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SECRET = 'stream-test-secret';
const PORT = 18787;
const BASE = `http://localhost:${PORT}`;

let child;

before(async () => {
  child = spawn('node', [join(ROOT, 'server.js')], {
    env: { ...process.env, PORT: String(PORT), SESSION_SECRET: SECRET },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`${BASE}/api/whoami`);
      return;
    } catch {
      await sleep(100);
    }
  }
  throw new Error('server did not start');
});

after(() => child?.kill());

function pairFor(roomId) {
  return makePairingToken({ roomId, side: '1', userId: 'u1' }, SECRET, 60_000);
}

test('stream for a gone room is a clean 404 (camera / pairing auth)', async () => {
  const roomId = 'gone-after-restart';
  const res = await fetch(
    `${BASE}/api/rooms/${roomId}/stream?pair=${encodeURIComponent(pairFor(roomId))}`
  );
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.code, 'ROOM_NOT_FOUND');
});

test('event publish to a gone room reports ROOM_NOT_FOUND (client reacts to this)', async () => {
  const roomId = 'gone-after-restart';
  const res = await fetch(
    `${BASE}/api/rooms/${roomId}/events?pair=${encodeURIComponent(pairFor(roomId))}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cid: 'c1', type: 'card', pid: 'x'.repeat(21) }),
    }
  );
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.code, 'ROOM_NOT_FOUND');
});

// --- Close room: explicit teardown so abandoned tables don't wait out the TTL
import { signSession } from '../lib/auth.js';

function sessionFor(userId) {
  return `ft_session=${encodeURIComponent(signSession({ userId, username: userId }, SECRET, 60_000))}`;
}

test('DELETE room: member closes it, subsequent join is ROOM_NOT_FOUND', async () => {
  const create = await fetch(`${BASE}/api/rooms`, {
    method: 'POST', headers: { cookie: sessionFor('owner') },
  }).then((r) => r.json());
  const roomId = create.data.roomId;

  // A signed-in non-member cannot close someone else's table
  const forbidden = await fetch(`${BASE}/api/rooms/${roomId}`, {
    method: 'DELETE', headers: { cookie: sessionFor('stranger') },
  });
  assert.equal(forbidden.status, 403);

  const closed = await fetch(`${BASE}/api/rooms/${roomId}`, {
    method: 'DELETE', headers: { cookie: sessionFor('owner') },
  });
  assert.equal(closed.status, 200);

  const rejoin = await fetch(`${BASE}/api/rooms/${roomId}/join`, {
    method: 'POST', headers: { cookie: sessionFor('owner') },
  });
  assert.equal(rejoin.status, 404);
});
