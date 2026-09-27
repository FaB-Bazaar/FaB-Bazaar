import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the service layer BEFORE importing the module under test (vi.mock is hoisted)
vi.mock('@/lib/services', () => ({
  userService: { findByDiscordId: vi.fn() },
  deckService: { listUserDecksBasic: vi.fn(), getInventoryComparison: vi.fn() },
  printingsService: { getPrintingsByIds: vi.fn() },
}));

import { handleNeedsCommand, handleNeedsDeckSelect, handleNeedsMode } from './needs.js';
import { userService, deckService, printingsService } from '@/lib/services';

const mockFindByDiscordId = vi.mocked(userService.findByDiscordId);
const mockListDecks = vi.mocked(deckService.listUserDecksBasic);
const mockComparison = vi.mocked(deckService.getInventoryComparison);
const mockGetPrintings = vi.mocked(printingsService.getPrintingsByIds);

const body = { member: { user: { id: 'discord-123' } } };

beforeEach(() => {
  vi.clearAllMocks();
  mockFindByDiscordId.mockResolvedValue({
    success: true,
    data: { _id: 'user-1', username: 'mistercakes', discordId: 'discord-123' },
  } as any);
});

describe('handleNeedsCommand — deck picker', () => {
  beforeEach(() => {
    mockListDecks.mockResolvedValue({
      success: true,
      data: [
        { _id: 'd1', publicId: 'pub-aaa', name: 'Enigma CC', heroDisplayName: 'Enigma, New Moon', format: 'classic-constructed' },
        { _id: 'd2', publicId: 'pub-bbb', name: 'Fai Blitz', heroDisplayName: 'Fai', format: 'blitz' },
      ],
    } as any);
  });

  it('shows an ephemeral deck select carrying the visibility in its custom_id', async () => {
    const response = await handleNeedsCommand(body, 'eph');
    const json = await response.json();

    expect(json.type).toBe(4);
    expect(json.data.flags & 64).toBe(64); // picker is always ephemeral
    const menu = json.data.components[0].components[0];
    expect(menu.custom_id).toBe('needs_deck:eph');
    expect(menu.options.map((o: any) => o.value)).toEqual(['pub-aaa', 'pub-bbb']);
    expect(menu.options[0].label).toContain('Enigma CC');
  });

  it('threads public visibility through for the context-menu variant', async () => {
    const response = await handleNeedsCommand(body, 'pub');
    const json = await response.json();

    expect(json.data.flags & 64).toBe(64); // picker still ephemeral
    expect(json.data.components[0].components[0].custom_id).toBe('needs_deck:pub');
  });

  it('errors helpfully when the user has no decks', async () => {
    mockListDecks.mockResolvedValue({ success: true, data: [] } as any);
    const response = await handleNeedsCommand(body, 'eph');
    const json = await response.json();
    expect(json.data.content).toContain("don't have any decks");
  });
});

describe('handleNeedsDeckSelect — mode picker', () => {
  it('offers any-version and specific-printing buttons for the chosen deck', async () => {
    const selectBody = { ...body, data: { values: ['pub-aaa'] } };
    const response = await handleNeedsDeckSelect('needs_deck:pub', selectBody);
    const json = await response.json();

    expect(json.type).toBe(7); // UPDATE_MESSAGE — stays in the ephemeral picker
    const buttons = json.data.components[0].components;
    expect(buttons.map((b: any) => b.custom_id)).toEqual([
      'needs_mode:pub:pub-aaa:card',
      'needs_mode:pub:pub-aaa:printing',
    ]);
  });
});

describe('handleNeedsMode — the needs list', () => {
  const comparisonFixture = {
    owned: [],
    missing: [
      { printingId: 'p-storm', cardName: 'Comet Storm', pitch: 1, needed: 3, tcgLow: 2.5 },
    ],
    partial: [
      { printingId: 'p-quake', cardName: 'Ice Quake', pitch: 3, needed: 3, owned: 1, shortage: 2, tcgLow: 1.0 },
    ],
    summary: {
      totalNeeded: 80, totalOwned: 75, totalMissing: 5,
      completionPercentage: 94, estimatedMissingValue: 9.5,
    },
  };

  beforeEach(() => {
    mockListDecks.mockResolvedValue({
      success: true,
      data: [{ _id: 'd1', publicId: 'pub-aaa', name: 'Enigma CC', heroDisplayName: 'Enigma, New Moon', format: 'classic-constructed' }],
    } as any);
    mockComparison.mockResolvedValue({ success: true, data: comparisonFixture } as any);
    mockGetPrintings.mockResolvedValue({
      success: true,
      data: {
        printings: [
          { printing_id: 'p-storm', set: 'ros', collector_number: 'ROS076', foiling: 'r' },
          { printing_id: 'p-quake', set: 'ele', collector_number: 'ELE151', foiling: 's' },
        ],
        total: 2, page: 1, pages: 1,
      },
    } as any);
  });

  it('any-version mode: ephemeral output lists missing and partial shortfalls with pitch colors', async () => {
    const response = await handleNeedsMode('needs_mode:eph:pub-aaa:card', body);
    const json = await response.json();

    expect(mockComparison).toHaveBeenCalledWith('pub-aaa', 'user-1', { matchBy: 'card' });
    expect(json.type).toBe(4);
    expect(json.data.flags & 64).toBe(64); // ephemeral
    expect(json.data.flags & 4).toBe(4); // embeds suppressed (deck link in content)
    // pitch square, bold qty, line total with the per-copy price spelled out
    expect(json.data.content).toContain('🟥 **3×** Comet Storm — $7.50 ($2.50 each)');
    expect(json.data.content).toContain('🟦 **2×** Ice Quake — $2.00 ($1.00 each) · you have 1 of 3'); // shortage, not needed
    expect(json.data.content).toContain('**Needs for Enigma CC** · any version');
    expect(json.data.content).toContain('You own 75 of 80 cards. Missing 5, about $9.50 to finish.');
  });

  it('specific-printings mode: public output includes collector number and foiling', async () => {
    const response = await handleNeedsMode('needs_mode:pub:pub-aaa:printing', body);
    const json = await response.json();

    expect(mockComparison).toHaveBeenCalledWith('pub-aaa', 'user-1', { matchBy: 'printing' });
    expect(json.data.flags & 64).toBe(0); // public
    expect(json.data.flags & 4).toBe(4); // embeds still suppressed
    expect(json.data.content).toContain('🟥 **3×** Comet Storm — $7.50 ($2.50 each) · ROS076 Rainbow Foil');
    expect(json.data.content).toContain('🟦 **2×** Ice Quake — $2.00 ($1.00 each) · you have 1 of 3 · ELE151 Non-foil');
  });

  it('groups $1+ cards first, then cheap cards with a count and total, then unpriced; links the deck', async () => {
    mockComparison.mockResolvedValue({
      success: true,
      data: {
        ...comparisonFixture,
        missing: [
          ...comparisonFixture.missing,
          { printingId: 'p-metex', cardName: 'MetEx', pitch: 1, needed: 3, tcgLow: 0.02 },
          { printingId: 'p-gas', cardName: 'Gas Up', pitch: 2, needed: 1, tcgLow: 0.3 },
          { printingId: 'p-puffer', cardName: 'Puffer Jacket', pitch: null, needed: 1, tcgLow: null },
        ],
      },
    } as any);
    const content: string = (await (await handleNeedsMode('needs_mode:eph:pub-aaa:card', body)).json()).data.content;

    const big = content.indexOf('**$1 or more each**');
    const cheap = content.indexOf('**Under $1 each** · 4 cards, $0.36');
    const none = content.indexOf('**No price listed**');
    expect(big).toBeGreaterThan(-1);
    expect(cheap).toBeGreaterThan(big);
    expect(none).toBeGreaterThan(cheap);
    expect(content.indexOf('Comet Storm')).toBeLessThan(cheap);
    expect(content.indexOf('MetEx')).toBeGreaterThan(cheap);
    // cheap lines stay light: no bold, no per-copy price
    expect(content).toContain('🟥 3× MetEx — $0.06');
    expect(content).toContain('🟨 1× Gas Up — $0.30');
    expect(content).toContain('▫️ 1× Puffer Jacket');
    expect(content).toContain('[Open Enigma CC on FaB Bazaar](https://fabbazaar.app/decks/pub-aaa)');
  });

  it('celebrates a fully-owned deck instead of sending an empty list', async () => {
    mockComparison.mockResolvedValue({
      success: true,
      data: { owned: [], missing: [], partial: [], summary: { totalNeeded: 80, totalOwned: 80, totalMissing: 0, completionPercentage: 100, estimatedMissingValue: 0 } },
    } as any);
    const response = await handleNeedsMode('needs_mode:eph:pub-aaa:card', body);
    const json = await response.json();
    expect(json.data.content).toContain('own everything');
  });
});

describe('/needs messages — no toolbox emoji', () => {
  it('neither picker nor the final list starts with 🧰', async () => {
    mockListDecks.mockResolvedValue({ success: true, data: [{ _id: 'd1', publicId: 'pub-aaa', name: 'Enigma CC' }] } as any)
    mockComparison.mockResolvedValue({ success: true, data: { owned: [], partial: [], missing: [{ printingId: 'p', cardName: 'Comet Storm', pitch: 1, needed: 1, tcgLow: 2 }],
      summary: { totalNeeded: 1, totalOwned: 0, totalMissing: 1, completionPercentage: 0, estimatedMissingValue: 2 } } } as any)
    const texts = [
      (await (await handleNeedsCommand(body, 'eph')).json()).data.content,
      (await (await handleNeedsDeckSelect('needs_deck:eph', { ...body, data: { values: ['pub-aaa'] } })).json()).data.content,
      (await (await handleNeedsMode('needs_mode:eph:pub-aaa:card', body)).json()).data.content,
    ]
    for (const t of texts) expect(t).not.toContain('🧰')
  })
})

