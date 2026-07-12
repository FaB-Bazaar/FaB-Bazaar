/**
 * Guardrail tests for the two mandatory-read MCP resource payloads.
 *
 * These resources are read at the start of every MCP session by every client,
 * so their size is a per-session token tax (free-tier Le Chat hits turn limits
 * on large payloads). The size budgets pin the post-dedupe weight; the content
 * assertions pin the load-bearing domain knowledge that must survive any trim.
 */

import { describe, it, expect } from 'vitest';
import { fabConstantsResource } from './fabConstants';
import { searchCapabilitiesResource } from './searchCapabilities';

const constantsP = fabConstantsResource.handler();
const fieldsP = searchCapabilitiesResource.handler();

describe('fab://constants payload', () => {
  it('stays within the size budget', async () => {
    const text = JSON.stringify(await constantsP);
    expect(text.length).toBeLessThan(20_000);
  });

  it('keeps load-bearing domain knowledge', async () => {
    const data = await constantsP;
    const text = JSON.stringify(data);

    // r = Rainbow Foil, never non-foil — the #1 search mistake
    expect(text).toContain('NOT non-foil');
    // WB = History Pack, digit-first set codes
    expect(text).toContain('1hp');
    expect(text).toContain('2hp');
    // BB/WB border terminology survives (single copy is fine)
    expect(text).toContain('Black Border');
    expect(text).toContain('White Border');
    // High Seas amulet pricing trap
    expect(text).toContain('Treasure');
    // Marvel rarity fallback to Full Art CF promos
    expect(text).toContain('artVariations');
    // Pirate is a class, not a talent
    expect(text).toContain("'pirate' is a CLASS");
    // Hero nickname parsing table survives
    expect(data.hero_mappings.nicknames).toBeTruthy();
    expect(Object.keys(data.hero_mappings.nicknames).length).toBeGreaterThan(30);
    // Full roster moved out — pointer to the dedicated resource must exist
    expect(text).toContain('fab://heroes-by-format');
    // Facet vocabulary lives in its own resource — pointer must exist
    expect(text).toContain('fab://facet-tags');
    // Alias→canonical maps stay (shorthand parsing source of truth)
    expect(data.foiling_mappings.mappings).toBeTruthy();
    expect(data.rarity_mappings.mappings).toBeTruthy();
    expect(data.set_mappings.core_sets).toBeTruthy();
  });
});

describe('searchable://card/fields payload', () => {
  it('stays within the size budget', async () => {
    const text = JSON.stringify(await fieldsP);
    expect(text.length).toBeLessThan(11_000);
  });

  it('keeps load-bearing API guidance', async () => {
    const data = await fieldsP;
    const text = JSON.stringify(data);

    // exact:true default + fuzzy-match warning
    expect(text).toContain('exact');
    expect(text).toContain('word_similarity');
    // classes vs heroClasses disambiguation lives here (single copy)
    expect(text).toContain('heroClasses');
    // Core API reference sections survive
    expect(data.filter_reference?.stat_filters).toBeTruthy();
    // Arcane damage stat is documented ("what deals 3+ arcane damage")
    expect(data.filter_reference.stat_filters.arcane).toContain('arcaneMin');
    expect(text).toContain('searchAllVersions');
    // Negation convention
    expect(text).toContain('raritiesNot');
  });

  it('does not contradict fab://constants on History Pack set codes', async () => {
    const text = JSON.stringify(await fieldsP);
    // "hp1"/"hp2" is the legacy spelling that returns 0 results in the DB;
    // canonical codes are digit-first (1hp/2hp). The resource must not teach it.
    expect(text).not.toContain('"hp1"');
    expect(text).not.toContain('"hp2"');
  });
});
