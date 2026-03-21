// lib/fab-constants/sets.ts
// Set codes, names, and metadata including release dates

export const SET_MAP = {
  // Core sets
  'wtr': 'Welcome to Rathe',
  'arc': 'Arcane Rising',
  'cru': 'Crucible of War',
  'mon': 'Monarch',
  'ele': 'Tales of Aria',
  'evr': 'Everfest',
  'upr': 'Uprising',
  '1hp': 'History Pack Vol.1',
  'dyn': 'Dynasty',
  'out': 'Outsiders',
  'dtd': 'Dusk till Dawn',
  'evo': 'Bright Lights',
  'hvy': 'Heavy Hitters',
  'mst': 'Part the Mistveil',
  'ros': 'Rosetta',
  'hnt': 'The Hunted',
  'sea': 'High Seas',
  'mpg': 'Mastery Pack Guardian',
  'sup': 'Super Slam',
  'pen': 'Compendium of Rathe',
  'anq': 'Antiquity Pack',

  // History/Classic Packs
  'dvr': 'Classic Battles: Rhinar vs Dorinthea',
  'aur': '1st Strike',

  // Promo sets
  'fab': 'Flesh and Blood: Promo Cards',
  'gem': 'GEM Pack 2',
  'tcc': 'Round the Table: TCCxLSS',

  // Welcome/Hero Decks
  'ira': 'Welcome Deck: Ira',
  'bvo': 'Hero Deck: Bravo',
  'rnr': 'Hero Deck: Rhinar',
  'ksu': 'Hero Deck: Katsu',
  'tea': 'Hero Deck: Dorinthea',

  // Blitz Decks - Monarch
  'psm': 'Blitz Deck: Monarch - Prism',
  'bol': 'Blitz Deck: Monarch - Boltyn',
  'chn': 'Blitz Deck: Monarch - Chane',
  'lev': 'Blitz Deck: Monarch - Levia',

  // Blitz Decks - Tales of Aria
  'lxi': 'Blitz Deck: Tales of Aria - Lexi',
  'old': 'Blitz Deck: Tales of Aria - Oldhim',
  'bri': 'Blitz Deck: Tales of Aria - Briar',

  // Blitz Decks - Uprising
  'fai': 'Blitz Deck: Uprising - Fai',
  'dro': 'Blitz Deck: Uprising - Dromai',

  // Blitz Decks - Outsiders
  'ara': 'Blitz Deck: Outsiders - Arakni',
  'azl': 'Blitz Deck: Outsiders - Azalea',
  'ben': 'Blitz Deck: Outsiders - Benji',
  'kat': 'Blitz Deck: Outsiders - Katsu',
  'rip': 'Blitz Deck: Outsiders - Riptide',
  'uzu': 'Blitz Deck: Outsiders - Uzuri',

  // Blitz Decks - Heavy Hitters
  'ksi': 'Blitz Deck: Heavy Hitters - Kassai',
  'kyo': 'Blitz Deck: Heavy Hitters - Kayo',
  'rhi': 'Blitz Deck: Heavy Hitters - Rhinar',
  'bet': 'Blitz Deck: Heavy Hitters - Betsy',
  'ola': 'Blitz Deck: Heavy Hitters - Olympia',
  'vic': 'Blitz Deck: Heavy Hitters - Victor',

  // Blitz Decks - Part the Mistveil
  'eng': 'Blitz Deck: Part the Mistveil - Enigma',
  'nuu': 'Blitz Deck: Part the Mistveil - Nuu',
  'zen': 'Blitz Deck: Part the Mistveil - Zen',

  // Blitz Decks - Rosetta
  'flr': 'Blitz Deck: Rosetta - Florian',
  'aua': 'Blitz Deck: Rosetta - Aurora',
  'osc': 'Blitz Deck: Rosetta - Oscilio',
  'ver': 'Blitz Deck: Rosetta - Verdance',

  // Blitz Decks - The Hunted
  'ark': 'Blitz Deck: The Hunted - Arakni',
  'fng': 'Blitz Deck: The Hunted - Fang',
  'wod': 'Blitz Deck: The Hunted - Arakni, Web of Deceit',
  'cin': 'Blitz Deck: The Hunted - Cindra',

  // Historic Pack Blitz Decks
  '1hb': 'Historic Pack 1 Blitz Deck: Bravo',
  '1hd': 'Historic Pack 1 Blitz Deck: Dash',
  '1ht': 'Historic Pack 1 Blitz Deck: Dorinthea',
  '1hk': 'Historic Pack 1 Blitz Deck: Kano',
  '1hr': 'Historic Pack 1 Blitz Deck: Rhinar',
  '1hv': 'Historic Pack 1 Blitz Deck: Viserai',

  // Armory Decks
  'ako': 'Armory Deck: Kayo',
  'asb': 'Armory Deck: Boltyn',
  'aaz': 'Armory Deck: Azalea',
  'aio': 'Armory Deck: Dash',
  'ajv': 'Armory Deck: Jarl Vetreidi',
  'ast': 'Armory Deck: Aurora',
  'amx': 'Armory Deck: Maxx Nitro',
  'agb': 'Armory Deck: Gravy Bones',
  'asr': 'Armory Deck: Ira',
  'aps': 'Armory Deck: Pleiades',
} as const;

export type SetCode = keyof typeof SET_MAP;

/**
 * Ordered list of set codes shown in binder and search filter UIs.
 * Update this single list when new sets are released — all filter components import from here.
 */
export const CARD_FILTER_SETS = [
  'wtr', 'arc', 'cru', 'mon', 'ele', 'evr', 'upr', '1hp', 'dyn', 'out',
  'dtd', 'evo', 'hvy', 'mst', 'ros', 'hnt', 'sea', 'mpg', 'sup', 'pen', 'anq',
] as const;

export type CardFilterSet = typeof CARD_FILTER_SETS[number];

// Set metadata including release dates
export interface SetMetadata {
  code: string;
  name: string;
  releaseDate: string; // YYYY-MM-DD format
  hasFirstEdition: boolean;
  category: 'standard' | 'armory' | 'non-standard' | 'excluded';
  defaultRarity?: string;
  /**
   * Printing display tier — controls order within a card's printing carousel.
   * 1 = main booster sets (WTR, MON, OUT, SEA…)
   * 2 = standalone supplemental products (History Pack, Compendium, Antiquity…)
   * 3 = blitz / hero decks
   * 4 = armory decks
   * 5 = promos / non-standard
   * Display order: 1 → 2 → 5 → 3 → 4
   */
  tier: 1 | 2 | 3 | 4 | 5;
}

export const SET_METADATA: Record<string, SetMetadata> = {
  // ── Tier 1: Main booster sets ─────────────────────────────────────────────

  // 2019
  wtr: { code: 'WTR', name: 'Welcome to Rathe',    releaseDate: '2019-10-11', hasFirstEdition: true,  category: 'standard',     tier: 1 },

  // 2020
  arc: { code: 'ARC', name: 'Arcane Rising',        releaseDate: '2020-03-27', hasFirstEdition: true,  category: 'standard',     tier: 1 },
  cru: { code: 'CRU', name: 'Crucible of War',      releaseDate: '2020-08-28', hasFirstEdition: true,  category: 'standard',     tier: 1 },

  // 2021
  mon: { code: 'MON', name: 'Monarch',              releaseDate: '2021-05-07', hasFirstEdition: true,  category: 'standard',     tier: 1 },
  ele: { code: 'ELE', name: 'Tales of Aria',        releaseDate: '2021-09-24', hasFirstEdition: true,  category: 'standard',     tier: 1 },

  // 2022
  evr: { code: 'EVR', name: 'Everfest',             releaseDate: '2022-02-04', hasFirstEdition: false, category: 'standard',     tier: 1 },
  upr: { code: 'UPR', name: 'Uprising',             releaseDate: '2022-06-24', hasFirstEdition: false, category: 'standard',     tier: 1 },
  dyn: { code: 'DYN', name: 'Dynasty',              releaseDate: '2022-11-11', hasFirstEdition: false, category: 'standard',     tier: 1 },

  // 2023
  out: { code: 'OUT', name: 'Outsiders',            releaseDate: '2023-03-24', hasFirstEdition: false, category: 'standard',     tier: 1 },
  dtd: { code: 'DTD', name: 'Dusk till Dawn',       releaseDate: '2023-07-14', hasFirstEdition: false, category: 'standard',     tier: 1 },

  // 2024
  hvy: { code: 'HVY', name: 'Heavy Hitters',        releaseDate: '2024-02-02', hasFirstEdition: false, category: 'standard',     tier: 1 },
  mst: { code: 'MST', name: 'Part the Mistveil',    releaseDate: '2024-05-31', hasFirstEdition: false, category: 'standard',     tier: 1 },
  ros: { code: 'ROS', name: 'Rosetta',              releaseDate: '2024-09-20', hasFirstEdition: false, category: 'standard',     tier: 1 },

  // 2025
  hnt: { code: 'HNT', name: 'The Hunted',           releaseDate: '2025-01-31', hasFirstEdition: false, category: 'standard',     tier: 1, defaultRarity: 'L' },
  sea: { code: 'SEA', name: 'High Seas',            releaseDate: '2025-06-06', hasFirstEdition: false, category: 'standard',     tier: 1, defaultRarity: 'L' },

  // 2026
  pen: { code: 'PEN', name: 'Compendium of Rathe',  releaseDate: '2026-02-13', hasFirstEdition: false, category: 'standard',     tier: 2 },
  anq: { code: 'ANQ', name: 'Antiquity Pack',       releaseDate: '2026-02-13', hasFirstEdition: false, category: 'standard',     tier: 2 },

  // ── Tier 2: Supplemental standalone products ──────────────────────────────
  '1hp': { code: '1HP', name: 'History Pack 1',     releaseDate: '2022-05-06', hasFirstEdition: false, category: 'standard',     tier: 2 },
  dvr:  { code: 'DVR', name: 'Classic Battles: Rhinar vs Dorinthea', releaseDate: '2022-08-05', hasFirstEdition: false, category: 'non-standard', tier: 2 },
  aur:  { code: 'AUR', name: '1st Strike',          releaseDate: '2022-11-04', hasFirstEdition: false, category: 'non-standard', tier: 2 },

  // ── Tier 3: Blitz decks & Hero decks ─────────────────────────────────────

  // Welcome / Hero Decks (2019–2020)
  ira:  { code: 'IRA', name: 'Welcome Deck: Ira',         releaseDate: '2019-08-31', hasFirstEdition: false, category: 'excluded',     tier: 3 },
  bvo:  { code: 'BVO', name: 'Hero Deck: Bravo',          releaseDate: '2020-01-01', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  rnr:  { code: 'RNR', name: 'Hero Deck: Rhinar',         releaseDate: '2020-01-01', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  ksu:  { code: 'KSU', name: 'Hero Deck: Katsu',          releaseDate: '2020-01-01', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  tea:  { code: 'TEA', name: 'Hero Deck: Dorinthea',      releaseDate: '2020-01-01', hasFirstEdition: false, category: 'non-standard', tier: 3 },

  // Blitz Decks — Monarch (2021)
  psm:  { code: 'PSM', name: 'Blitz Deck: Prism',         releaseDate: '2021-05-07', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  bol:  { code: 'BOL', name: 'Blitz Deck: Boltyn',        releaseDate: '2021-05-07', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  chn:  { code: 'CHN', name: 'Blitz Deck: Chane',         releaseDate: '2021-05-07', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  lev:  { code: 'LEV', name: 'Blitz Deck: Levia',         releaseDate: '2021-05-07', hasFirstEdition: false, category: 'non-standard', tier: 3 },

  // Blitz Decks — Tales of Aria (2021)
  lxi:  { code: 'LXI', name: 'Blitz Deck: Lexi',          releaseDate: '2021-09-24', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  old:  { code: 'OLD', name: 'Blitz Deck: Oldhim',        releaseDate: '2021-09-24', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  bri:  { code: 'BRI', name: 'Blitz Deck: Briar',         releaseDate: '2021-09-24', hasFirstEdition: false, category: 'non-standard', tier: 3 },

  // Historic Pack 1 Blitz Decks (2022)
  '1hb': { code: '1HB', name: 'HP1 Blitz Deck: Bravo',     releaseDate: '2022-05-06', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  '1hd': { code: '1HD', name: 'HP1 Blitz Deck: Dash',      releaseDate: '2022-05-06', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  '1ht': { code: '1HT', name: 'HP1 Blitz Deck: Dorinthea', releaseDate: '2022-05-06', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  '1hk': { code: '1HK', name: 'HP1 Blitz Deck: Kano',      releaseDate: '2022-05-06', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  '1hr': { code: '1HR', name: 'HP1 Blitz Deck: Rhinar',    releaseDate: '2022-05-06', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  '1hv': { code: '1HV', name: 'HP1 Blitz Deck: Viserai',   releaseDate: '2022-05-06', hasFirstEdition: false, category: 'non-standard', tier: 3 },

  // Blitz Decks — Uprising (2022)
  fai:  { code: 'FAI', name: 'Blitz Deck: Fai',            releaseDate: '2022-06-24', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  dro:  { code: 'DRO', name: 'Blitz Deck: Dromai',         releaseDate: '2022-06-24', hasFirstEdition: false, category: 'non-standard', tier: 3 },

  // Blitz Decks — Outsiders (2023)
  ara:  { code: 'ARA', name: 'Blitz Deck: Arakni',         releaseDate: '2023-03-24', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  azl:  { code: 'AZL', name: 'Blitz Deck: Azalea',         releaseDate: '2023-03-24', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  ben:  { code: 'BEN', name: 'Blitz Deck: Benji',          releaseDate: '2023-03-24', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  kat:  { code: 'KAT', name: 'Blitz Deck: Katsu',          releaseDate: '2023-03-24', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  rip:  { code: 'RIP', name: 'Blitz Deck: Riptide',        releaseDate: '2023-03-24', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  uzu:  { code: 'UZU', name: 'Blitz Deck: Uzuri',          releaseDate: '2023-03-24', hasFirstEdition: false, category: 'non-standard', tier: 3 },

  // Blitz Decks — Heavy Hitters (2024)
  ksi:  { code: 'KSI', name: 'Blitz Deck: Kassai',         releaseDate: '2024-02-02', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  kyo:  { code: 'KYO', name: 'Blitz Deck: Kayo',           releaseDate: '2024-02-02', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  rhi:  { code: 'RHI', name: 'Blitz Deck: Rhinar',         releaseDate: '2024-02-02', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  bet:  { code: 'BET', name: 'Blitz Deck: Betsy',          releaseDate: '2024-02-02', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  ola:  { code: 'OLA', name: 'Blitz Deck: Olympia',        releaseDate: '2024-02-02', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  vic:  { code: 'VIC', name: 'Blitz Deck: Victor',         releaseDate: '2024-02-02', hasFirstEdition: false, category: 'non-standard', tier: 3 },

  // Blitz Decks — Part the Mistveil (2024)
  eng:  { code: 'ENG', name: 'Blitz Deck: Enigma',         releaseDate: '2024-05-31', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  nuu:  { code: 'NUU', name: 'Blitz Deck: Nuu',            releaseDate: '2024-05-31', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  zen:  { code: 'ZEN', name: 'Blitz Deck: Zen',            releaseDate: '2024-05-31', hasFirstEdition: false, category: 'non-standard', tier: 3 },

  // Blitz Decks — Rosetta (2024)
  flr:  { code: 'FLR', name: 'Blitz Deck: Florian',        releaseDate: '2024-09-20', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  aua:  { code: 'AUA', name: 'Blitz Deck: Aurora',         releaseDate: '2024-09-20', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  osc:  { code: 'OSC', name: 'Blitz Deck: Oscilio',        releaseDate: '2024-09-20', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  ver:  { code: 'VER', name: 'Blitz Deck: Verdance',       releaseDate: '2024-09-20', hasFirstEdition: false, category: 'non-standard', tier: 3 },

  // Blitz Decks — The Hunted (2025)
  ark:  { code: 'ARK', name: 'Blitz Deck: Arakni',                 releaseDate: '2025-01-31', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  fng:  { code: 'FNG', name: 'Blitz Deck: Fang',                   releaseDate: '2025-01-31', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  wod:  { code: 'WOD', name: 'Blitz Deck: Arakni, Web of Deceit',  releaseDate: '2025-01-31', hasFirstEdition: false, category: 'non-standard', tier: 3 },
  cin:  { code: 'CIN', name: 'Blitz Deck: Cindra',                 releaseDate: '2025-01-31', hasFirstEdition: false, category: 'non-standard', tier: 3 },

  // ── Tier 4: Armory decks ──────────────────────────────────────────────────
  evo:  { code: 'EVO', name: 'Bright Lights',              releaseDate: '2022-05-27', hasFirstEdition: false, category: 'armory',       tier: 4 },
  asr:  { code: 'ASR', name: 'Armory Deck: Ira',           releaseDate: '2019-10-11', hasFirstEdition: false, category: 'armory',       tier: 4 },
  aaz:  { code: 'AAZ', name: 'Armory Deck: Azalea',        releaseDate: '2020-06-01', hasFirstEdition: false, category: 'armory',       tier: 4 },
  aio:  { code: 'AIO', name: 'Armory Deck: Dash',          releaseDate: '2020-10-01', hasFirstEdition: false, category: 'armory',       tier: 4 },
  asb:  { code: 'ASB', name: 'Armory Deck: Boltyn',        releaseDate: '2021-07-01', hasFirstEdition: false, category: 'armory',       tier: 4 },
  ako:  { code: 'AKO', name: 'Armory Deck: Kayo',          releaseDate: '2022-01-01', hasFirstEdition: false, category: 'armory',       tier: 4 },
  ajv:  { code: 'AJV', name: 'Armory Deck: Jarl Vetreidi', releaseDate: '2022-09-01', hasFirstEdition: false, category: 'armory',       tier: 4 },
  ast:  { code: 'AST', name: 'Armory Deck: Aurora',        releaseDate: '2023-01-01', hasFirstEdition: false, category: 'armory',       tier: 4 },
  amx:  { code: 'AMX', name: 'Armory Deck: Maxx Nitro',    releaseDate: '2023-06-01', hasFirstEdition: false, category: 'armory',       tier: 4 },
  agb:  { code: 'AGB', name: 'Armory Deck: Gravy Bones',   releaseDate: '2024-01-01', hasFirstEdition: false, category: 'armory',       tier: 4 },
  aps:  { code: 'APS', name: 'Armory Deck: Pleiades',      releaseDate: '2024-06-01', hasFirstEdition: false, category: 'armory',       tier: 4 },

  // ── Tier 5: Promos & non-standard ────────────────────────────────────────
  fab:  { code: 'FAB', name: 'Promos',                     releaseDate: '2019-10-11', hasFirstEdition: false, category: 'non-standard', tier: 5 },
  tcc:  { code: 'TCC', name: 'Round the Table: TCC X LSS', releaseDate: '2023-10-06', hasFirstEdition: false, category: 'non-standard', tier: 5 },
  gem:  { code: 'GEM', name: 'GEM Pack',                   releaseDate: '2024-01-01', hasFirstEdition: false, category: 'non-standard', tier: 5 },
  mpg:  { code: 'MPG', name: 'Mastery Pack Guardian',      releaseDate: '2025-08-08', hasFirstEdition: false, category: 'non-standard', tier: 5 },
  smp:  { code: 'SMP', name: 'Smash Palace',               releaseDate: '2025-08-29', hasFirstEdition: false, category: 'non-standard', tier: 5 },
  sup:  { code: 'SUP', name: 'Super Slam',                 releaseDate: '2025-09-26', hasFirstEdition: false, category: 'non-standard', tier: 5 },
};

// Explicit ordering for categories
const ARMORY_ORDER = ['evo'];
const NON_STANDARD_ORDER = ['tcc', 'mpg', 'smp', 'sup', 'gem', 'fab'];

/**
 * Maps tier number → display position in a printing carousel.
 * User-defined order: main sets → supplemental → promos → blitz decks → armory decks
 */
const TIER_DISPLAY_POSITION: Record<number, number> = { 1: 0, 2: 1, 5: 2, 3: 3, 4: 4 };

/** Edition priority within a set: older/rarer editions first */
const EDITION_SORT_PRIORITY: Record<string, number> = { a: 0, f: 1, u: 2, n: 3 };

/**
 * Sort a printing array into a consistent, user-friendly order.
 * Primary: set tier (main booster → supplemental → promo → blitz deck → armory)
 * Secondary: release date within tier (oldest = original printing first)
 * Tertiary: foiling (non-foil → RF → CF → Marvel → GF)
 * Quaternary: edition (alpha → 1st → unlimited → normal)
 *
 * Works with any printing object that has `set`, `foiling`, `rarity`, and `edition` fields.
 */
export function sortPrintings<T extends { set?: string; foiling?: string; rarity?: string; edition?: string }>(printings: T[]): T[] {
  return [...printings].sort((a, b) => {
    const aCode = (a.set || '').toLowerCase();
    const bCode = (b.set || '').toLowerCase();
    const aMeta = SET_METADATA[aCode];
    const bMeta = SET_METADATA[bCode];

    // 1. Tier display position
    const aTierPos = TIER_DISPLAY_POSITION[aMeta?.tier ?? 3] ?? 3;
    const bTierPos = TIER_DISPLAY_POSITION[bMeta?.tier ?? 3] ?? 3;
    if (aTierPos !== bTierPos) return aTierPos - bTierPos;

    // 2. Release date within tier (oldest first = original printing first)
    const aDate = aMeta?.releaseDate ?? '9999-99-99';
    const bDate = bMeta?.releaseDate ?? '9999-99-99';
    if (aDate !== bDate) return aDate.localeCompare(bDate);

    // 3. Foiling priority — Marvel identified by rarity='v', not foiling code
    const aMarvel = (a.rarity || '').toLowerCase() === 'v';
    const bMarvel = (b.rarity || '').toLowerCase() === 'v';
    const FOIL_PRIORITY: Record<string, number> = { s: 0, n: 0, r: 1, c: 2, g: 4 };
    const aFoil = aMarvel ? 3 : (FOIL_PRIORITY[(a.foiling || 's').toLowerCase()] ?? 0);
    const bFoil = bMarvel ? 3 : (FOIL_PRIORITY[(b.foiling || 's').toLowerCase()] ?? 0);
    if (aFoil !== bFoil) return aFoil - bFoil;

    // 4. Edition
    const aEd = EDITION_SORT_PRIORITY[a.edition ?? 'n'] ?? 3;
    const bEd = EDITION_SORT_PRIORITY[b.edition ?? 'n'] ?? 3;
    return aEd - bEd;
  });
}

// Helper functions
export function getSetMetadata(setCode: string): SetMetadata | undefined {
  return SET_METADATA[setCode.toLowerCase()];
}

export function hasFirstEdition(setCode: string): boolean {
  const metadata = getSetMetadata(setCode);
  return metadata?.hasFirstEdition ?? false;
}

export function getAllSetCodes(): string[] {
  return Object.keys(SET_METADATA);
}

export function getSetsInDisplayOrder(): SetMetadata[] {
  const allSets = Object.values(SET_METADATA);

  const standard = allSets
    .filter(s => s.category === 'standard')
    .sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime());

  const armory = ARMORY_ORDER
    .map(code => SET_METADATA[code])
    .filter(s => s && s.category === 'armory');

  const nonStandard = NON_STANDARD_ORDER
    .map(code => SET_METADATA[code])
    .filter(s => s && s.category === 'non-standard');

  return [...standard, ...armory, ...nonStandard];
}

export function getSetCodesInDisplayOrder(): string[] {
  return getSetsInDisplayOrder().map(set => set.code.toLowerCase());
}

export function getOrderedSets(): {
  standard: SetMetadata[];
  armory: SetMetadata[];
  nonStandard: SetMetadata[];
} {
  const allSets = Object.values(SET_METADATA);

  const standard = allSets
    .filter(s => s.category === 'standard')
    .sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime());

  const armory = ARMORY_ORDER
    .map(code => SET_METADATA[code])
    .filter(s => s && s.category === 'armory');

  const nonStandard = NON_STANDARD_ORDER
    .map(code => SET_METADATA[code])
    .filter(s => s && s.category === 'non-standard');

  return { standard, armory, nonStandard };
}
