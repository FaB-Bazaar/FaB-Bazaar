// lib/scan/session-store.ts — phone ↔ desktop scan sessions.
// The desktop creates a session (8-char code, shown as a QR); the signed-in
// phone opens /scan?pair=CODE, marks it paired, and every card it identifies
// is appended here and pushed to the desktop over SSE. Redis-backed in prod
// (pub/sub fan-out works across containers); in-memory fallback for dev/tests.
import Redis from 'ioredis';
import { randomInt } from 'node:crypto';
import type { ScanCandidate } from '@/lib/services/postgres/scan/PostgresScanService';
import type { PitchHint } from '@/lib/scan/image-hash';

export const SCAN_SESSION_TTL_SEC = 30 * 60;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const MAX_ITEMS = 500;

export interface ScanSessionRecord {
  code: string;
  userId: string;
  createdAt: number;
  pairedAt: number | null;
}

export interface ScanSessionItem {
  id: string;
  createdAt: number;
  /** Small JPEG data URL of the phone's photo, for the desktop preview. */
  thumb: string | null;
  candidates: ScanCandidate[];
  bestDistance: number | null;
  pitchHint: PitchHint | null;
  /** Capture id of the photo (for labelling on the desktop). */
  captureId?: string;
}

export interface ScanSessionSubscriber {
  onItem: (item: ScanSessionItem) => void;
  onPaired: () => void;
}

export interface ScanSessionStore {
  create(userId: string): Promise<ScanSessionRecord>;
  get(code: string): Promise<ScanSessionRecord | null>;
  markPaired(code: string): Promise<ScanSessionRecord | null>;
  appendItem(code: string, item: ScanSessionItem): Promise<void>;
  listItems(code: string): Promise<ScanSessionItem[]>;
  /** Live updates; resolves to an unsubscribe function. */
  subscribe(code: string, sub: ScanSessionSubscriber): Promise<() => Promise<void>>;
}

export function makeSessionCode(): string {
  let out = '';
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

export function isValidSessionCode(code: unknown): code is string {
  return typeof code === 'string' && /^[A-Z2-9]{8}$/.test(code);
}

type Event = { type: 'item'; item: ScanSessionItem } | { type: 'paired' };

// ─── In-memory ────────────────────────────────────────────────────────────

export class MemoryScanSessionStore implements ScanSessionStore {
  private sessions = new Map<string, { record: ScanSessionRecord; items: ScanSessionItem[]; expiresAt: number }>();
  private subs = new Map<string, Set<ScanSessionSubscriber>>();

  private live(code: string) {
    const s = this.sessions.get(code);
    if (!s) return null;
    if (s.expiresAt < Date.now()) { this.sessions.delete(code); return null; }
    s.expiresAt = Date.now() + SCAN_SESSION_TTL_SEC * 1000;
    return s;
  }

  async create(userId: string): Promise<ScanSessionRecord> {
    let code = makeSessionCode();
    while (this.sessions.has(code)) code = makeSessionCode();
    const record = { code, userId, createdAt: Date.now(), pairedAt: null };
    this.sessions.set(code, { record, items: [], expiresAt: Date.now() + SCAN_SESSION_TTL_SEC * 1000 });
    return { ...record };
  }

  async get(code: string) { const s = this.live(code); return s ? { ...s.record } : null; }

  async markPaired(code: string) {
    const s = this.live(code);
    if (!s) return null;
    if (s.record.pairedAt === null) {
      s.record.pairedAt = Date.now();
      this.emit(code, { type: 'paired' });
    }
    return { ...s.record };
  }

  async appendItem(code: string, item: ScanSessionItem) {
    const s = this.live(code);
    if (!s) return;
    s.items.push(item);
    if (s.items.length > MAX_ITEMS) s.items.shift();
    this.emit(code, { type: 'item', item });
  }

  async listItems(code: string) { return this.live(code)?.items.slice() ?? []; }

  async subscribe(code: string, sub: ScanSessionSubscriber) {
    let set = this.subs.get(code);
    if (!set) { set = new Set(); this.subs.set(code, set); }
    set.add(sub);
    return async () => { set!.delete(sub); if (set!.size === 0) this.subs.delete(code); };
  }

  private emit(code: string, ev: Event) {
    for (const sub of this.subs.get(code) ?? []) {
      if (ev.type === 'item') sub.onItem(ev.item); else sub.onPaired();
    }
  }
}

// ─── Redis ────────────────────────────────────────────────────────────────

const key = (code: string) => `scan:sess:${code}`;
const itemsKey = (code: string) => `scan:sess:${code}:items`;
const channel = (code: string) => `scan:sess:${code}:events`;

export class RedisScanSessionStore implements ScanSessionStore {
  private redis: Redis;
  private subscriber: Redis | null = null;
  private handlers = new Map<string, Set<ScanSessionSubscriber>>();

  constructor(urlOrClient: string | Redis) {
    this.redis = typeof urlOrClient === 'string'
      ? new Redis(urlOrClient, { maxRetriesPerRequest: 1, lazyConnect: true })
      : urlOrClient;
    this.redis.on('error', () => { /* surfaced by the failing command */ });
  }

  async ping() { return this.redis.ping(); }
  async close() { await this.subscriber?.quit().catch(() => undefined); await this.redis.quit().catch(() => undefined); }

  private async touch(code: string) {
    await this.redis.expire(key(code), SCAN_SESSION_TTL_SEC);
    await this.redis.expire(itemsKey(code), SCAN_SESSION_TTL_SEC);
  }

  async create(userId: string): Promise<ScanSessionRecord> {
    for (let i = 0; i < 5; i++) {
      const code = makeSessionCode();
      const record: ScanSessionRecord = { code, userId, createdAt: Date.now(), pairedAt: null };
      const ok = await this.redis.set(key(code), JSON.stringify(record), 'EX', SCAN_SESSION_TTL_SEC, 'NX');
      if (ok) return record;
    }
    throw new Error('could not allocate a scan session code');
  }

  async get(code: string) {
    const raw = await this.redis.get(key(code));
    if (!raw) return null;
    await this.touch(code);
    return JSON.parse(raw) as ScanSessionRecord;
  }

  async markPaired(code: string) {
    const rec = await this.get(code);
    if (!rec) return null;
    if (rec.pairedAt !== null) return rec;
    rec.pairedAt = Date.now();
    await this.redis.set(key(code), JSON.stringify(rec), 'EX', SCAN_SESSION_TTL_SEC);
    await this.redis.publish(channel(code), JSON.stringify({ type: 'paired' } satisfies Event));
    return rec;
  }

  async appendItem(code: string, item: ScanSessionItem) {
    if (!(await this.redis.exists(key(code)))) return;
    await this.redis.rpush(itemsKey(code), JSON.stringify(item));
    await this.redis.ltrim(itemsKey(code), -MAX_ITEMS, -1);
    await this.touch(code);
    await this.redis.publish(channel(code), JSON.stringify({ type: 'item', item } satisfies Event));
  }

  async listItems(code: string) {
    const raw = await this.redis.lrange(itemsKey(code), 0, -1);
    return raw.map(r => JSON.parse(r) as ScanSessionItem);
  }

  async subscribe(code: string, sub: ScanSessionSubscriber) {
    if (!this.subscriber) {
      this.subscriber = this.redis.duplicate();
      this.subscriber.on('error', () => { /* reconnects */ });
      this.subscriber.on('message', (ch: string, msg: string) => {
        const set = this.handlers.get(ch);
        if (!set) return;
        let ev: Event;
        try { ev = JSON.parse(msg); } catch { return; }
        for (const s of set) { if (ev.type === 'item') s.onItem(ev.item); else s.onPaired(); }
      });
    }
    const ch = channel(code);
    let set = this.handlers.get(ch);
    if (!set) { set = new Set(); this.handlers.set(ch, set); await this.subscriber.subscribe(ch); }
    set.add(sub);
    return async () => {
      const s = this.handlers.get(ch);
      if (!s) return;
      s.delete(sub);
      if (s.size === 0) { this.handlers.delete(ch); await this.subscriber?.unsubscribe(ch).catch(() => undefined); }
    };
  }
}

// ─── Selection ────────────────────────────────────────────────────────────

let singleton: ScanSessionStore | null = null;

/**
 * Redis when REDIS_URL is set (works across containers), else in-memory —
 * which is per-process, so with several app containers a phone could land
 * on a different instance than the desktop. Same caveat as lib/rate-limit.
 */
export function getScanSessionStore(): ScanSessionStore {
  if (!singleton) {
    singleton = process.env.REDIS_URL
      ? new RedisScanSessionStore(process.env.REDIS_URL)
      : new MemoryScanSessionStore();
  }
  return singleton;
}

/** Resolve a session the caller is allowed to touch. The QR code is NOT a credential: both devices must be the same signed-in user. */
export async function loadOwnedSession(store: ScanSessionStore, code: unknown, userId: string): Promise<{ status: 200; record: ScanSessionRecord } | { status: 404 | 403; error: string }> {
  if (!isValidSessionCode(code)) return { status: 404, error: 'Unknown scan session' };
  const record = await store.get(code);
  if (!record) return { status: 404, error: 'Unknown or expired scan session' };
  if (record.userId !== userId) return { status: 403, error: 'This scan session belongs to another account' };
  return { status: 200, record };
}
