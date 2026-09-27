/**
 * Hero specializations: a card whose keywords carry "<name> specialization"
 * (cards.keywords, e.g. Singularity → "teklovossen specialization") is legal
 * only for the hero whose name starts with <name> ("maxx" → "Maxx 'The Hype'
 * Nitro"; "dromai or fai" → either). `specializationHero` (the deck hero's
 * full name) drops every other hero's specializations from a search.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

const namesFor = async (filters: Parameters<PostgresPrintingsService['searchPrintings']>[0]) => {
  const r = await service.searchPrintings(filters, { limit: 50 });
  expect(r.success).toBe(true);
  if (!r.success) return [];
  return [...new Set(r.data.printings.map((p: any) => String(p.display_name ?? p.name).toLowerCase()))];
};

describe('specializationHero', () => {
  it("drops another hero's specialization (Maxx cannot play Teklovossen's Singularity)", async () => {
    expect(await namesFor({ name: 'Singularity', exact: true })).toContain('singularity');
    expect(await namesFor({ name: 'Singularity', exact: true, specializationHero: "maxx 'the hype' nitro" })).toEqual([]);
  });

  it("keeps the hero's own specializations (Maxx → Hit the Gas)", async () => {
    expect(await namesFor({ name: 'Hit the Gas', exact: true, specializationHero: "maxx 'the hype' nitro" })).toContain('hit the gas');
  });

  it('matches the name at a word boundary (Dash I/O keeps Teklo Core)', async () => {
    expect(await namesFor({ name: 'Teklo Core', exact: true, specializationHero: 'dash i/o' })).toContain('teklo core');
  });

  it('honours "X or Y specialization" for either hero', async () => {
    expect(await namesFor({ name: 'Rise Up', exact: true, specializationHero: 'fai, rising rebellion' })).toContain('rise up');
    expect(await namesFor({ name: 'Rise Up', exact: true, specializationHero: 'dromai, ash artist' })).toContain('rise up');
    expect(await namesFor({ name: 'Rise Up', exact: true, specializationHero: 'kano, dracai of aether' })).toEqual([]);
  });

  it('leaves non-specialization cards alone', async () => {
    expect(await namesFor({ name: 'Sink Below', exact: true, specializationHero: "maxx 'the hype' nitro" })).toContain('sink below');
  });
});
