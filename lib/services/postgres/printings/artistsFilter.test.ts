/**
 * Integration test: the artists[] filter matches case-insensitively.
 *
 * Artists are stored lowercase in printings.artists ("carlos cruchaga"), but
 * callers (users, LLMs) write names capitalized. A raw array-overlap match
 * returned 0 for every capitalized query — making the documented filter
 * useless in practice. Runs against local Postgres.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';
import { db } from '@/lib/postgres/db';
import { sql } from 'drizzle-orm';

const service = new PostgresPrintingsService();

let realArtist: string; // harvested lowercase from the DB, e.g. "carlos cruchaga"

beforeAll(async () => {
  const result = await db.execute(sql`
    SELECT unnest(artists) AS artist FROM printings GROUP BY artist ORDER BY count(*) DESC LIMIT 1
  `);
  realArtist = (result.rows[0] as { artist: string }).artist;
});

describe('searchPrintings — artists filter', () => {
  it('matches the stored lowercase name', async () => {
    const res = await service.searchPrintings({ artists: [realArtist] }, { limit: 5 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.total).toBeGreaterThan(0);
  });

  it('matches a Title Case query against the lowercase-stored artist', async () => {
    const titleCased = realArtist.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
    expect(titleCased).not.toBe(realArtist); // sanity: we are actually testing case
    const res = await service.searchPrintings({ artists: [titleCased] }, { limit: 5 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.total).toBeGreaterThan(0);
  });
});
