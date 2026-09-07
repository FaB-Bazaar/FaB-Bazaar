// lib/fab-constants/keywords.ts
// Game keywords and abilities

export const KEYWORDS = [
  'ambush',
  'amp',
  'arcane barrier',
  'arcane shelter',
  'awaken',
  'battleworn',
  'beat chest',
  'blade break',
  'blood debt',
  'bond',
  'boost',
  'channel',
  'charge',
  'clash',
  'cloaked',
  'combo',
  'contract',
  'crank',
  'crush',
  'decompose',
  'dominate',
  'ephemeral',
  'essence',
  'evo upgrade',
  'flow',
  'freeze',
  'fusion',
  'galvanize',
  'go fish',
  'go again',
  'guardwell',
  'heave',
  'heavy',
  'high tide',
  'intimidate',
  'legendary',
  'mark',
  'material',
  'meld',
  'mirage',
  'modular',
  'negate',
  'opt',
  'overpower',
  'pairs',
  'phantasm',
  'piercing',
  'protect',
  'quell',
  'reload',
  'reprise',
  'retrieve',
  'rune gate',
  'rupture',
  'scrap',
  'sharpen',
  'solflare',
  'specialization',
  'spectra',
  'spellvoid',
  'steal',
  'stealth',
  'surge',
  'suspense',
  'temper',
  'the crowd boos',
  'the crowd cheers',
  'tower',
  'transcend',
  'transform',
  'unfreeze',
  'unity',
  'universal',
  'unlimited',
  'wager',
  'ward',
  'watery grave'
] as const;

export type Keyword = typeof KEYWORDS[number];

/**
 * Community shorthand for the most-typed keywords, expanded by BOTH shorthand
 * parsers' `k:` / `keyword:` handlers (`k:ga` → "go again"). Bare `ga`/`dom` in
 * name text is expanded separately by each parser's name-expansion table.
 */
export const KEYWORD_ALIASES: Record<string, string> = {
  ga: 'go again',
  dom: 'dominate',
};

export function expandKeywordAlias(keyword: string): string {
  const k = keyword.trim().toLowerCase();
  return KEYWORD_ALIASES[k] ?? k;
}
