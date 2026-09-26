/**
 * The /opt searches the nightly cache warm-up loads (POST /api/cron/warm-search-cache):
 * every class and talent, the class + talent pairs heroes play, the newest
 * sets, Armory decks and GEM pack. "Newest" comes from the sets table at run
 * time so a release never needs a code change here.
 */

import { HERO_CLASSES } from '@/lib/fab-constants/classes';
import { HERO_INFO, YOUNG_HERO_INFO } from '@/lib/fab-constants/heroes-rosters';
import { OFFICIAL_TALENTS } from '@/lib/talent-constants';
import type { SetDTO } from '@/lib/services/contracts/ISetsService';

const RECENT_STANDARD_SETS = 5;
const RECENT_ARMORY_DECKS = 2;
const CARD_SORTS = ['', 'rarity'];
const SET_SORTS = ['', 'rarity', 'set'];

/** Newest-first sets of one category that have already released. */
function released(sets: SetDTO[], category: SetDTO['category'], today: string, n: number): string[] {
  return sets
    .filter((s) => s.category === category && s.releaseDate !== null && s.releaseDate <= today)
    .sort((a, b) => b.releaseDate!.localeCompare(a.releaseDate!) || b.releaseOrder - a.releaseOrder)
    .slice(0, n)
    .map((s) => s.code);
}

/** Class + talent pairs from the hero rosters — the searches for a hero's pool. */
function heroPairs(): Array<[string, string]> {
  const seen = new Set<string>();
  for (const hero of [...Object.values(HERO_INFO), ...Object.values(YOUNG_HERO_INFO)]) {
    for (const c of hero.classes ?? []) for (const t of hero.talents ?? []) seen.add(`${c}|${t}`);
  }
  return [...seen].sort().map((p) => p.split('|') as [string, string]);
}

/** /opt URL query strings (no leading '?'), each in every sort it's warmed in. */
export function buildWarmTargets(p: {
  sets: SetDTO[];
  /** printingsService.getSetGroups('gem'), release order (newest last). */
  gemPacks: Array<{ groupId: number }>;
  /** YYYY-MM-DD */
  today: string;
}): string[] {
  const out = new Set<string>();
  const add = (params: Record<string, string>, sorts: string[]) => {
    for (const sortBy of sorts) {
      const q = new URLSearchParams(params);
      if (sortBy) q.set('sortBy', sortBy);
      out.add(q.toString());
    }
  };

  for (const c of ['generic', ...HERO_CLASSES]) add({ classes: c }, CARD_SORTS);
  for (const t of OFFICIAL_TALENTS) add({ talents: t }, CARD_SORTS);
  for (const [c, t] of heroPairs()) add({ classes: c, talents: t }, CARD_SORTS);

  for (const code of released(p.sets, 'standard', p.today, RECENT_STANDARD_SETS)) add({ sets: code }, SET_SORTS);
  add({ sets: 'grp:armory' }, SET_SORTS);
  for (const code of released(p.sets, 'armory', p.today, RECENT_ARMORY_DECKS)) add({ sets: code }, SET_SORTS);
  add({ sets: 'gem' }, SET_SORTS);
  const newestPack = p.gemPacks[p.gemPacks.length - 1];
  if (newestPack) add({ sets: 'gem', pack: String(newestPack.groupId) }, SET_SORTS);

  return [...out];
}
