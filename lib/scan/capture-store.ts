// lib/scan/capture-store.ts — keeps recent scan PHOTOS for rollout diagnostics.
// Photos taken through the page's camera input never reach the phone's camera
// roll, so a failed scan is otherwise unrecoverable. Originals are kept per
// user with a short TTL (superadmin-only rollout; see identify route), and
// fetched through /api/admin/scan/captures for tuning the detector.
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

export const CAPTURE_TTL_SEC = 24 * 60 * 60;
/** A labelled capture is ground truth for the real-photo eval — keep it longer. */
export const LABELLED_TTL_SEC = 7 * 24 * 60 * 60;
export const CAPTURE_KEEP = 30;

export interface CaptureOutcome {
  cardsFound: number;
  topName: string | null;
  bestDistance: number | null;
}
export interface CaptureLabel {
  printingId: string;
  cardName: string;
  /** 'corrected' = the user picked a different card; 'accepted' = the user added the suggested card as-is. */
  source: 'corrected' | 'accepted';
  at: number;
}
export interface CaptureMeta {
  id: string;
  createdAt: number;
  contentType: string;
  bytes: number;
  outcome: CaptureOutcome;
  label?: CaptureLabel;
}
export interface ScanCaptureStore {
  save(userId: string, data: Buffer | Uint8Array, contentType: string, outcome: CaptureOutcome, opts?: { keep?: number }): Promise<CaptureMeta>;
  list(userId: string): Promise<CaptureMeta[]>;
  get(userId: string, id: string): Promise<{ contentType: string; data: Uint8Array } | null>;
  /** Attach the true printing to a capture (scoped to its owner). false = unknown/expired. */
  label(userId: string, id: string, label: Omit<CaptureLabel, 'at'>): Promise<boolean>;
}

export class MemoryScanCaptureStore implements ScanCaptureStore {
  private byUser = new Map<string, Array<CaptureMeta & { data: Uint8Array }>>();
  async save(userId: string, data: Buffer | Uint8Array, contentType: string, outcome: CaptureOutcome, opts: { keep?: number } = {}) {
    const meta: CaptureMeta = { id: randomUUID(), createdAt: Date.now(), contentType, bytes: data.length, outcome };
    const arr = this.byUser.get(userId) ?? [];
    arr.unshift({ ...meta, data: new Uint8Array(data) });
    arr.splice(opts.keep ?? CAPTURE_KEEP);
    this.byUser.set(userId, arr);
    return meta;
  }
  async list(userId: string) {
    return (this.byUser.get(userId) ?? []).map(({ data: _d, ...meta }) => meta);
  }
  async get(userId: string, id: string) {
    const hit = (this.byUser.get(userId) ?? []).find(c => c.id === id);
    return hit ? { contentType: hit.contentType, data: hit.data } : null;
  }
  async label(userId: string, id: string, label: Omit<CaptureLabel, 'at'>) {
    const hit = (this.byUser.get(userId) ?? []).find(c => c.id === id);
    if (!hit) return false;
    hit.label = { ...label, at: Date.now() };
    return true;
  }
}

const listKey = (u: string) => `scan:capture:${u}:list`;
const metaKey = (u: string, id: string) => `scan:capture:${u}:${id}:meta`;
const dataKey = (u: string, id: string) => `scan:capture:${u}:${id}:data`;

export class RedisScanCaptureStore implements ScanCaptureStore {
  private redis: Redis;
  constructor(urlOrClient: string | Redis) {
    this.redis = typeof urlOrClient === 'string' ? new Redis(urlOrClient, { maxRetriesPerRequest: 1, lazyConnect: true }) : urlOrClient;
    this.redis.on('error', () => { /* surfaced by the failing command */ });
  }
  async ping() { return this.redis.ping(); }
  async close() { await this.redis.quit().catch(() => undefined); }

  async save(userId: string, data: Buffer | Uint8Array, contentType: string, outcome: CaptureOutcome, opts: { keep?: number } = {}) {
    const meta: CaptureMeta = { id: randomUUID(), createdAt: Date.now(), contentType, bytes: data.length, outcome };
    const keep = opts.keep ?? CAPTURE_KEEP;
    await this.redis.set(metaKey(userId, meta.id), JSON.stringify(meta), 'EX', CAPTURE_TTL_SEC);
    await this.redis.set(dataKey(userId, meta.id), Buffer.from(data), 'EX', CAPTURE_TTL_SEC);
    await this.redis.lpush(listKey(userId), meta.id);
    const evicted = await this.redis.lrange(listKey(userId), keep, -1);
    await this.redis.ltrim(listKey(userId), 0, keep - 1);
    await this.redis.expire(listKey(userId), CAPTURE_TTL_SEC);
    for (const id of evicted) await this.redis.del(metaKey(userId, id), dataKey(userId, id));
    return meta;
  }
  async list(userId: string) {
    const ids = await this.redis.lrange(listKey(userId), 0, -1);
    const out: CaptureMeta[] = [];
    for (const id of ids) {
      const raw = await this.redis.get(metaKey(userId, id));
      if (raw) out.push(JSON.parse(raw));
    }
    return out;
  }
  async get(userId: string, id: string) {
    const raw = await this.redis.get(metaKey(userId, id));
    if (!raw) return null;
    const data = await this.redis.getBuffer(dataKey(userId, id));
    if (!data) return null;
    return { contentType: (JSON.parse(raw) as CaptureMeta).contentType, data: new Uint8Array(data) };
  }
  async label(userId: string, id: string, label: Omit<CaptureLabel, 'at'>) {
    const raw = await this.redis.get(metaKey(userId, id));
    if (!raw) return false;
    const meta = JSON.parse(raw) as CaptureMeta;
    meta.label = { ...label, at: Date.now() };
    await this.redis.set(metaKey(userId, id), JSON.stringify(meta), 'EX', LABELLED_TTL_SEC);
    await this.redis.expire(dataKey(userId, id), LABELLED_TTL_SEC);
    return true;
  }
}

let singleton: ScanCaptureStore | null = null;
export function getScanCaptureStore(): ScanCaptureStore {
  if (!singleton) singleton = process.env.REDIS_URL ? new RedisScanCaptureStore(process.env.REDIS_URL) : new MemoryScanCaptureStore();
  return singleton;
}
