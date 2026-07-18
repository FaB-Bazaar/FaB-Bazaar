/**
 * Integration test: showcase cards on getUserBindersWithStats must carry the
 * printing's stored image_url (deterministic CDN ids post-migration), so the
 * UI can prefer it over constructing a printing_id URL.
 *
 * Runs against the local Postgres DB. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, inventoryItems, printings } from '@/lib/postgres/schema';
import { PostgresBinderService } from './PostgresBinderService';

const service = new PostgresBinderService();

let testUserId: string;
let printingId: string;
let printingImageUrl: string | null;

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
  const [p] = await db
    .select({ printingId: printings.printingId, imageUrl: printings.imageUrl })
    .from(printings)
    .where(eq(printings.hasPrice, true))
    .limit(1);
  printingId = p.printingId;
  printingImageUrl = p.imageUrl;
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('showcase cards image_url', () => {
  it('getUserBindersWithStats returns each showcase card with the stored image_url', async () => {
    const created = await service.createBinder(testUserId, {
      name: `Showcase ${crypto.randomUUID()}`,
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    await db.insert(inventoryItems).values({
      id: crypto.randomUUID(),
      userId: testUserId,
      binderId: created.data._id,
      printingId,
      quantity: 1,
      condition: 'NM',
      language: 'English',
    });

    const result = await service.getUserBindersWithStats(testUserId);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const binder = result.data.find((b) => b._id === created.data._id);
    expect(binder).toBeTruthy();
    expect(binder!.stats.showcaseCards.length).toBeGreaterThan(0);
    const sc = binder!.stats.showcaseCards[0];
    expect(sc.printingId).toBe(printingId);
    expect(sc.image_url).toBe(printingImageUrl ?? undefined);
  });
});
