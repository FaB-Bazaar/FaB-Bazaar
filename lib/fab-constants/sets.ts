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

// Set metadata including release dates
export interface SetMetadata {
  code: string;
  name: string;
  releaseDate: string; // YYYY-MM-DD format
  hasFirstEdition: boolean;
  category: 'standard' | 'armory' | 'non-standard' | 'excluded';
  defaultRarity?: string;
}

export const SET_METADATA: Record<string, SetMetadata> = {
  // 2019
  wtr: {
    code: 'WTR',
    name: 'Welcome to Rathe',
    releaseDate: '2019-10-11',
    hasFirstEdition: true,
    category: 'standard'
  },
  ira: {
    code: 'IRA',
    name: 'Ira Welcome Deck',
    releaseDate: '2019-08-31',
    hasFirstEdition: false,
    category: 'excluded'
  },

  // 2020
  arc: {
    code: 'ARC',
    name: 'Arcane Rising',
    releaseDate: '2020-03-27',
    hasFirstEdition: true,
    category: 'standard'
  },
  cru: {
    code: 'CRU',
    name: 'Crucible of War',
    releaseDate: '2020-08-28',
    hasFirstEdition: true,
    category: 'standard'
  },

  // 2021
  mon: {
    code: 'MON',
    name: 'Monarch',
    releaseDate: '2021-05-07',
    hasFirstEdition: true,
    category: 'standard'
  },
  ele: {
    code: 'ELE',
    name: 'Tales of Aria',
    releaseDate: '2021-09-24',
    hasFirstEdition: true,
    category: 'standard'
  },

  // 2022
  evr: {
    code: 'EVR',
    name: 'Everfest',
    releaseDate: '2022-02-04',
    hasFirstEdition: false,
    category: 'standard'
  },
  '1hp': {
    code: '1HP',
    name: 'History Pack 1',
    releaseDate: '2022-05-06',
    hasFirstEdition: false,
    category: 'standard'
  },
  upr: {
    code: 'UPR',
    name: 'Uprising',
    releaseDate: '2022-06-24',
    hasFirstEdition: false,
    category: 'standard'
  },
  dyn: {
    code: 'DYN',
    name: 'Dynasty',
    releaseDate: '2022-11-11',
    hasFirstEdition: false,
    category: 'standard'
  },

  // 2023
  out: {
    code: 'OUT',
    name: 'Outsiders',
    releaseDate: '2023-03-24',
    hasFirstEdition: false,
    category: 'standard'
  },
  dtd: {
    code: 'DTD',
    name: 'Dusk till Dawn',
    releaseDate: '2023-07-14',
    hasFirstEdition: false,
    category: 'standard'
  },
  tcc: {
    code: 'TCC',
    name: 'Round the Table: TCC X LSS',
    releaseDate: '2023-10-06',
    hasFirstEdition: false,
    category: 'non-standard'
  },

  // 2024
  hvt: {
    code: 'HVY',
    name: 'Heavy Hitters',
    releaseDate: '2024-02-02',
    hasFirstEdition: false,
    category: 'standard'
  },
  mst: {
    code: 'MST',
    name: 'Part the Mistveil',
    releaseDate: '2024-05-31',
    hasFirstEdition: false,
    category: 'standard'
  },
  ros: {
    code: 'ROS',
    name: 'Rosetta',
    releaseDate: '2024-09-20',
    hasFirstEdition: false,
    category: 'standard'
  },

  // 2025
  hnt: {
    code: 'HNT',
    name: 'The Hunted',
    releaseDate: '2025-01-31',
    hasFirstEdition: false,
    category: 'standard',
    defaultRarity: 'L'
  },
  sea: {
    code: 'SEA',
    name: 'High Seas',
    releaseDate: '2025-06-06',
    hasFirstEdition: false,
    category: 'standard',
    defaultRarity: 'L'
  },
  mpg: {
    code: 'MPG',
    name: 'Mastery Pack Guardian',
    releaseDate: '2025-08-08',
    hasFirstEdition: false,
    category: 'non-standard'
  },
  smp: {
    code: 'SMP',
    name: 'Smash Palace',
    releaseDate: '2025-08-29',
    hasFirstEdition: false,
    category: 'non-standard'
  },
  sup: {
    code: 'SUP',
    name: 'Super Slam',
    releaseDate: '2025-09-26',
    hasFirstEdition: false,
    category: 'non-standard'
  },
  pen: {
    code: 'PEN',
    name: 'Compendium of Rathe',
    releaseDate: '2026-02-13',
    hasFirstEdition: false,
    category: 'standard'
  },
  anq: {
    code: 'ANQ',
    name: 'Antiquity Pack',
    releaseDate: '2026-02-13',
    hasFirstEdition: false,
    category: 'standard'
  },

  // Blitz/Armory Decks
  evo: {
    code: 'EVO',
    name: 'Bright Lights',
    releaseDate: '2022-05-27',
    hasFirstEdition: false,
    category: 'armory'
  },

  // Evergreen
  gem: {
    code: 'GEM',
    name: 'Gem Pack',
    releaseDate: '2024-01-01',
    hasFirstEdition: false,
    category: 'non-standard'
  },

  // Promos
  fab: {
    code: 'FAB',
    name: 'Promos',
    releaseDate: '2019-10-11',
    hasFirstEdition: false,
    category: 'non-standard'
  }
};

// Explicit ordering for categories
const ARMORY_ORDER = ['evo'];
const NON_STANDARD_ORDER = ['tcc', 'mpg', 'smp', 'sup', 'gem', 'fab'];

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
