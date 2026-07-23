/**
 * Regression: chip icon URLs must use the NEW deterministic image ids
 * (LSS print-code style, e.g. WTR159-UL or JA_MST096-CF-FA), never the old
 * printing_id-keyed CDN ids — those images were deleted in the 2026-07
 * image-id migration and 404 (see "Card image ids derive from printing
 * characteristics" in CLAUDE.md). The type/class chips rendered as empty
 * boxes on /opt because of exactly this.
 */
import { describe, it, expect } from 'vitest';
import {
  TYPE_CHIPS, GENERIC_CHIP, CLASS_ICONS, KEYWORD_CHIPS, HERO_AGE_CHIPS,
} from './card-filter-chips';

// Deterministic ids: optional language prefix, print code (set + collector),
// optional _BACK face marker, then foiling/edition/art suffixes.
const DETERMINISTIC_ID = /^([A-Z]{2}_)?[0-9]?[A-Z]{2,5}[0-9]{3}(_BACK)?(-[A-Z0-9]{1,4})*$/;

const allIconUrls = (): Array<[string, string]> => {
  const out: Array<[string, string]> = [];
  TYPE_CHIPS.forEach((c) => c.iconUrl && out.push([`type:${c.value}`, c.iconUrl]));
  if (GENERIC_CHIP.iconUrl) out.push(['type:generic', GENERIC_CHIP.iconUrl]);
  Object.entries(CLASS_ICONS).forEach(([k, v]) => out.push([`class:${k}`, v.iconUrl]));
  KEYWORD_CHIPS.forEach((c) => c.iconUrl && out.push([`keyword:${c.value}`, c.iconUrl]));
  HERO_AGE_CHIPS.forEach((c) => out.push([`heroAge:${c.value}`, c.iconUrl]));
  return out;
};

describe('chip icon CDN ids', () => {
  it('every imagedelivery iconUrl uses a deterministic image id, not a printing_id', () => {
    const offenders = allIconUrls()
      .filter(([, url]) => url.includes('imagedelivery.net'))
      .map(([key, url]) => [key, url.match(/imagedelivery\.net\/[^/]+\/([^/]+)\/public/)?.[1] ?? ''] as const)
      .filter(([, id]) => !DETERMINISTIC_ID.test(id));
    expect(offenders).toEqual([]);
  });

  it('covers a meaningful number of icons (guard against the walker going stale)', () => {
    expect(allIconUrls().length).toBeGreaterThan(40);
  });
});
