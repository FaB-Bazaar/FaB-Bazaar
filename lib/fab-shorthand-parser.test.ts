import { describe, it, expect } from 'vitest';
import { FABShorthandParser as McpParser } from './fab-shorthand-parser';
import { FABShorthandParser as SearchParser } from './search/fab-shorthand-parser';

// Both parsers share the same `format:` token handling and historically drifted
// out of sync. These tests pin the format aliases on BOTH so they can't diverge.
describe.each([
  ['mcp (lib/fab-shorthand-parser)', new McpParser()],
  ['search (lib/search/fab-shorthand-parser)', new SearchParser()],
])('FABShorthandParser format parsing — %s', (_label, parser) => {
  it('parses the existing formats', () => {
    expect(parser.parseQuery('format:cc').filters.format).toBe('cc');
    expect(parser.parseQuery('format:blitz').filters.format).toBe('blitz');
    expect(parser.parseQuery('format:commoner').filters.format).toBe('commoner');
    expect(parser.parseQuery('format:ll').filters.format).toBe('ll');
  });

  it('parses silver_age (previously dropped)', () => {
    expect(parser.parseQuery('format:silver_age').filters.format).toBe('silver_age');
  });

  it('normalizes the "sage" alias to silver_age', () => {
    expect(parser.parseQuery('format:sage').filters.format).toBe('silver_age');
  });
});

// `k:` is a documented alias for `keyword:` — pin it on BOTH parsers.
describe.each([
  ['mcp (lib/fab-shorthand-parser)', new McpParser()],
  ['search (lib/search/fab-shorthand-parser)', new SearchParser()],
])('FABShorthandParser keyword aliases — %s', (_label, parser) => {
  it('parses keyword:dominate', () => {
    expect(parser.parseQuery('keyword:dominate').filters.keywords).toContain('dominate');
  });

  it('parses the k: alias', () => {
    expect(parser.parseQuery('k:dominate').filters.keywords).toContain('dominate');
  });

  it('parses k: with a quoted multi-word keyword', () => {
    expect(parser.parseQuery('k:"go again"').filters.keywords).toContain('go again');
  });

  it('k: combines with other tokens (k:dominate t:attack)', () => {
    const f = parser.parseQuery('k:dominate t:attack').filters;
    expect(f.keywords).toContain('dominate');
    expect(f.types).toContain('attack');
  });
});

// History Pack reprints are "1hp"/"2hp" in the DB, but trade posts/docs say
// "hp1"/"hp2". The set parser must normalize the alias on BOTH parsers so
// `set:hp1` resolves instead of returning 0 results.
describe.each([
  ['mcp (lib/fab-shorthand-parser)', new McpParser()],
  ['search (lib/search/fab-shorthand-parser)', new SearchParser()],
])('FABShorthandParser set-code aliases — %s', (_label, parser) => {
  it('normalizes set:hp1 → 1hp', () => {
    expect(parser.parseQuery('set:hp1').filters.sets).toContain('1hp');
    expect(parser.parseQuery('set:hp1').filters.sets).not.toContain('hp1');
  });

  it('normalizes set:hp2 → 2hp', () => {
    expect(parser.parseQuery('set:hp2').filters.sets).toContain('2hp');
  });

  it('normalizes the negated form set:!hp1 → setsNot 1hp', () => {
    expect(parser.parseQuery('set:!hp1').filters.setsNot).toContain('1hp');
  });

  it('leaves canonical codes untouched (set:1hp, set:wtr)', () => {
    expect(parser.parseQuery('set:1hp').filters.sets).toContain('1hp');
    expect(parser.parseQuery('set:wtr').filters.sets).toContain('wtr');
  });
});

// Whole-query card-TYPE phrases ("defense reactions", "red attack actions")
// are category searches, not card names — "list me all the good red defense
// reactions" used to become a useless name search. Pin on BOTH parsers.
describe.each([
  ['mcp (lib/fab-shorthand-parser)', new McpParser()],
  ['search (lib/search/fab-shorthand-parser)', new SearchParser()],
])('bare card-type phrase queries — %s', (_label, parser) => {
  it('treats a whole-query type phrase as a type filter, not a name', () => {
    const f = parser.parseQuery('defense reactions').filters;
    expect(f.isDefenseReaction).toBe(true);
    expect(f.name).toBeUndefined();
  });

  it('handles a LEADING pitch color (first-token colors skip the standalone color rule)', () => {
    const f = parser.parseQuery('red defense reactions').filters;
    expect(f.isDefenseReaction).toBe(true);
    expect(f.color).toBe('red');
    expect(f.name).toBeUndefined();
  });

  it('trailing color still works via the standalone color rule', () => {
    const f = parser.parseQuery('defense reactions blue').filters;
    expect(f.isDefenseReaction).toBe(true);
    expect(f.color).toBe('blue');
  });

  it('composes with other tokens (cost, price)', () => {
    const f = parser.parseQuery('defense reactions cost<2 p:<5').filters;
    expect(f.isDefenseReaction).toBe(true);
    expect(f.name).toBeUndefined();
  });

  it('maps the common type phrases (singular + plural)', () => {
    expect(parser.parseQuery('attack actions').filters.isAttack).toBe(true);
    expect(parser.parseQuery('attack reaction').filters.types).toEqual(['attack reaction']);
    expect(parser.parseQuery('instants').filters.isInstant).toBe(true);
    expect(parser.parseQuery('equipment').filters.isEquipment).toBe(true);
    expect(parser.parseQuery('weapons').filters.isWeapon).toBe(true);
    expect(parser.parseQuery('auras').filters.types).toEqual(['aura']);
    expect(parser.parseQuery('items').filters.types).toEqual(['item']);
  });

  it('does NOT hijack card names that merely contain a type word', () => {
    expect(parser.parseQuery('aura of ebano').filters.name).toBe('aura of ebano');
  });

  it('keeps a guarded first-token color word in the name (Red Alert Boots)', () => {
    // The standalone color rule declines first-token colors - the word must
    // survive into the name search, not just be blanked from it.
    expect(parser.parseQuery('red alert boots').filters.name).toBe('red alert boots');
  });
});

// Arcane damage stat (cards.arcane, migration 0079) — same operator grammar as
// power on BOTH parsers. No `arc` alias: "arc" is the Arcane Rising set code
// and "arc123" is a collector number.
describe.each([
  ['mcp (lib/fab-shorthand-parser)', new McpParser()],
  ['search (lib/search/fab-shorthand-parser)', new SearchParser()],
])('FABShorthandParser arcane stat — %s', (_label, parser) => {
  it('parses arcane:3 and bare arcane3 as exact matches', () => {
    expect(parser.parseQuery('arcane:3').filters.arcane).toBe(3);
    expect(parser.parseQuery('arcane3').filters.arcane).toBe(3);
  });

  it('parses arcane>2 as arcaneMin 3', () => {
    expect(parser.parseQuery('arcane>2').filters.arcaneMin).toBe(3);
  });

  it('parses arcane<4 as arcaneMax 3', () => {
    expect(parser.parseQuery('arcane<4').filters.arcaneMax).toBe(3);
  });

  it('parses arcane!1,2 as arcaneNot', () => {
    expect(parser.parseQuery('arcane!1,2').filters.arcaneNot).toEqual([1, 2]);
  });

  it('combines with other tokens and consumes the token from the name', () => {
    const f = parser.parseQuery('arcane>2 t:action').filters;
    expect(f.arcaneMin).toBe(3);
    expect(f.types).toContain('action');
    expect(f.name ?? '').not.toMatch(/arcane/);
  });

  it('does NOT treat the arc set code as an arcane token', () => {
    expect(parser.parseQuery('set:arc').filters.arcane).toBeUndefined();
    expect(parser.parseQuery('set:arc').filters.sets).toContain('arc');
  });
});
