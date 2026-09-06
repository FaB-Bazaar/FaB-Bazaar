// lib/fab-constants/heroes.ts
// Public entry point for the hero constants module. Owns nicknames, lookup &
// display helpers, and cross-file queries. Re-exports sibling files so the
// legacy `@/lib/fab-constants/heroes` surface stays unchanged.

import {
  HERO_INFO,
  YOUNG_HERO_INFO,
  getHeroesGroupedByClass,
  getYoungHeroesGroupedByClass,
  type HeroInfo,
  type HeroEntry,
} from './heroes-rosters';

export * from './heroes-rosters';
export * from './heroes-meta';

// Hero nicknames mapping
export const HERO_NICKNAMES = {
  'slippy': 'Arakni, 5L!p3d 7hRu 7h3 cR4X',
  'huntsman': 'Arakni, Huntsman',
  'mario': 'Arakni, Marionette',
  'aurora': 'Aurora, Shooting Star',
  'azalea': 'Azalea, Ace in the Hole',
  'betsy': 'Betsy, Skin in the Game',
  'bravo': 'Bravo, Showstopper',
  'starvo': 'Bravo, Star of the Show',
  'briar': 'Briar, Warden of Thorns',
  'chane': 'Chane, Bound by Shadow',
  'cindra': 'Cindra, Dracai of Retribution',
  'dashio': 'Dash I/O',
  'dashie': 'Dash, Inventor Extraordinaire',
  'dori': 'Dorinthea Ironsong',
  'dromai': 'Dromai, Ash Artist',
  'enigma': 'Enigma, Ledger of Ancestry',
  'fai': 'Fai, Rising Rebellion',
  'fang': 'Fang, Dracai of Blades',
  'florian': 'Florian, Rotwood Harbinger',
  'gravy': 'Gravy Bones, Shipwrecked Looter',
  'hala': 'Hala, Bladesaint of the Vow',
  'ira': 'Ira, Scarlet Revenger',
  'iyslander': 'Iyslander, Stormbind',
  'jarl': 'Jarl Vetreiði',
  'kano': 'Kano, Dracai of Aether',
  'kassai': 'Kassai of the Golden Sand',
  'katsu': 'Katsu, the Wanderer',
  'kayo': 'Kayo, Armed and Dangerous',
  'levia': 'Levia, Shadowborn Abomination',
  'lexi': 'Lexi, Livewire',
  'lyath': 'Lyath Goldmane, Vile Savant',
  'marlynn': 'Marlynn, Treasure Hunter',
  'maxx': 'Maxx \'The Hype\' Nitro',
  'nuu': 'Nuu, Alluring Desire',
  'oldhim': 'Oldhim, Grandfather of Eternity',
  'olympia': 'Olympia, Prized Fighter',
  'oscilio': 'Oscilio, Constella Intelligence',
  'pleiades': 'Pleiades, Superstar',
  'prismaos': 'Prism, Awakener of Sol',
  'prismsoal': 'Prism, Sculptor of Arc Light',
  'puffin': 'Puffin, Hightail',
  'rhinar': 'Rhinar, Reckless Rampage',
  'riptide': 'Riptide, Lurker of the Deep',
  'rko': 'Kayo, Underhanded Cheat',
  'boltyn': 'Ser Boltyn, Breaker of Dawn',
  'teklo': 'Teklovossen, Esteemed Magnate',
  'tuffnut': 'Tuffnut, Bumbling Hulkster',
  'uzuri': 'Uzuri, Switchblade',
  'valda': 'Valda, Seismic Impact',
  'verdance': 'Verdance, Thorn of the Rose',
  'victor': 'Victor Goldmane, High and Mighty',
  'viserai': 'Viserai, Rune Blood',
  'vynnset': 'Vynnset, Iron Maiden',
  'zen': 'Zen, Tamer of Purpose'
} as const;

export interface ResourceLink {
  href: string;
  title: string;
  description: string;
  type: 'decklist' | 'video';
}

// Helper functions
export function getHeroInfo(nameOrNickname: string): HeroInfo | null {
  const lowerName = nameOrNickname.toLowerCase();

  if (HERO_INFO[lowerName]) return HERO_INFO[lowerName];
  if (YOUNG_HERO_INFO[lowerName]) return YOUNG_HERO_INFO[lowerName];

  const fullName = HERO_NICKNAMES[lowerName as keyof typeof HERO_NICKNAMES];
  if (fullName && HERO_INFO[fullName.toLowerCase()]) {
    return HERO_INFO[fullName.toLowerCase()];
  }

  for (const info of Object.values(HERO_INFO)) {
    if (info.shortName === lowerName) return info;
  }

  for (const info of Object.values(YOUNG_HERO_INFO)) {
    if (info.shortName === lowerName) return info;
  }

  return null;
}

// Canonical casing = the lowercase key used by HERO_INFO / YOUNG_HERO_INFO.
// Used on write paths (services, admin, MCP) so values stored in the DB match keys here.
export function normalizeHeroName(input?: string | null): string | null {
  if (input == null) return null;
  const key = input.trim().toLowerCase();
  if (!key) return null;
  if (HERO_INFO[key] || YOUNG_HERO_INFO[key]) return key;
  return input.trim();
}

export function normalizeClassName(input?: string | null): string | null {
  if (input == null) return null;
  const trimmed = input.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

// Properly-cased display name for a hero. Falls back to title-casing the canonical key
// if the hero has no shortName nickname mapping.
// Connectives stay lowercase in card names ("Warden of Thorns", "Ace in the
// Hole") — title-casing them makes fallback names look glitched next to
// nickname-mapped ones.
const LOWERCASE_NAME_WORDS = new Set(['of', 'the', 'in', 'and', 'a', 'an', 'to', 'by']);

export function toHeroDisplayName(canonicalKey: string, shortName?: string): string {
  if (shortName && HERO_NICKNAMES[shortName as keyof typeof HERO_NICKNAMES]) {
    return HERO_NICKNAMES[shortName as keyof typeof HERO_NICKNAMES];
  }
  return canonicalKey
    .split(' ')
    .map((w, i) => (i > 0 && LOWERCASE_NAME_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

// Segmented hero roster: adult (CC / Living Legend) and young (Silver Age / Blitz / Commoner),
// each grouped by class, with display names and short names attached.
export function getHeroesByFormatDetailed(): {
  adult: Record<string, HeroEntry[]>;
  young: Record<string, HeroEntry[]>;
} {
  const enrich = (
    grouped: Record<string, string[]>,
    source: Record<string, HeroInfo>,
  ): Record<string, HeroEntry[]> => {
    const out: Record<string, HeroEntry[]> = {};
    for (const [className, heroes] of Object.entries(grouped)) {
      out[className] = heroes.map(name => {
        const shortName = source[name]?.shortName;
        return { name, displayName: toHeroDisplayName(name, shortName), shortName };
      });
    }
    return out;
  };

  return {
    adult: enrich(getHeroesGroupedByClass(), HERO_INFO),
    young: enrich(getYoungHeroesGroupedByClass(), YOUNG_HERO_INFO),
  };
}

type HeroAge = 'young' | 'adult' | 'unknown';

function classifyHeroName(name: string): { age: HeroAge; canonical: string } {
  const lower = name.trim().toLowerCase();
  if (HERO_INFO[lower]) return { age: 'adult', canonical: lower };
  if (YOUNG_HERO_INFO[lower]) return { age: 'young', canonical: lower };

  const fullName = HERO_NICKNAMES[lower as keyof typeof HERO_NICKNAMES];
  if (fullName && HERO_INFO[fullName.toLowerCase()]) {
    return { age: 'adult', canonical: fullName.toLowerCase() };
  }

  for (const [key, info] of Object.entries(HERO_INFO)) {
    if (info.shortName === lower) return { age: 'adult', canonical: key };
  }
  for (const [key, info] of Object.entries(YOUNG_HERO_INFO)) {
    if (info.shortName === lower) return { age: 'young', canonical: key };
  }
  return { age: 'unknown', canonical: lower };
}

const FORMAT_HERO_REQUIREMENT: Record<string, HeroAge> = {
  silver_age: 'young',
  blitz: 'young',
  commoner: 'young',
  cc: 'adult',
  future_cc: 'adult',
  ll: 'adult',
};

const FORMAT_LABELS: Record<string, string> = {
  silver_age: 'Silver Age',
  blitz: 'Blitz',
  commoner: 'Commoner',
  cc: 'Classic Constructed',
  future_cc: 'Future Classic Constructed',
  ll: 'Living Legend',
};

// Validate that a hero is legal in the given format. Silver Age / Blitz / Commoner
// require a Young hero; CC / Living Legend require an adult hero. When the hero is
// the wrong age, the error includes a "did you mean" pointer to the paired name.
export function validateHeroFormatLegality(
  heroName: string,
  format: string | undefined
): { ok: true } | { ok: false; error: string } {
  if (!format) return { ok: true };
  const required = FORMAT_HERO_REQUIREMENT[format];
  if (!required) return { ok: true };

  const { age, canonical } = classifyHeroName(heroName);
  if (age === 'unknown' || age === required) return { ok: true };

  let suggestion: string | undefined;
  if (required === 'young') {
    const adultInfo = HERO_INFO[canonical];
    if (adultInfo && YOUNG_HERO_INFO[adultInfo.shortName]) {
      suggestion = adultInfo.shortName;
    }
  } else {
    const nick = HERO_NICKNAMES[canonical as keyof typeof HERO_NICKNAMES];
    if (nick && HERO_INFO[nick.toLowerCase()]) {
      suggestion = nick.toLowerCase();
    }
  }

  const label = FORMAT_LABELS[format] ?? format;
  const article = required === 'adult' ? 'an' : 'a';
  const did = suggestion ? ` Did you mean "${suggestion}"?` : '';
  return {
    ok: false,
    error: `"${heroName}" is not legal in ${format} (${label} requires ${article} ${required} hero).${did}`,
  };
}

// A hero "family" is the given name shared by every version of a hero
// (dorinthea ironsong + dorinthea, quicksilver prodigy → "dorinthea").
function heroFamily(rosterKey: string): string {
  return rosterKey.replace(/^ser /, '').split(/[, ]/)[0];
}

/**
 * Resolve a `hero:` token prefix to something getHeroInfo() understands.
 * Input that already resolves (full name, nickname, shortName) is returned
 * unchanged. Otherwise every roster key, shortName and nickname is prefix-
 * matched; if all hits belong to ONE hero family the first matching entry's
 * shortName is returned (`dor` → Dorinthea, `brav` → Bravo). Ambiguous
 * (`ka` → kano|kassai|katsu|kayo) or unknown input returns null.
 */
export function resolveHeroShorthand(input: string): string | null {
  const q = input.trim().toLowerCase();
  if (!q) return null;
  if (getHeroInfo(q)) return input.trim();

  const nickToKey = new Map<string, string>();
  for (const [nick, full] of Object.entries(HERO_NICKNAMES)) nickToKey.set(nick, full.toLowerCase());

  const families = new Set<string>();
  let first: string | null = null;
  const consider = (key: string, info: HeroInfo, extraAliases: string[]) => {
    const aliases = [key, info.shortName, ...extraAliases];
    if (!aliases.some(a => a.startsWith(q))) return;
    families.add(heroFamily(key));
    if (first === null) first = info.shortName;
  };
  for (const rosters of [HERO_INFO, YOUNG_HERO_INFO]) {
    for (const [key, info] of Object.entries(rosters)) {
      const nicks = [...nickToKey.entries()].filter(([, k]) => k === key).map(([n]) => n);
      consider(key, info, nicks);
    }
  }
  return families.size === 1 ? first : null;
}
