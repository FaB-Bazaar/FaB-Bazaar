// Room store contract: two-sided rooms, bounded event buffers, snapshot
// replay for late joiners, TTL sweeping, and typed verbose errors.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRooms, RoomError } from '../lib/rooms.js';

const silentLog = { debug() {}, info() {}, warn() {}, error() {} };

function make(opts = {}) {
  let t = 1_000_000;
  const clock = { now: () => t, advance: (ms) => { t += ms; } };
  const rooms = createRooms({ log: silentLog, now: clock.now, maxEvents: 50, roomTtlMs: 60_000, ...opts });
  return { rooms, clock };
}

test('creator gets side 1, second user side 2, third is rejected verbosely', () => {
  const { rooms } = make();
  const { id } = rooms.create('alice');
  assert.equal(rooms.join(id, 'alice').side, '1'); // rejoin is idempotent
  assert.equal(rooms.join(id, 'bob').side, '2');
  assert.equal(rooms.join(id, 'bob').side, '2');   // rejoin keeps side
  try {
    rooms.join(id, 'carol');
    assert.fail('expected ROOM_FULL');
  } catch (e) {
    assert.ok(e instanceof RoomError);
    assert.equal(e.code, 'ROOM_FULL');
    assert.equal(e.context.roomId, id);       // enough context to diagnose
    assert.deepEqual(e.context.members, { 1: 'alice', 2: 'bob' });
  }
});

test('unknown room raises ROOM_NOT_FOUND with the offending id', () => {
  const { rooms } = make();
  assert.throws(() => rooms.join('nope', 'u'), (e) => e.code === 'ROOM_NOT_FOUND' && e.context.roomId === 'nope');
  assert.throws(() => rooms.append('nope', { type: 'card' }), (e) => e.code === 'ROOM_NOT_FOUND');
});

test('append fans out to subscribers; unsubscribe stops delivery', () => {
  const { rooms } = make();
  const { id } = rooms.create('alice');
  const got = [];
  const unsub = rooms.subscribe(id, (ev) => got.push(ev));
  rooms.append(id, { type: 'card', pid: 'x' });
  assert.equal(got.length, 1);
  assert.equal(got[0].pid, 'x');
  unsub();
  rooms.append(id, { type: 'card', pid: 'y' });
  assert.equal(got.length, 1);
});

test('event buffer is bounded at maxEvents', () => {
  const { rooms } = make();
  const { id } = rooms.create('alice');
  for (let i = 0; i < 200; i++) rooms.append(id, { type: 'card', i });
  assert.ok(rooms.dump(id).length <= 50);
  assert.equal(rooms.dump(id).at(-1).i, 199); // newest kept
});

test('snapshot replays hero and latest life, and clears on newgame', () => {
  const { rooms } = make();
  const { id } = rooms.create('alice');
  rooms.append(id, { type: 'hero', pid: 'heroA', side: '1' });
  rooms.append(id, { type: 'life', side: 'me', value: 38 });
  rooms.append(id, { type: 'life', side: 'me', value: 35 });
  rooms.append(id, { type: 'card', pid: 'x', side: '1' }); // not part of snapshot
  const snap = rooms.snapshot(id);
  assert.deepEqual(
    snap.map((e) => e.type).sort(),
    ['hero', 'life']
  );
  assert.equal(snap.find((e) => e.type === 'life').value, 35); // latest only
  rooms.append(id, { type: 'newgame' });
  assert.deepEqual(rooms.snapshot(id), [{ type: 'newgame' }].filter(() => false).concat(rooms.snapshot(id)));
  assert.equal(rooms.snapshot(id).filter((e) => e.type !== 'newgame').length, 0);
});

test('life snapshot is keyed by seat and keeps only the latest per seat', () => {
  const { rooms } = make();
  const { id } = rooms.create('alice');
  rooms.append(id, { type: 'life', seat: '1', value: 39, side: '1' });
  rooms.append(id, { type: 'life', seat: '2', value: 40, side: '1' }); // sender adjusts opponent
  rooms.append(id, { type: 'life', seat: '1', value: 36, side: '1' });
  const lifeEvents = rooms.snapshot(id).filter((e) => e.type === 'life');
  assert.equal(lifeEvents.length, 2);
  assert.equal(lifeEvents.find((e) => e.seat === '1').value, 36);
  assert.equal(lifeEvents.find((e) => e.seat === '2').value, 40);
});

test('create records the owner presence (display name only) in the snapshot', () => {
  const { rooms } = make();
  const { id } = rooms.create('alice', { username: 'Alice' });
  const presence = rooms.snapshot(id).filter((e) => e.type === 'presence');
  assert.equal(presence.length, 1);
  assert.deepEqual(presence[0], { type: 'presence', seat: '1', username: 'Alice' });
});

test('join broadcasts seat-2 presence to open subscribers and adds it to the snapshot', () => {
  const { rooms } = make();
  const { id } = rooms.create('alice', { username: 'Alice' });
  const got = [];
  rooms.subscribe(id, (ev) => got.push(ev)); // seat 1 is already watching
  rooms.join(id, 'bob', { username: 'Bob' });

  const live = got.filter((e) => e.type === 'presence'); // pushed live to the seated opponent
  assert.equal(live.length, 1);
  assert.deepEqual(live[0], { type: 'presence', seat: '2', username: 'Bob' });

  // and replayable for late joiners / reconnects
  const snap = rooms.snapshot(id).filter((e) => e.type === 'presence');
  assert.deepEqual(snap.map((e) => e.seat).sort(), ['1', '2']);
});

test('an idempotent rejoin does not re-broadcast presence', () => {
  const { rooms } = make();
  const { id } = rooms.create('alice', { username: 'Alice' });
  rooms.join(id, 'bob', { username: 'Bob' });
  const got = [];
  rooms.subscribe(id, (ev) => got.push(ev));
  rooms.join(id, 'bob', { username: 'Bob' }); // rejoin, same seat
  assert.equal(got.filter((e) => e.type === 'presence').length, 0);
});

test('presence survives newgame (same players, fresh board)', () => {
  const { rooms } = make();
  const { id } = rooms.create('alice', { username: 'Alice' });
  rooms.join(id, 'bob', { username: 'Bob' });
  rooms.append(id, { type: 'hero', pid: 'heroA', side: '1' });
  rooms.append(id, { type: 'newgame' });
  const types = rooms.snapshot(id).map((e) => e.type).sort();
  assert.deepEqual(types, ['presence', 'presence']); // hero cleared, both presences kept
});

test('idle rooms are swept after TTL; active rooms survive', () => {
  const { rooms, clock } = make();
  const { id: idle } = rooms.create('alice');
  const { id: active } = rooms.create('bob');
  clock.advance(50_000);
  rooms.append(active, { type: 'life', side: 'me', value: 39 }); // touch
  clock.advance(20_000); // idle is now 70s old, active touched 20s ago
  const removed = rooms.sweep();
  assert.equal(removed, 1);
  assert.throws(() => rooms.join(idle, 'x'), (e) => e.code === 'ROOM_NOT_FOUND');
  assert.equal(rooms.join(active, 'bob').side, '1');
});

test('serialize captures room state without the live subscriber sockets', () => {
  const { rooms } = make();
  const { id } = rooms.create('alice', { username: 'Alice' });
  rooms.join(id, 'bob', { username: 'Bob' });
  rooms.append(id, { type: 'hero', pid: 'heroA', side: '1' });
  rooms.append(id, { type: 'life', seat: '1', value: 33, side: '1' });
  rooms.subscribe(id, () => {}); // a live SSE connection — must NOT be serialized

  const dumped = rooms.serialize();
  assert.deepEqual(Object.keys(dumped), [id]);
  const r = dumped[id];
  assert.deepEqual(r.members, { 1: 'alice', 2: 'bob' });
  assert.ok(!('subscribers' in r), 'subscriber sockets must not be serialized');
  assert.ok(JSON.stringify(r).length > 0); // fully JSON-serializable
});

test('a fresh store hydrated from a snapshot restores rooms (empty subscriber sets)', () => {
  const { rooms } = make();
  const { id } = rooms.create('alice', { username: 'Alice' });
  rooms.join(id, 'bob', { username: 'Bob' });
  rooms.append(id, { type: 'hero', pid: 'heroA', side: '1' });
  rooms.append(id, { type: 'life', seat: '1', value: 33, side: '1' });
  const snapshot = JSON.parse(JSON.stringify(rooms.serialize())); // survives a disk round-trip

  // A brand-new store, as if the process restarted and reloaded the file.
  const { rooms: reborn } = make({ initial: snapshot });

  // Seats survived, so a reconnecting client's stream still authenticates.
  assert.equal(reborn.memberSide(id, 'alice'), '1');
  assert.equal(reborn.memberSide(id, 'bob'), '2');

  // Game state replays for the reconnecting clients.
  const snap = reborn.snapshot(id);
  assert.equal(snap.find((e) => e.type === 'hero')?.pid, 'heroA');
  assert.equal(snap.find((e) => e.type === 'life' && e.seat === '1')?.value, 33);
  assert.deepEqual(
    reborn.snapshot(id).filter((e) => e.type === 'presence').map((e) => e.seat).sort(),
    ['1', '2']
  );

  // Subscribers start empty; new connections attach cleanly.
  const got = [];
  reborn.subscribe(id, (ev) => got.push(ev));
  reborn.append(id, { type: 'life', seat: '1', value: 30, side: '1' });
  assert.equal(got.length, 1);
});

test('hydrating with no snapshot is a clean empty store', () => {
  const { rooms } = make({ initial: undefined });
  assert.equal(rooms.stats().rooms, 0);
});

test('stats reports room count for health checks', () => {
  const { rooms } = make();
  rooms.create('a');
  rooms.create('b');
  assert.equal(rooms.stats().rooms, 2);
});

test('close notifies subscribers then deletes the room', () => {
  const { rooms } = make();
  const { id } = rooms.create('alice');
  const got = [];
  rooms.subscribe(id, (ev) => got.push(ev));
  rooms.close(id);
  assert.equal(got.length, 1);
  assert.equal(got[0].type, 'closed');
  assert.throws(() => rooms.join(id, 'alice'), (e) => e.code === 'ROOM_NOT_FOUND');
  assert.equal(rooms.stats().rooms, 0);
});

test('close on an unknown room raises ROOM_NOT_FOUND', () => {
  const { rooms } = make();
  assert.throws(() => rooms.close('nope'), (e) => e.code === 'ROOM_NOT_FOUND');
});
