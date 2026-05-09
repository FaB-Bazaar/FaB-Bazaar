/**
 * Integration tests for case-insensitive enum filters in PostgresPrintingsService.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 *
 * Verifies that mixed-case inputs to enum-style filters (classes, talents,
 * keywords, types, rarities, foilings, editions, color) return the same
 * results as their canonical lowercase form. Mirrors the existing pattern
 * already in place for heroClasses/heroTalents/heroLegal at
 * PostgresPrintingsService.ts:1056, 1085.
 */

import { describe, it, expect } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

describe('PostgresPrintingsService — case-insensitive enum filters', () => {
  it('classes: ["Brute"] returns the same result as classes: ["brute"]', async () => {
    const lower = await service.searchPrintings({ classes: ['brute'], rarities: ['m'], power: 6 }, { limit: 1 });
    const upper = await service.searchPrintings({ classes: ['Brute'], rarities: ['m'], power: 6 }, { limit: 1 });

    expect(lower.success).toBe(true);
    expect(upper.success).toBe(true);
    if (!lower.success || !upper.success) return;

    expect(lower.data.total).toBeGreaterThan(0);
    expect(upper.data.total).toBe(lower.data.total);
  });

  it('talents: ["Light"] returns the same result as talents: ["light"]', async () => {
    const lower = await service.searchPrintings({ talents: ['light'] }, { limit: 1 });
    const upper = await service.searchPrintings({ talents: ['Light'] }, { limit: 1 });

    expect(lower.success).toBe(true);
    expect(upper.success).toBe(true);
    if (!lower.success || !upper.success) return;

    expect(lower.data.total).toBeGreaterThan(0);
    expect(upper.data.total).toBe(lower.data.total);
  });

  it('rarities: ["M"] returns the same result as rarities: ["m"]', async () => {
    const lower = await service.searchPrintings({ rarities: ['m'] }, { limit: 1 });
    const upper = await service.searchPrintings({ rarities: ['M'] }, { limit: 1 });

    expect(lower.success).toBe(true);
    expect(upper.success).toBe(true);
    if (!lower.success || !upper.success) return;

    expect(lower.data.total).toBeGreaterThan(0);
    expect(upper.data.total).toBe(lower.data.total);
  });

  it('color: "Red" returns the same result as color: "red"', async () => {
    const lower = await service.searchPrintings({ color: 'red' as any }, { limit: 1 });
    const upper = await service.searchPrintings({ color: 'Red' as any }, { limit: 1 });

    expect(lower.success).toBe(true);
    expect(upper.success).toBe(true);
    if (!lower.success || !upper.success) return;

    expect(lower.data.total).toBeGreaterThan(0);
    expect(upper.data.total).toBe(lower.data.total);
  });

  it('foilings: ["S"] returns the same result as foilings: ["s"]', async () => {
    const lower = await service.searchPrintings({ foilings: ['s'] }, { limit: 1 });
    const upper = await service.searchPrintings({ foilings: ['S'] as any }, { limit: 1 });

    expect(lower.success).toBe(true);
    expect(upper.success).toBe(true);
    if (!lower.success || !upper.success) return;

    expect(lower.data.total).toBeGreaterThan(0);
    expect(upper.data.total).toBe(lower.data.total);
  });

  it('editions: ["U"] returns the same result as editions: ["u"]', async () => {
    const lower = await service.searchPrintings({ editions: ['u'] }, { limit: 1 });
    const upper = await service.searchPrintings({ editions: ['U'] as any }, { limit: 1 });

    expect(lower.success).toBe(true);
    expect(upper.success).toBe(true);
    if (!lower.success || !upper.success) return;

    expect(lower.data.total).toBeGreaterThan(0);
    expect(upper.data.total).toBe(lower.data.total);
  });

  it('classes lowercase still works (no regression)', async () => {
    const result = await service.searchPrintings({ classes: ['brute'], rarities: ['m'], power: 6 }, { limit: 1 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.total).toBeGreaterThan(0);
  });

  it('sets are NOT lowercased (uppercase canonical preserved)', async () => {
    const upper = await service.searchPrintings({ sets: ['WTR'] }, { limit: 1 });
    expect(upper.success).toBe(true);
    if (!upper.success) return;
    expect(upper.data.total).toBeGreaterThan(0);
  });
});

describe('PostgresPrintingsService — heroLegal essence enforcement', () => {
  it('heroLegal: "kano" (no essence) does not return ice cards', async () => {
    const result = await service.searchPrintings(
      { heroLegal: 'kano', hasIce: true },
      { limit: 5 }
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.total).toBe(0);
  });

  it('heroLegal: "kano" + format: "silver_age" does not return ice cards', async () => {
    const result = await service.searchPrintings(
      { heroLegal: 'kano', format: 'silver_age', hasIce: true },
      { limit: 5 }
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.total).toBe(0);
  });

  it('heroLegal: "iyslander" (young, ice essence) DOES return ice cards', async () => {
    const result = await service.searchPrintings(
      { heroLegal: 'iyslander', hasIce: true },
      { limit: 5 }
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.total).toBeGreaterThan(0);
  });

  it('heroLegal: "iyslander, stormbind" (adult, ice essence) DOES return ice cards', async () => {
    const result = await service.searchPrintings(
      { heroLegal: 'iyslander, stormbind', hasIce: true },
      { limit: 5 }
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.total).toBeGreaterThan(0);
  });

  // The deck-builder UI passes the full hero display name as heroLegal (no
  // heroClasses/heroTalents). Before the fix, this hit a broken legacy path
  // returning only isGenericOnly cards. After: it must return a healthy pool.
  it('heroLegal: full display name (deck-builder UI pattern) returns a sensible card pool', async () => {
    const result = await service.searchPrintings(
      { heroLegal: 'Kano, Dracai of Aether' },
      { limit: 1 }
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    // Kano's CC pool is hundreds of cards (wizards + generics). Anything under
    // 100 means the legacy path is still effectively returning generic-only.
    expect(result.data.total).toBeGreaterThan(100);
  });

  // Sanity check — the precise filter must not reject ice cards for an elemental
  // hero whose essence IS in the data. Adult Iyslander has essences=['ice'].
  it('heroClasses+heroEssences for ice essence wizard returns ice cards', async () => {
    const result = await service.searchPrintings(
      { heroClasses: ['wizard'], heroTalents: ['elemental'], heroEssences: ['ice'], hasIce: true },
      { limit: 5 }
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.total).toBeGreaterThan(0);
  });
});
