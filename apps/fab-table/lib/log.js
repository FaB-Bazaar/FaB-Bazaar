// Structured logger: one JSON object per line to stdout (docker logs).
// Design rule for this service: errors are VERBOSE — full stacks, cause
// chains, and enough context (roomId, userId, event type) that a diagnosing
// agent can reconstruct what happened from logs alone.

function serializeError(err) {
  if (!(err instanceof Error)) return err;
  return {
    message: err.message,
    stack: err.stack,
    ...(err.code ? { code: err.code } : {}),
    ...(err.cause ? { cause: serializeError(err.cause) } : {}),
  };
}

function serializeContext(context) {
  const out = {};
  for (const [k, v] of Object.entries(context || {})) {
    out[k] = v instanceof Error ? serializeError(v) : v;
  }
  return out;
}

export function createLogger({ write = (s) => process.stdout.write(s + '\n'), name, debug = false } = {}) {
  function emit(level, msg, context) {
    const entry = { ts: new Date().toISOString(), level, name, msg, ...serializeContext(context) };
    let line;
    try {
      line = JSON.stringify(entry);
    } catch (e) {
      // Never lose a log line to a serialization problem — flag it instead
      line = JSON.stringify({
        ts: entry.ts,
        level,
        name,
        msg,
        serializationError: String(e),
      });
    }
    write(line);
  }
  return {
    debug: (msg, ctx) => { if (debug) emit('debug', msg, ctx); },
    info: (msg, ctx) => emit('info', msg, ctx),
    warn: (msg, ctx) => emit('warn', msg, ctx),
    error: (msg, ctx) => emit('error', msg, ctx),
  };
}
