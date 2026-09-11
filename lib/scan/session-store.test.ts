// lib/scan/session-store.test.ts — phone↔desktop scan session store contract.
// Runs against the in-memory store always, and against Redis when REDIS_URL
// is reachable (same contract, so the desktop can't tell which one it has).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MemoryScanSessionStore, RedisScanSessionStore, type ScanSessionStore, type ScanSessionItem } from './session-store';

const ITEM = (id: string): ScanSessionItem => ({
  id, createdAt: Date.now(), thumb: null, candidates: [{ name: 'Sink Below', distance: 3, cards: [] }], bestDistance: 3, pitchHint: 'red',
});

async function redisIfReachable(): Promise<RedisScanSessionStore | null> {
  if (!process.env.REDIS_URL) return null;
  const store = new RedisScanSessionStore(process.env.REDIS_URL);
  try { await store.ping(); return store; } catch { await store.close(); return null; }
}

function contract(name: string, make: () => Promise<ScanSessionStore | null>, teardown?: () => Promise<void>) {
  describe(name, () => {
    let store: ScanSessionStore | null = null;
    beforeAll(async () => { store = await make(); });
    afterAll(async () => { await teardown?.(); });
    const skipIfAbsent = () => { if (!store) { console.warn(`${name}: unavailable, skipped`); return true; } return false; };

    it('creates a session with a short shareable code owned by the user', async () => {
      if (skipIfAbsent()) return;
      const s = await store!.create('user-1');
      expect(s.code).toMatch(/^[A-Z2-9]{8}$/);
      expect(s.userId).toBe('user-1');
      expect(s.pairedAt).toBeNull();
      expect(await store!.get(s.code)).toEqual(s);
    });

    it('returns null for unknown codes', async () => {
      if (skipIfAbsent()) return;
      expect(await store!.get('NOPE2222')).toBeNull();
    });

    it('marks a session paired exactly once', async () => {
      if (skipIfAbsent()) return;
      const s = await store!.create('user-1');
      const paired = await store!.markPaired(s.code);
      expect(paired?.pairedAt).toEqual(expect.any(Number));
      const again = await store!.markPaired(s.code);
      expect(again?.pairedAt).toBe(paired?.pairedAt);
    });

    it('appends items in order and lists them back', async () => {
      if (skipIfAbsent()) return;
      const s = await store!.create('user-1');
      await store!.appendItem(s.code, ITEM('a'));
      await store!.appendItem(s.code, ITEM('b'));
      expect((await store!.listItems(s.code)).map(i => i.id)).toEqual(['a', 'b']);
      expect(await store!.listItems('NOPE2222')).toEqual([]);
    });

    it('delivers appended items and pairing to a live subscriber, and stops after unsubscribe', async () => {
      if (skipIfAbsent()) return;
      const s = await store!.create('user-1');
      const got: string[] = [];
      const unsubscribe = await store!.subscribe(s.code, {
        onItem: (i) => { got.push('item:' + i.id); },
        onPaired: () => { got.push('paired'); },
      });
      await store!.markPaired(s.code);
      await store!.appendItem(s.code, ITEM('x'));
      await new Promise(r => setTimeout(r, 150));
      expect(got).toEqual(['paired', 'item:x']);
      await unsubscribe();
      await store!.appendItem(s.code, ITEM('y'));
      await new Promise(r => setTimeout(r, 150));
      expect(got).toEqual(['paired', 'item:x']);
    });
  });
}

contract('MemoryScanSessionStore', async () => new MemoryScanSessionStore());

let redisStore: RedisScanSessionStore | null = null;
contract('RedisScanSessionStore', async () => { redisStore = await redisIfReachable(); return redisStore; }, async () => { await redisStore?.close(); });
