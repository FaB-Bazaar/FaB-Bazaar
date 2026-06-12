// lib/fab-constants/sets-sync.test.ts
//
// Invariant: the `sets` table (migration 0061) is the SOURCE OF TRUTH for set
// metadata. The compile-time constants in lib/fab-constants are a generated
// client-side snapshot and must match it exactly. If this test is red, run:
//
//   npx tsx --env-file=.env.local scripts/generate-set-constants.ts
//
// Runs against local Postgres (POSTGRES_URL via vitest.setup.ts).

import { describe, it, expect } from 'vitest';
import { SET_MAP, SET_METADATA } from './sets';
import { PostgresSetsService } from '@/lib/services/postgres/sets/PostgresSetsService';

const service = new PostgresSetsService();

describe('fab-constants ↔ sets table sync', () => {
  it('constants mirror every sets row exactly', async () => {
    const res = await service.listSets();
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.length).toBeGreaterThan(100);

    const mismatches: string[] = [];
    for (const s of res.data) {
      const mapName = (SET_MAP as Record<string, string>)[s.code];
      if (mapName !== s.name) {
        mismatches.push(`${s.code}: SET_MAP name "${mapName}" ≠ DB "${s.name}"`);
      }
      const meta = (SET_METADATA as Record<string, any>)[s.code];
      if (!meta) {
        mismatches.push(`${s.code}: missing from SET_METADATA`);
        continue;
      }
      if (meta.code !== s.displayCode) mismatches.push(`${s.code}: displayCode ${meta.code} ≠ ${s.displayCode}`);
      if ((meta.releaseDate || null) !== s.releaseDate) mismatches.push(`${s.code}: releaseDate ${meta.releaseDate} ≠ ${s.releaseDate}`);
      if (meta.category !== s.category) mismatches.push(`${s.code}: category ${meta.category} ≠ ${s.category}`);
      if (meta.tier !== s.tier) mismatches.push(`${s.code}: tier ${meta.tier} ≠ ${s.tier}`);
      if (meta.hasFirstEdition !== s.hasFirstEdition) mismatches.push(`${s.code}: hasFirstEdition ${meta.hasFirstEdition} ≠ ${s.hasFirstEdition}`);
      if ((meta.defaultRarity ?? null) !== s.defaultRarity) mismatches.push(`${s.code}: defaultRarity ${meta.defaultRarity} ≠ ${s.defaultRarity}`);
      if (meta.displayOrder !== s.displayOrder) mismatches.push(`${s.code}: displayOrder ${meta.displayOrder} ≠ ${s.displayOrder}`);
    }

    // And no constants for codes the DB doesn't know
    const dbCodes = new Set(res.data.map((s) => s.code));
    for (const code of Object.keys(SET_METADATA)) {
      if (!dbCodes.has(code)) mismatches.push(`${code}: in SET_METADATA but not in sets table`);
    }

    expect(mismatches, mismatches.slice(0, 15).join('\n')).toEqual([]);
  });
});
