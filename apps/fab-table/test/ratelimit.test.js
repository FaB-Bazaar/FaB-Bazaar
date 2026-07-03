// Token-bucket rate limiter: per-key, refills over time, injectable clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../lib/ratelimit.js';

function make(opts = {}) {
  let t = 0;
  const clock = { now: () => t, advance: (ms) => { t += ms; } };
  const rl = createRateLimiter({ capacity: 10, refillPerSec: 5, now: clock.now, ...opts });
  return { rl, clock };
}

test('allows a burst up to capacity then rejects with retry context', () => {
  const { rl } = make();
  for (let i = 0; i < 10; i++) assert.equal(rl.take('u1').ok, true);
  const denied = rl.take('u1');
  assert.equal(denied.ok, false);
  assert.ok(denied.retryAfterMs > 0); // caller can build a verbose 429
});

test('tokens refill over time', () => {
  const { rl, clock } = make();
  for (let i = 0; i < 10; i++) rl.take('u1');
  assert.equal(rl.take('u1').ok, false);
  clock.advance(1000); // 5 tokens back
  for (let i = 0; i < 5; i++) assert.equal(rl.take('u1').ok, true);
  assert.equal(rl.take('u1').ok, false);
});

test('keys are independent', () => {
  const { rl } = make();
  for (let i = 0; i < 10; i++) rl.take('u1');
  assert.equal(rl.take('u1').ok, false);
  assert.equal(rl.take('u2').ok, true);
});

test('idle buckets are pruned to bound memory', () => {
  const { rl, clock } = make();
  for (let i = 0; i < 1000; i++) rl.take(`user-${i}`);
  clock.advance(10 * 60 * 1000);
  rl.prune();
  assert.equal(rl.size(), 0);
});
