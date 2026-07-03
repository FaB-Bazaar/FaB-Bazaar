// Logger contract: structured, verbose, machine-parseable. Every line is a
// JSON object with ts/level/msg/context so a diagnosing agent can grep and
// parse docker logs without guessing at formats.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLogger } from '../lib/log.js';

function capture() {
  const lines = [];
  return { lines, write: (s) => lines.push(s) };
}

test('emits parseable JSON with ts, level, msg, and context', () => {
  const out = capture();
  const log = createLogger({ write: out.write, name: 'test' });
  log.info('room created', { roomId: 'r1', userId: 'u1' });
  const entry = JSON.parse(out.lines[0]);
  assert.equal(entry.level, 'info');
  assert.equal(entry.msg, 'room created');
  assert.equal(entry.roomId, 'r1');
  assert.equal(entry.name, 'test');
  assert.ok(Number.isFinite(Date.parse(entry.ts)));
});

test('errors include stack traces and cause chains, never bare messages', () => {
  const out = capture();
  const log = createLogger({ write: out.write, name: 'test' });
  const inner = new Error('redis timeout');
  const outer = new Error('failed to append event', { cause: inner });
  log.error('event append failed', { roomId: 'r1', err: outer });
  const entry = JSON.parse(out.lines[0]);
  assert.equal(entry.level, 'error');
  assert.match(entry.err.message, /failed to append event/);
  assert.match(entry.err.stack, /log\.test\.js/); // real stack, not toString()
  assert.match(entry.err.cause.message, /redis timeout/);
});

test('debug lines are suppressed unless enabled, others always emit', () => {
  const out = capture();
  const quiet = createLogger({ write: out.write, name: 't', debug: false });
  quiet.debug('noisy detail', {});
  assert.equal(out.lines.length, 0);
  const loud = createLogger({ write: out.write, name: 't', debug: true });
  loud.debug('noisy detail', { x: 1 });
  assert.equal(JSON.parse(out.lines[0]).level, 'debug');
});

test('context that cannot serialize does not throw or lose the message', () => {
  const out = capture();
  const log = createLogger({ write: out.write, name: 't' });
  const circular = {};
  circular.self = circular;
  log.warn('odd payload', { circular });
  const entry = JSON.parse(out.lines[0]);
  assert.equal(entry.msg, 'odd payload');
  assert.ok(entry.serializationError || entry.circular); // survived, flagged
});
