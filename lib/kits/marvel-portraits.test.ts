// lib/kits/marvel-portraits.test.ts
//
// The kits pages prefer Marvel (cold foil) artwork for hero portraits.
// Marvel image URLs MUST come from the printing row's image_url — the old
// printing_id-keyed Cloudflare images were deleted, so any URL constructed
// as <CF_BASE>/<printing_id>/public 404s (the /kits broken-portrait bug).

import { describe, it, expect, vi } from 'vitest';
import { resolveMarvelPortraitUrls } from './marvel-portraits';
import { HERO_MARVEL_PRINTING_IDS } from '@/lib/fab-constants/heroes';

const HUNTSMAN_ID = HERO_MARVEL_PRINTING_IDS['arakni, huntsman'];
const BETSY_ID = HERO_MARVEL_PRINTING_IDS['betsy, skin in the game'];

function mockService(printings: Array<{ printing_id: string; image_url: string }>) {
  return {
    getPrintingsByIds: vi.fn().mockResolvedValue({
      success: true,
      data: { printings, total: printings.length, page: 1, pages: 1, queryInfo: { executionTime: 0, filters: {} } },
    }),
  };
}

describe('resolveMarvelPortraitUrls', () => {
  it('maps hero names to the DB image_url of their Marvel printing', async () => {
    const service = mockService([
      { printing_id: HUNTSMAN_ID, image_url: 'https://imagedelivery.net/acct/EN_5EV001-CF/public' },
    ]);
    const urls = await resolveMarvelPortraitUrls(['Arakni, Huntsman'], service);
    expect(urls.get('Arakni, Huntsman')).toBe('https://imagedelivery.net/acct/EN_5EV001-CF/public');
  });

  it('never constructs a URL from the printing_id itself', async () => {
    const service = mockService([
      { printing_id: HUNTSMAN_ID, image_url: 'https://imagedelivery.net/acct/EN_5EV001-CF/public' },
    ]);
    const urls = await resolveMarvelPortraitUrls(['Arakni, Huntsman'], service);
    for (const url of urls.values()) {
      expect(url).not.toContain(HUNTSMAN_ID);
    }
  });

  it('requests only the Marvel printing ids for the given heroes, with a matching limit', async () => {
    const service = mockService([]);
    await resolveMarvelPortraitUrls(
      ['Arakni, Huntsman', 'Betsy, Skin in the Game', 'Rhinar, Reckless Rampage'],
      service
    );
    // Rhinar has no Marvel entry — only two ids requested; explicit limit
    // guards against the search default (50) silently truncating large rosters.
    expect(service.getPrintingsByIds).toHaveBeenCalledWith(
      expect.arrayContaining([HUNTSMAN_ID, BETSY_ID]),
      expect.objectContaining({ limit: 2 })
    );
    expect(service.getPrintingsByIds.mock.calls[0][0]).toHaveLength(2);
  });

  it('omits heroes whose printing row has no image_url (caller keeps fallback art)', async () => {
    const service = mockService([{ printing_id: HUNTSMAN_ID, image_url: '' }]);
    const urls = await resolveMarvelPortraitUrls(['Arakni, Huntsman'], service);
    expect(urls.has('Arakni, Huntsman')).toBe(false);
  });

  it('does not call the service when no hero has a Marvel printing', async () => {
    const service = mockService([]);
    const urls = await resolveMarvelPortraitUrls(['Rhinar, Reckless Rampage'], service);
    expect(urls.size).toBe(0);
    expect(service.getPrintingsByIds).not.toHaveBeenCalled();
  });

  it('returns an empty map on service failure', async () => {
    const service = {
      getPrintingsByIds: vi.fn().mockResolvedValue({ success: false, error: 'db down' }),
    };
    const urls = await resolveMarvelPortraitUrls(['Arakni, Huntsman'], service);
    expect(urls.size).toBe(0);
  });
});
