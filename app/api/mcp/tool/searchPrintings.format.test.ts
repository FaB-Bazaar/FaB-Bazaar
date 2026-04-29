import { describe, it, expect } from 'vitest';
import { formatSearchSections } from './searchPrintings';

const printing = (overrides: Partial<any>) => ({
  printing_id: 'pid_' + Math.random().toString(36).slice(2, 10),
  card_unique_id: 'cuid_default',
  collector_number: 'CRU007',
  name: 'Beast Within',
  set: 'cru',
  edition: 'u',
  foiling: 's',
  rarity: 'm',
  pitch: 1,
  color: 'red',
  types: ['brute', 'action', 'attack'],
  tcg_market: 6.11,
  ...overrides,
});

describe('formatSearchSections', () => {
  it('groups printings by distinct card and lists each card when results span multiple cards', () => {
    const beastWithin = Array.from({ length: 32 }, (_, i) =>
      printing({ name: 'Beast Within', card_unique_id: 'cuid_beast', printing_id: `bw_${i}` })
    );
    const massacre = Array.from({ length: 32 }, (_, i) =>
      printing({ name: 'Massacre', card_unique_id: 'cuid_massacre', collector_number: 'CRU008', printing_id: `mc_${i}` })
    );

    const sections = formatSearchSections(
      [{ index: 0, query: '{"classes":["brute"],"power":6}', total: 64, printings: [...beastWithin, ...massacre] }],
      {}
    );

    expect(sections).toHaveLength(1);
    const text = sections[0];

    expect(text).toContain('Beast Within');
    expect(text).toContain('Massacre');
    expect(text).toMatch(/across 2 cards/);
    expect(text).not.toMatch(/\(\+63 more printings\)/);
  });

  it('renders an empty section when no printings match', () => {
    const sections = formatSearchSections(
      [{ index: 0, query: 'nope', total: 0, printings: [] }],
      {}
    );
    expect(sections[0]).toMatch(/no results/);
  });

  it('shows a single card with per-card printing count when all results are the same card', () => {
    const beastWithin = Array.from({ length: 5 }, (_, i) =>
      printing({ name: 'Beast Within', card_unique_id: 'cuid_beast', printing_id: `bw_${i}` })
    );

    const sections = formatSearchSections(
      [{ index: 0, query: 'beast within', total: 5, printings: beastWithin }],
      {}
    );

    const text = sections[0];
    expect(text).toContain('Beast Within');
    expect(text).toMatch(/\+4 more printings of this card/);
    expect(text).not.toMatch(/across \d+ cards/);
  });

  it('preserves the foiling-fallback warning when set', () => {
    const sections = formatSearchSections(
      [{
        index: 0,
        query: 'foo',
        total: 1,
        printings: [printing({ name: 'Foo', card_unique_id: 'cuid_foo' })],
        foilingFallback: true,
      }],
      {}
    );
    expect(sections[0]).toMatch(/No non-foil printing exists/);
  });
});
