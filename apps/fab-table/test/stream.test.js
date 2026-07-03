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
import { tmpdir } from 'node:os';
import { existsSync, rmSync } from 'node:fs';
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

function sessionFor(userId, extra = {}) {
  return `ft_session=${encodeURIComponent(signSession({ userId, username: userId, ...extra }, SECRET, 60_000))}`;
}

test('presence: both seats reach the snapshot as a display name — never the userId', async () => {
  const create = await fetch(`${BASE}/api/rooms`, {
    method: 'POST',
    headers: { cookie: sessionFor('alice-id', { username: 'Alice' }) },
  }).then((r) => r.json());
  const roomId = create.data.roomId;

  await fetch(`${BASE}/api/rooms/${roomId}/join`, {
    method: 'POST',
    headers: { cookie: sessionFor('bob-id', { username: 'Bob' }) },
  });

  // The member-only dump is the most a seated client can read back.
  const dump = await fetch(`${BASE}/api/rooms/${roomId}/dump`, {
    method: 'GET', headers: { cookie: sessionFor('alice-id', { username: 'Alice' }) },
  });
  assert.equal(dump.status, 200);
  const { data } = await dump.json();
  const presence = data.snapshot.filter((e) => e.type === 'presence');

  assert.deepEqual(
    presence.sort((a, b) => a.seat.localeCompare(b.seat)),
    [
      { type: 'presence', seat: '1', username: 'Alice' },
      { type: 'presence', seat: '2', username: 'Bob' },
    ]
  );
  // Security boundary: the internal userId must not appear anywhere a client can read.
  const wire = JSON.stringify(data);
  assert.ok(!wire.includes('alice-id') && !wire.includes('bob-id'), 'userId leaked to a client');
});

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

// --- Deploy survival: a graceful restart (SIGTERM) must not drop live games.
// The process flushes room state to disk on shutdown and reloads it on boot, so
// every device just reconnects and replays — the game "freezes" for a beat.
async function bootServer(port, extraEnv) {
  const child = spawn('node', [join(ROOT, 'server.js')], {
    env: { ...process.env, PORT: String(port), SESSION_SECRET: SECRET, ...extraEnv },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try { await fetch(`http://localhost:${port}/api/whoami`); return child; }
    catch { await sleep(100); }
  }
  child.kill();
  throw new Error('server did not start');
}
function waitExit(child) {
  return new Promise((resolve) => child.once('exit', resolve));
}

test('a graceful restart preserves live rooms — game survives a deploy', async () => {
  const port = 18820;
  const base = `http://localhost:${port}`;
  const snapPath = join(tmpdir(), `fab-table-rooms-${port}-${process.pid}.json`);
  rmSync(snapPath, { force: true });
  const env = { ROOMS_SNAPSHOT_PATH: snapPath };

  try {
    // --- Before the deploy: a table mid-game, hero locked and life adjusted.
    let child = await bootServer(port, env);
    const create = await fetch(`${base}/api/rooms`, {
      method: 'POST', headers: { cookie: sessionFor('alice-id', { username: 'Alice' }) },
    }).then((r) => r.json());
    const roomId = create.data.roomId;
    await fetch(`${base}/api/rooms/${roomId}/join`, {
      method: 'POST', headers: { cookie: sessionFor('bob-id', { username: 'Bob' }) },
    });
    const post = (body, who) => fetch(`${base}/api/rooms/${roomId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: sessionFor(who) },
      body: JSON.stringify(body),
    });
    await post({ type: 'hero', pid: 'h'.repeat(21) }, 'alice-id');
    await post({ type: 'life', seat: '1', value: 33 }, 'alice-id');

    // --- The deploy: SIGTERM the old container, wait for it to flush and exit.
    child.kill('SIGTERM');
    await waitExit(child);
    assert.ok(existsSync(snapPath), 'shutdown should have written the rooms snapshot');

    // --- After the deploy: a fresh process on the same volume.
    child = await bootServer(port, env);

    // A reconnecting client authenticates (seats restored) and replays state.
    const dump = await fetch(`${base}/api/rooms/${roomId}/dump`, {
      headers: { cookie: sessionFor('alice-id', { username: 'Alice' }) },
    });
    assert.equal(dump.status, 200, 'the room survived the restart');
    const { data } = await dump.json();
    const snap = data.snapshot;
    assert.equal(snap.find((e) => e.type === 'hero')?.pid, 'h'.repeat(21), 'hero replayed');
    assert.equal(snap.find((e) => e.type === 'life' && e.seat === '1')?.value, 33, 'life replayed');
    assert.deepEqual(
      snap.filter((e) => e.type === 'presence').map((e) => e.seat).sort(),
      ['1', '2'],
      'both players still seated'
    );
    child.kill();
    await waitExit(child);
  } finally {
    rmSync(snapPath, { force: true });
  }
});
