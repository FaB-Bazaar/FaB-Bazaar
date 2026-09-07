/**
 * Hero-pool legality for multi-class cards (CR 1.1.3b / 2.14.1b).
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 *
 * Two kinds of multi-class card exist and they are legal for DIFFERENT heroes:
 *  - Single supertype set, printed without a slash ("Pirate Necromancer
 *    Action"): the hero must have EVERY class — card.classes ⊆ hero classes.
 *    Malice (Shadow Necromancer) cannot play Angry Bones; Gravy Bones
 *    (Pirate Necromancer) can.
 *  - Hybrid, printed "[A] / [B]" ("Brute / Guardian Instant"): legal if EITHER
 *    set fits the hero, i.e. class overlap.
 * cards.type_text keeps the slash, so it is the discriminator.
 */

import { describe, it, expect } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

const namesFor = async (filters: Parameters<PostgresPrintingsService['searchPrintings']>[0]) => {
  const r = await service.searchPrintings(filters, { limit: 20 });
  expect(r.success).toBe(true);
  if (!r.success) return [];
  return r.data.printings.map((p: any) => p.display_name ?? p.name);
};

describe('hero-pool legality — multi-class cards', () => {
  it('a single-set dual-class card needs BOTH classes: Necromancer-only hero cannot play Angry Bones', async () => {
    const names = await namesFor({ name: 'Angry Bones', exact: true, heroClasses: ['necromancer'], heroTalents: ['shadow'] });
    expect(names).toEqual([]);
  });

  it('a single-set dual-class card is legal for a hero with both classes (Gravy Bones)', async () => {
    const names = await namesFor({ name: 'Angry Bones', exact: true, heroClasses: ['pirate', 'necromancer'] });
    expect(names.length).toBeGreaterThan(0);
  });

  it('a Pirate-only hero cannot play a Pirate Necromancer card either', async () => {
    const names = await namesFor({ name: 'Angry Bones', exact: true, heroClasses: ['pirate'] });
    expect(names).toEqual([]);
  });

  it('a "/" hybrid card is legal for a hero with only ONE of its classes (Guardian → Brute / Guardian)', async () => {
    const names = await namesFor({ name: 'Battered Not Broken', exact: true, heroClasses: ['guardian'] });
    expect(names.length).toBeGreaterThan(0);
  });

  it('a "/" hybrid card is still illegal for a hero with neither class', async () => {
    const names = await namesFor({ name: 'Battered Not Broken', exact: true, heroClasses: ['wizard'] });
    expect(names).toEqual([]);
  });
});
