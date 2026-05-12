/**
 * Route unit tests for GET /api/heroes — public hero list keyed on DB legality flags.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/services', () => ({
  printingsService: { listHeroCards: vi.fn() },
}));

import { GET } from './route';
import { printingsService } from '@/lib/services';

const listHeroCards = vi.mocked(printingsService.listHeroCards);

function makeGet(url: string) {
  return new Request(url) as any;
}

describe('GET /api/heroes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listHeroCards.mockResolvedValue({
      success: true,
      data: [
        {
          cardUniqueId: 'h1',
          displayName: 'Brutus, Summa Rudis',
          imageUrl: null,
          types: ['adjudicator', 'hero'],
          klass: 'adjudicator',
          ccLegal: true,
          blitzLegal: false,
          silverAgeLegal: false,
          commonerLegal: false,
          llLegal: true,
        },
      ],
    } as any);
  });

  it('returns 200 with all heroes when no format is given', async () => {
    const res = await GET(makeGet('http://test/api/heroes'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(listHeroCards).toHaveBeenCalledWith();
  });

  it('returns 200 and forwards format=cc to the service', async () => {
    const res = await GET(makeGet('http://test/api/heroes?format=cc'));
    expect(res.status).toBe(200);
    expect(listHeroCards).toHaveBeenCalledWith({ legalIn: 'cc' });
  });

  it('returns 200 and forwards format=silver_age to the service', async () => {
    const res = await GET(makeGet('http://test/api/heroes?format=silver_age'));
    expect(res.status).toBe(200);
    expect(listHeroCards).toHaveBeenCalledWith({ legalIn: 'silver_age' });
  });

  it('returns 400 on an invalid format value', async () => {
    const res = await GET(makeGet('http://test/api/heroes?format=bogus'));
    expect(res.status).toBe(400);
    expect(listHeroCards).not.toHaveBeenCalled();
  });

  it('returns 500 when the service fails', async () => {
    listHeroCards.mockResolvedValue({ success: false, error: 'db down' } as any);
    const res = await GET(makeGet('http://test/api/heroes?format=cc'));
    expect(res.status).toBe(500);
  });
});
