import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({ printingsService: { searchPrintings: vi.fn() } }));

import { getDeckbuildingGuideTool } from './getDeckbuildingGuide';
import { printingsService } from '@/lib/services';
import { HERO_INFO } from '@/lib/fab-constants/heroes-rosters';

const mockSearch = vi.mocked(printingsService.searchPrintings);

describe('get_deckbuilding_guide tool', () => {
  beforeEach(() => { mockSearch.mockReset(); });

  it('tells the agent to call it before building', () => {
    expect(getDeckbuildingGuideTool.name).toBe('get_deckbuilding_guide');
    expect(getDeckbuildingGuideTool.description).toMatch(/before building/i);
    expect(getDeckbuildingGuideTool.parameters.required).toEqual(['format']);
  });

  it('fetches the hero card by its cardUniqueId and puts its text in the message', async () => {
    mockSearch.mockResolvedValue({
      success: true,
      data: { printings: [{ text: 'Fetched hero text', health: 40 }], total: 1, page: 1, pages: 1 },
    } as any);

    const result = await getDeckbuildingGuideTool.handler({ format: 'Classic Constructed', heroName: 'dorinthea ironsong' });

    expect(mockSearch).toHaveBeenCalledWith(
      { cardUniqueId: HERO_INFO['dorinthea ironsong'].cardUniqueId },
      expect.objectContaining({ limit: 1 }),
    );
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/Fetched hero text/);
    expect(result.message).toMatch(/Life 40/);
  });

  it('still returns the guide when the hero lookup fails', async () => {
    mockSearch.mockRejectedValue(new Error('db down'));
    const result = await getDeckbuildingGuideTool.handler({ format: 'Blitz', heroName: 'dorinthea' });
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/could not be loaded/);
  });

  it('does not search when no hero is given', async () => {
    const result = await getDeckbuildingGuideTool.handler({ format: 'Silver Age' });
    expect(result.success).toBe(true);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('returns the error for an unknown format', async () => {
    const result = await getDeckbuildingGuideTool.handler({ format: 'Standard' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Unknown format/);
  });
});
