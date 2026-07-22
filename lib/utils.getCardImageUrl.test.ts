/**
 * getCardImageUrl must never construct printing_id-keyed CDN URLs —
 * those Cloudflare images were deleted 2026-07, so a constructed
 * <CF>/<printingId>/public link can only 404 (broken-image icon).
 * Cards without a stored image_url get the cardback placeholder instead.
 */

import { describe, it, expect } from 'vitest';
import { getCardImageUrl } from './utils';

const CARDBACK = '/cardback.webp';

describe('getCardImageUrl', () => {
  it('prefers the nested printingDetails.image_url', () => {
    expect(
      getCardImageUrl({
        printingDetails: { image_url: 'https://img/nested.png' },
        image_url: 'https://img/top.png',
        printingId: 'abc123',
      })
    ).toBe('https://img/nested.png');
  });

  it('falls back to the top-level image_url', () => {
    expect(
      getCardImageUrl({ image_url: 'https://img/top.png', printingId: 'abc123' })
    ).toBe('https://img/top.png');
  });

  it('returns the cardback for a printingId-only object (no constructed CDN URL)', () => {
    const url = getCardImageUrl({ printingId: 'cLHGKMCjPb89zwNPmMFBp' });
    expect(url).toBe(CARDBACK);
  });

  it('returns the cardback for id / printingDetails.printing_id-only shapes', () => {
    expect(getCardImageUrl({ id: 'cLHGKMCjPb89zwNPmMFBp' })).toBe(CARDBACK);
    expect(
      getCardImageUrl({ printingDetails: { printing_id: 'cLHGKMCjPb89zwNPmMFBp' } })
    ).toBe(CARDBACK);
  });

  it('returns the cardback for null/undefined/empty input', () => {
    expect(getCardImageUrl(null)).toBe(CARDBACK);
    expect(getCardImageUrl(undefined)).toBe(CARDBACK);
    expect(getCardImageUrl({})).toBe(CARDBACK);
  });

  it('ignores non-http image_url values', () => {
    expect(getCardImageUrl({ image_url: 'not-a-url' })).toBe(CARDBACK);
  });
});
