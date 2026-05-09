import { describe, it, expect, vi } from 'vitest';
import { formatSearchSections, searchPrintingsTool } from './searchPrintings';

vi.mock('@/lib/services', () => ({
  printingsService: {
    searchPrintings: vi.fn().mockResolvedValue({ success: true, data: { printings: [], total: 0 } }),
    bulkResolveByName: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
}));

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

describe('searchPrintingsTool.handler — heroLegal × format guardrail', () => {
  it('rejects an adult hero in silver_age with a clear error and never calls the service', async () => {
    const { printingsService } = await import('@/lib/services');
    (printingsService.searchPrintings as any).mockClear();
    (printingsService.bulkResolveByName as any).mockClear();

    const result = await searchPrintingsTool.handler({
      cards: [{ filters: { heroLegal: 'kano, dracai of aether', format: 'silver_age' } }],
    });

    expect(result.success).toBe(false);
    const msg = (result as any).message ?? (result as any).error ?? '';
    expect(msg).toMatch(/silver_age/i);
    expect(msg).toMatch(/young/i);
    expect(msg).toMatch(/kano/);
    expect(printingsService.searchPrintings).not.toHaveBeenCalled();
    expect(printingsService.bulkResolveByName).not.toHaveBeenCalled();
  });

  it('rejects a young hero in cc with a clear error', async () => {
    const result = await searchPrintingsTool.handler({
      cards: [{ filters: { heroLegal: 'kano', format: 'cc' } }],
    });
    expect(result.success).toBe(false);
    const msg = (result as any).message ?? (result as any).error ?? '';
    expect(msg).toMatch(/cc|classic constructed/i);
    expect(msg).toMatch(/adult/i);
  });

  it('passes through a valid hero/format combination to the service', async () => {
    const { printingsService } = await import('@/lib/services');
    (printingsService.searchPrintings as any).mockClear();

    const result = await searchPrintingsTool.handler({
      cards: [{ filters: { heroLegal: 'kano', format: 'silver_age' } }],
    });
    expect(result.success).not.toBe(false);
    expect(printingsService.searchPrintings).toHaveBeenCalled();
  });
});
