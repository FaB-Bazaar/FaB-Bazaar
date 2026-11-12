import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({ printingsService: { searchPrintings: vi.fn() } }));
vi.mock('@/lib/partner-api/auth', () => ({ authenticatePartner: vi.fn() }));

import { GET } from './route';
import { printingsService } from '@/lib/services';
import { authenticatePartner } from '@/lib/partner-api/auth';
import { CALLER, ctx, get } from '../../_test/helpers';

const mockAuth = vi.mocked(authenticatePartner);
const mockSearch = vi.mocked(printingsService.searchPrintings);

const found = (printings: unknown[], total = printings.length) =>
  ({ success: true, data: { printings, total, page: 1, pages: 1 } }) as never;

describe('GET /api/partner/v1/cards/search', () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockSearch.mockReset();
    mockAuth.mockResolvedValue(CALLER);
  });

  it('searches printings by name and returns partner cards', async () => {
    mockSearch.mockResolvedValue(
      found([
        {
          printing_id: 'p-1',
          card_unique_id: 'c-1',
          name: 'snatch',
          display_name: 'Snatch',
          pitch: 1,
          set: 'wtr',
          collector_number: 'WTR167',
          edition: 'u',
          foiling: 's',
          rarity: 'c',
          language: 'en',
          image_url: 'https://img.example/p-1',
          tcg_low: 0.5,
          tcg_market: 2,
        },
      ]),
    );

    const response = await GET(get('/cards/search?q=snatch'), ctx({}));

    expect(mockAuth).toHaveBeenCalledWith(expect.anything(), 'cards:read');
    expect(mockSearch).toHaveBeenCalledWith(
      { name: 'snatch', frontFaceOnly: true },
      { limit: 50, page: 1 },
    );
    const body = await response.json();
    expect(body.data).toEqual([
      {
        printing_id: 'p-1',
        card_unique_id: 'c-1',
        name: 'Snatch',
        pitch: 1,
        set: 'wtr',
        collector_number: 'WTR167',
        edition: 'u',
        foiling: 's',
        rarity: 'c',
        language: 'en',
        image_url: 'https://img.example/p-1',
        price_usd: 0.5,
      },
    ]);
    expect(body.pagination).toEqual({ page: 1, limit: 50, total: 1, total_pages: 1 });
  });

  it('filters by set and collector number, capping the page size', async () => {
    mockSearch.mockResolvedValue(found([]));

    await GET(get('/cards/search?set=WTR&collector_number=wtr167&limit=999&page=3'), ctx({}));

    // A collector-number lookup must reach both faces of a double-faced card.
    expect(mockSearch).toHaveBeenCalledWith(
      { sets: ['wtr'], collectorNumber: 'WTR167' },
      { limit: 100, page: 3 },
    );
  });

  it('answers 400 when no filter is given', async () => {
    const response = await GET(get('/cards/search'), ctx({}));

    expect(response.status).toBe(400);
    expect(mockSearch).not.toHaveBeenCalled();
  });
});
