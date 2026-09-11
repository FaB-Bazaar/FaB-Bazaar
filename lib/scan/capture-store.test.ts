// lib/scan/capture-store.test.ts — keeps recent scan photos (rollout diagnostics) with a TTL.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MemoryScanCaptureStore, RedisScanCaptureStore, type ScanCaptureStore } from './capture-store';

const PNG = Buffer.from('89504e470d0a1a0a0000', 'hex');

function contract(name: string, make: () => Promise<ScanCaptureStore | null>, teardown?: () => Promise<void>) {
  describe(name, () => {
    let store: ScanCaptureStore | null = null;
    beforeAll(async () => { store = await make(); });
    afterAll(async () => { await teardown?.(); });
    const skip = () => { if (!store) { console.warn(`${name}: unavailable, skipped`); return true; } return false; };
    const user = () => 'u-' + Math.random().toString(36).slice(2, 8);

    it('saves a photo with its outcome and lists it newest first', async () => {
      if (skip()) return;
      const u = user();
      const a = await store!.save(u, PNG, 'image/png', { cardsFound: 0, topName: 'Wrong Card', bestDistance: 90 });
      const b = await store!.save(u, PNG, 'image/png', { cardsFound: 1, topName: 'Right Card', bestDistance: 12 });
      const list = await store!.list(u);
      expect(list.map(c => c.id)).toEqual([b.id, a.id]);
      expect(list[0]).toMatchObject({ contentType: 'image/png', bytes: PNG.length, outcome: { cardsFound: 1, topName: 'Right Card', bestDistance: 12 } });
      expect(typeof list[0].createdAt).toBe('number');
    });
    it('returns the original bytes by id, scoped to the user', async () => {
      if (skip()) return;
      const u = user();
      const c = await store!.save(u, PNG, 'image/png', { cardsFound: 0, topName: null, bestDistance: null });
      const got = await store!.get(u, c.id);
      expect(got?.contentType).toBe('image/png');
      expect(Buffer.from(got!.data).equals(PNG)).toBe(true);
      expect(await store!.get('someone-else', c.id)).toBeNull();
      expect(await store!.get(u, 'nope')).toBeNull();
    });
    it('records a label (the true printing) on a capture and returns it in list/get', async () => {
      if (skip()) return;
      const u = user();
      const c = await store!.save(u, PNG, 'image/png', { cardsFound: 1, topName: 'Wrong Card', bestDistance: 40 });
      const labelled = await store!.label(u, c.id, { printingId: 'p-true', cardName: 'True Card', source: 'corrected' });
      expect(labelled).toBe(true);
      const meta = (await store!.list(u)).find(x => x.id === c.id)!;
      expect(meta.label).toMatchObject({ printingId: 'p-true', cardName: 'True Card', source: 'corrected' });
      expect(typeof meta.label!.at).toBe('number');
      expect(await store!.label(u, 'nope', { printingId: 'p', cardName: 'x', source: 'accepted' })).toBe(false);
      expect(await store!.label('someone-else', c.id, { printingId: 'p', cardName: 'x', source: 'accepted' })).toBe(false);
    });
    it('keeps only the newest N per user', async () => {
      if (skip()) return;
      const u = user();
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) ids.push((await store!.save(u, PNG, 'image/png', { cardsFound: 0, topName: null, bestDistance: null }, { keep: 3 })).id);
      const list = await store!.list(u);
      expect(list.map(c => c.id)).toEqual(ids.slice(2).reverse());
      expect(await store!.get(u, ids[0])).toBeNull();
    });
  });
}

contract('MemoryScanCaptureStore', async () => new MemoryScanCaptureStore());
let redis: RedisScanCaptureStore | null = null;
contract('RedisScanCaptureStore', async () => {
  if (!process.env.REDIS_URL) return null;
  redis = new RedisScanCaptureStore(process.env.REDIS_URL);
  try { await redis.ping(); return redis; } catch { await redis.close(); return null; }
}, async () => { await redis?.close(); });
