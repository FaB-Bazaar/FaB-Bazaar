// app/api/mcp/resource/heroesByFormat.ts
//
// fab://heroes-by-format — DB-derived, Redis-cached projection of which heroes are
// legal in which format, split into adult vs young.
//
// Source of truth is the `cards` table legality flags (cc_legal, silver_age_legal, …),
// NEVER a hardcoded roster: format legality rotates as heroes graduate to Living Legend
// and new sets release (e.g. adult Oldhim is ll_legal but no longer cc_legal). Derive,
// don't hardcode. See lib/fab-constants/CLAUDE.md.

import { getRedisClient } from '@/lib/redis';
import type { HeroLegalityRow } from '@/lib/services/contracts/IPrintingsService';

const CACHE_KEY = 'mcp:heroes-by-format:v1';
const CACHE_TTL_SECONDS = 86400; // 24h — legality only changes on the nightly pipeline

export type HeroFormatKey = 'cc' | 'blitz' | 'silver_age' | 'commoner' | 'll';

interface HeroEntry {
  name: string; // lowercase canonical — pass to search_printings heroLegal
  displayName: string;
  classes: string[];
}

type HeroesByFormat = Record<HeroFormatKey, { adult: HeroEntry[]; young: HeroEntry[] }>;

// format key → the HeroLegalityRow boolean that marks legality in that format
const FORMAT_FLAGS: Array<[HeroFormatKey, keyof HeroLegalityRow]> = [
  ['cc', 'ccLegal'],
  ['blitz', 'blitzLegal'],
  ['silver_age', 'silverAgeLegal'],
  ['commoner', 'commonerLegal'],
  ['ll', 'llLegal'],
];

const toEntry = (r: HeroLegalityRow): HeroEntry => ({
  name: r.name,
  displayName: r.displayName,
  // listHeroCards projects the card's class array down to a single `klass`.
  classes: r.klass ? [r.klass] : [],
});

const byDisplayName = (a: HeroEntry, b: HeroEntry) => a.displayName.localeCompare(b.displayName);

/**
 * Pure grouping: bucket hero rows by format legality, splitting each format into
 * adult vs young (the `young` marker lives in the `types` array — the DB has no
 * separate column). A hero appears under a format only if it is legal there now.
 */
export function groupHeroesByFormat(rows: HeroLegalityRow[]): HeroesByFormat {
  const result = {} as HeroesByFormat;
  for (const [fmt, flag] of FORMAT_FLAGS) {
    const legal = rows.filter(r => r[flag] === true);
    const young = legal.filter(r => (r.types ?? []).includes('young'));
    const adult = legal.filter(r => !(r.types ?? []).includes('young'));
    result[fmt] = {
      adult: adult.map(toEntry).sort(byDisplayName),
      young: young.map(toEntry).sort(byDisplayName),
    };
  }
  return result;
}

async function buildPayload() {
  // Lazy import to keep this off the service-layer circular-dep graph (see CLAUDE.md).
  const { printingsService } = await import('@/lib/services');
  const result = await printingsService.listHeroCards();
  const rows = result.success ? result.data : [];

  return {
    _source:
      'Derived live from the cards table legality flags (silver_age_legal, cc_legal, …) — NEVER hardcoded. Legality rotates (heroes graduate to Living Legend, new sets release); trust this over any static roster.',
    _usage:
      'Build a hero deck pool with search_printings → heroLegal:"<name>" + format:"<format>". Use the lowercase `name` field here for heroLegal. A hero is listed under a format only if it is legal there right now (e.g. young Oldhim appears under silver_age, adult "Oldhim, Grandfather of Eternity" under ll).',
    lastUpdated: new Date().toISOString(),
    formats: groupHeroesByFormat(rows),
  };
}

export const heroesByFormatResource = {
  type: 'resource' as const,
  uri: 'fab://heroes-by-format',
  name: 'heroes_by_format_legality',
  description:
    'DB-derived list of heroes legal in each format (cc, blitz, silver_age, commoner, ll), split into adult vs young. Use to validate hero+format combos and to pick the right heroLegal name. Source of truth — never hardcoded.',
  mimeType: 'application/json',

  handler: async () => {
    const redis = getRedisClient();
    if (redis) {
      try {
        const cached = await redis.get(CACHE_KEY);
        if (cached) return JSON.parse(cached);
      } catch (err) {
        console.error('[heroes-by-format] Redis read error:', err);
      }
    }

    const payload = await buildPayload();

    if (redis) {
      try {
        await redis.set(CACHE_KEY, JSON.stringify(payload), 'EX', CACHE_TTL_SECONDS);
      } catch (err) {
        console.error('[heroes-by-format] Redis write error:', err);
      }
    }

    return payload;
  },
};
