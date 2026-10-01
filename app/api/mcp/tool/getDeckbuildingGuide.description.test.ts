import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/services', () => ({ printingsService: { searchPrintings: vi.fn() } }));

import { getDeckbuildingGuideTool } from './getDeckbuildingGuide';

describe('get_deckbuilding_guide description', () => {
  // Hosts that never call the tool still read this text, so its workflow must
  // match the guide's method: research and ask the user before create_deck.
  it('puts research and the user question before create_deck in the workflow', () => {
    const d = getDeckbuildingGuideTool.description;
    const create = d.indexOf('create_deck');
    expect(create).toBeGreaterThan(-1);
    expect(d.indexOf('get_decks_to_beat')).toBeGreaterThan(-1);
    expect(d.indexOf('get_decks_to_beat')).toBeLessThan(create);
    expect(d.search(/ask the user/i)).toBeGreaterThan(-1);
    expect(d.search(/ask the user/i)).toBeLessThan(create);
  });
});
