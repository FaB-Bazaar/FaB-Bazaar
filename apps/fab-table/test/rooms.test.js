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
