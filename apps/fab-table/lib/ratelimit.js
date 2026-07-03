// Token-bucket rate limiter. Denials return retryAfterMs so callers can emit
// verbose 429s ("retry in Nms") instead of bare rejections.
export function createRateLimiter({ capacity = 30, refillPerSec = 10, now = Date.now } = {}) {
  const buckets = new Map(); // key -> { tokens, updatedAt }

  function refill(bucket) {
    const elapsed = now() - bucket.updatedAt;
    if (elapsed > 0) {
      bucket.tokens = Math.min(capacity, bucket.tokens + (elapsed / 1000) * refillPerSec);
      bucket.updatedAt = now();
    }
  }

  return {
    take(key) {
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { tokens: capacity, updatedAt: now() };
        buckets.set(key, bucket);
      }
      refill(bucket);
      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return { ok: true };
      }
      const retryAfterMs = Math.ceil(((1 - bucket.tokens) / refillPerSec) * 1000);
      return { ok: false, retryAfterMs };
    },

    prune(idleMs = 5 * 60 * 1000) {
      for (const [key, bucket] of buckets) {
        if (now() - bucket.updatedAt > idleMs) buckets.delete(key);
      }
    },

    size() {
      return buckets.size;
    },
  };
}
