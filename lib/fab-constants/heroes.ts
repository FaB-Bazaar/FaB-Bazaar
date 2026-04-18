// lib/fab-constants/heroes.ts
// Hero information, nicknames, and resources

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

// Type definitions
export interface HeroInfo {
  cardUniqueId?: string;
  classes: string[];
  talents: string[];
  essences?: string[];
  shortName: string;
}

export interface ResourceLink {
  href: string;
  title: string;
  description: string;
  type: 'decklist' | 'video';
}

// Complete hero information mapping (adult heroes)
export const HERO_INFO: Record<string, HeroInfo> = {
  // Assassins
  'arakni, 5l!p3d 7hru 7h3 cr4x': {
    cardUniqueId: 'nkBnGcCDpf9KHChtrrN6b',
    classes: ['assassin'],
    talents: ['chaos'],
    shortName: 'slippy'
  },
  'arakni, huntsman': {
    cardUniqueId: 'CKtFCgnGdwMDBh7dzDqqz',
    classes: ['assassin'],
    talents: [],
    shortName: 'huntsman'
  },
  'arakni, marionette': {
    cardUniqueId: 'rzm9GQbbBrrDzLQRcB6kK',
    classes: ['assassin'],
    talents: ['chaos'],
    shortName: 'mario'
  },
  'nuu, alluring desire': {
    cardUniqueId: 'MghLPDjq8CfBJ8RzNc7Ft',
    classes: ['assassin'],
    talents: ['mystic'],
    shortName: 'nuu'
  },
  'uzuri, switchblade': {
    cardUniqueId: 'rNhtnPWtDDBzBp7mNdQtT',
    classes: ['assassin'],
    talents: [],
    shortName: 'uzuri'
  },

  // Brutes
  'kayo, armed and dangerous': {
    cardUniqueId: 'qdLHRPTdGkw6TjpMjPTW7',
    classes: ['brute'],
    talents: [],
    shortName: 'kayo'
  },
  'levia, shadowborn abomination': {
    cardUniqueId: 'KCwnGqDJtnmJfth7fn8Qq',
    classes: ['brute'],
    talents: ['shadow'],
    shortName: 'levia'
  },
  'rhinar, reckless rampage': {
    cardUniqueId: 'wr9wBtTWwRrPrdhCRHCdN',
    classes: ['brute'],
    talents: [],
    shortName: 'rhinar'
  },
  'tuffnut, bumbling hulkster': {
    cardUniqueId: 'wqmMJj8PqzNHg7Q7LMqTR',
    classes: ['brute'],
    talents: ['revered'],
    shortName: 'tuffnut'
  },
  'kayo, underhanded cheat': {
    cardUniqueId: 'fMDbBJHTPL7dcMMFNkCCm',
    classes: ['brute'],
    talents: ['reviled'],
    shortName: 'rko'
  },

  // Guardians
  'betsy, skin in the game': {
    cardUniqueId: 'm7WjNjrtmfKdLfqPLWDHw',
    classes: ['guardian'],
    talents: [],
    shortName: 'betsy'
  },
  'bravo, showstopper': {
    cardUniqueId: 'NtLDgPBR7HqDqhDzJMHmk',
    classes: ['guardian'],
    talents: [],
    shortName: 'bravo'
  },
  'bravo, star of the show': {
    cardUniqueId: 'PFJnMWQNfr6jMMzJhjB9H',
    classes: ['guardian'],
    talents: ['elemental'],
    essences: ['lightning', 'ice', 'earth'],
    shortName: 'starvo'
  },
  'jarl vetreiði': {
    cardUniqueId: '9QL68DDb9hCqhWWhgnQgR',
    classes: ['guardian'],
    talents: ['elemental'],
    essences: ['earth', 'ice'],
    shortName: 'jarl'
  },
  'oldhim, grandfather of eternity': {
    cardUniqueId: 'bh96L8jp69mNpjcGRCDbj',
    classes: ['guardian'],
    talents: ['elemental'],
    essences: ['earth', 'ice'],
    shortName: 'oldhim'
  },
  'valda, seismic impact': {
    cardUniqueId: 'bjLbTMgMm6QRWBRrw8chQ',
    classes: ['guardian'],
    talents: [],
    shortName: 'valda'
  },
  'victor goldmane, high and mighty': {
    cardUniqueId: 'fc8jMwTprwnhRbPKDmF9J',
    classes: ['guardian'],
    talents: [],
    shortName: 'victor'
  },
  'lyath goldmane, vile savant': {
    cardUniqueId: 'MgKprw8PQjNKC7JDmppHh',
    classes: ['guardian'],
    talents: ['reviled'],
    shortName: 'lyath'
  },
  'pleiades, superstar': {
    cardUniqueId: 'JhgRJb6nfctWkndbzrgnj',
    classes: ['guardian'],
    talents: ['revered'],
    shortName: 'pleiades'
  },

  // Illusionists
  'dromai, ash artist': {
    cardUniqueId: 'PrJkWBKNgtNdzhqhWLGFw',
    classes: ['illusionist'],
    talents: ['draconic'],
    shortName: 'dromai'
  },
  'enigma, ledger of ancestry': {
    cardUniqueId: 'tJhRRN9kkMCnGQdQJ8TWg',
    classes: ['illusionist'],
    talents: ['mystic'],
    shortName: 'enigma'
  },
  'prism, awakener of sol': {
    cardUniqueId: 'jrQcdHwPDPTt8PWTdNLqk',
    classes: ['illusionist'],
    talents: ['light'],
    shortName: 'prismaos'
  },
  'prism, sculptor of arc light': {
    cardUniqueId: 'F7rQpTDjHFWPgQhcGg7RT',
    classes: ['illusionist'],
    talents: ['light'],
    shortName: 'prismsoal'
  },

  // Mechanologists
  'dash i/o': {
    cardUniqueId: 'LkqQpr7QL8KpnqMh7dHpR',
    classes: ['mechanologist'],
    talents: [],
    shortName: 'dashio'
  },
  'dash, inventor extraordinaire': {
    cardUniqueId: '6CcjWGnThrTmTQFQ9zHMN',
    classes: ['mechanologist'],
    talents: [],
    shortName: 'dashie'
  },
  'maxx \'the hype\' nitro': {
    cardUniqueId: 'tqBKqzRbFHWtBLQ7hhDgW',
    classes: ['mechanologist'],
    talents: [],
    shortName: 'maxx'
  },
  'puffin, hightail': {
    cardUniqueId: 'DghbPmFhwLkT9whJJjL9f',
    classes: ['mechanologist'],
    talents: ['pirate'],
    shortName: 'puffin'
  },
  'teklovossen, esteemed magnate': {
    cardUniqueId: 'ndKnMFtcDt8JmPFD6bfbk',
    classes: ['mechanologist'],
    talents: [],
    shortName: 'teklo'
  },

  // Necromancers
  'gravy bones, shipwrecked looter': {
    cardUniqueId: 'wbjNnhBq6cMwDfwdtrkhn',
    classes: ['necromancer'],
    talents: ['pirate'],
    shortName: 'gravy'
  },

  // Ninjas
  'cindra, dracai of retribution': {
    cardUniqueId: 'HRtHpngjPbHNKCFMbJw7m',
    classes: ['ninja'],
    talents: ['royal', 'draconic'],
    shortName: 'cindra'
  },
  'fai, rising rebellion': {
    cardUniqueId: 'RjNJbgTJn7bJrjJHBdfC8',
    classes: ['ninja'],
    talents: ['draconic'],
    shortName: 'fai'
  },
  'ira, scarlet revenger': {
    cardUniqueId: 'DBKWbWMbrt7WK7KwmNQRL',
    classes: ['ninja'],
    talents: [],
    shortName: 'ira'
  },
  'katsu, the wanderer': {
    cardUniqueId: 'nM8BHGHd9qLGTPgwtWzkJ',
    classes: ['ninja'],
    talents: [],
    shortName: 'katsu'
  },
  'zen, tamer of purpose': {
    cardUniqueId: 'GDbCgdDrFKCWWthrgD6h6',
    classes: ['ninja'],
    talents: ['mystic'],
    shortName: 'zen'
  },

  // Rangers
  'azalea, ace in the hole': {
    cardUniqueId: 'PTFnJCdhWD9cFgMMNPqQj',
    classes: ['ranger'],
    talents: [],
    shortName: 'azalea'
  },
  'lexi, livewire': {
    cardUniqueId: 'PFmgFK9dFr8q6PrpJFpPG',
    classes: ['ranger'],
    talents: ['elemental'],
    essences: ['lightning', 'ice'],
    shortName: 'lexi'
  },
  'marlynn, treasure hunter': {
    cardUniqueId: 'rTNChdmHbjN7HPNJJLzCt',
    classes: ['ranger'],
    talents: ['pirate'],
    shortName: 'marlynn'
  },
  'riptide, lurker of the deep': {
    cardUniqueId: 'RNfgGmc8wHgBrmC6gkqBd',
    classes: ['ranger'],
    talents: [],
    shortName: 'riptide'
  },

  // Runeblades
  'aurora, shooting star': {
    cardUniqueId: 'mHBtPppktRTkWpnf69dHj',
    classes: ['runeblade'],
    talents: ['elemental'],
    essences: ['lightning'],
    shortName: 'aurora'
  },
  'briar, warden of thorns': {
    cardUniqueId: 'cjDzkKdjNrGqL9tnDc7zd',
    classes: ['runeblade'],
    talents: ['elemental'],
    essences: ['lightning', 'earth'],
    shortName: 'briar'
  },
  'chane, bound by shadow': {
    cardUniqueId: 'MhBTRHCCft7RbrMmkwwGw',
    classes: ['runeblade'],
    talents: ['shadow'],
    shortName: 'chane'
  },
  'florian, rotwood harbinger': {
    cardUniqueId: 'hjMQGwKgDTh8LzFdnk8Rg',
    classes: ['runeblade'],
    talents: ['elemental'],
    essences: ['earth'],
    shortName: 'florian'
  },
  'viserai, rune blood': {
    cardUniqueId: 'TKbRWjjBLJThMmLkTFb6q',
    classes: ['runeblade'],
    talents: [],
    shortName: 'viserai'
  },
  'vynnset, iron maiden': {
    cardUniqueId: '9CwWmnzhhfLbJgc6q7Hm7',
    classes: ['runeblade'],
    talents: ['shadow'],
    shortName: 'vynnset'
  },

  // Warriors
  'dorinthea ironsong': {
    cardUniqueId: 'Djhg6DMpCpFHD9rcPNFrN',
    classes: ['warrior'],
    talents: [],
    shortName: 'dori'
  },
  'fang, dracai of blades': {
    cardUniqueId: 'P9DWCqqTwtKLnhNzLHnnp',
    classes: ['warrior'],
    talents: ['royal', 'draconic'],
    shortName: 'fang'
  },
  'hala, bladesaint of the vow': {
    cardUniqueId: 'FQFkLFgp9pJqdd8mQkJTQ',
    classes: ['warrior'],
    talents: [],
    shortName: 'hala'
  },
  'kassai of the golden sand': {
    cardUniqueId: 'ffKGNQcWnLkfQD7w66MRL',
    classes: ['warrior'],
    talents: [],
    shortName: 'kassai'
  },
  'olympia, prized fighter': {
    cardUniqueId: '9JqrM7dbgfG87L6tPghrM',
    classes: ['warrior'],
    talents: [],
    shortName: 'olympia'
  },
  'ser boltyn, breaker of dawn': {
    cardUniqueId: 'QrKGJL7bHCFKbr9N9MNpm',
    classes: ['warrior'],
    talents: ['light'],
    shortName: 'boltyn'
  },

  // Wizards
  'iyslander, stormbind': {
    cardUniqueId: '8KRCDf6drqhFMKK7hJhbM',
    classes: ['wizard'],
    talents: ['elemental'],
    essences: ['ice'],
    shortName: 'iyslander'
  },
  'kano, dracai of aether': {
    cardUniqueId: 'kRPqHdCckKBKfRwjbfzNT',
    classes: ['wizard'],
    talents: [],
    shortName: 'kano'
  },
  'oscilio, constella intelligence': {
    cardUniqueId: 'Bd8JQMtjbmwQ7W6GLt7KL',
    classes: ['wizard'],
    talents: ['elemental'],
    essences: ['lightning'],
    shortName: 'oscilio'
  },
  'verdance, thorn of the rose': {
    cardUniqueId: 'wJMCMFqcQfRJmK96kc8qM',
    classes: ['wizard'],
    talents: ['elemental'],
    essences: ['earth'],
    shortName: 'verdance'
  }
};

// Young Hero Information (for Silver Age / Blitz)
export const YOUNG_HERO_INFO: Record<string, HeroInfo> = {
  // Assassins
  'arakni': {
    cardUniqueId: '9F7RHWjLgCDRqwMww99GN', classes: ['assassin'], talents: [], shortName: 'arakni' },
  'arakni, solitary confinement': {
    cardUniqueId: 'jkwfjdcDbhRnDrPWDnwT9', classes: ['assassin'], talents: [], shortName: 'arakni-sc' },
  'arakni, web of deceit': {
    cardUniqueId: 'qMNzBQBKDMgnGpTfGgKkP', classes: ['assassin'], talents: [], shortName: 'arakni-wod' },
  'nuu': {
    cardUniqueId: 'prMJkPd8w9KQHQ9BjgMmG', classes: ['assassin'], talents: ['mystic'], shortName: 'nuu' },
  'uzuri': {
    cardUniqueId: 'QmqN6fJJMnLDjLHKF7g97', classes: ['assassin'], talents: [], shortName: 'uzuri' },

  // Rangers
  'azalea': {
    cardUniqueId: 'Fc8mPQBjrNq6Fg9LW9RLc', classes: ['ranger'], talents: [], shortName: 'azalea' },
  'lexi': {
    cardUniqueId: 'GFc7t8wNTwC8rCFwrqTfh', classes: ['ranger'], talents: ['elemental'], shortName: 'lexi' },
  'marlynn': {
    cardUniqueId: 'N7PFFQLkdzRMDhzDWJWwW', classes: ['ranger'], talents: ['pirate'], shortName: 'marlynn' },
  'riptide': {
    cardUniqueId: 'DhffBQC7PHwzdJpjTjNBm', classes: ['ranger'], talents: [], shortName: 'riptide' },

  // Wizards
  'iyslander': {
    cardUniqueId: 'TmKrpP8tDg8bmpnqMPtgj', classes: ['wizard'], talents: ['elemental'], shortName: 'iyslander' },
  'kano': {
    cardUniqueId: 'Q9B8TDhTdfDLN8ccnBThK', classes: ['wizard'], talents: [], shortName: 'kano' },
  'oscilio': {
    cardUniqueId: 'jC7KWzhP9jMrPDNCHJWtk', classes: ['wizard'], talents: ['elemental'], shortName: 'oscilio' },
  'verdance': {
    cardUniqueId: 'd77Rnf7QF6pfMd6MNgGtm', classes: ['wizard'], talents: ['elemental'], shortName: 'verdance' },

  // Warriors
  'boltyn': {
    cardUniqueId: 'Fmf8trg9w8B8BBbWrf8w9', classes: ['warrior'], talents: ['light'], shortName: 'boltyn' },
  'dorinthea': {
    cardUniqueId: 'KGqRPDfRrnPqdj7Cm76fr', classes: ['warrior'], talents: [], shortName: 'dorinthea' },
  'fang': {
    cardUniqueId: 'RBcRMcBrm89m6pcTDQnP9', classes: ['warrior'], talents: ['royal', 'draconic'], shortName: 'fang' },
  'kassai': {
    cardUniqueId: 'GwMRRqcL8rDHFRDTfqWzt', classes: ['warrior'], talents: [], shortName: 'kassai' },
  'kassai, cintari sellsword': {
    cardUniqueId: 'wWmP8RJRq7MWk7kBh9q7w', classes: ['warrior'], talents: [], shortName: 'kassai-cs' },
  'olympia': {
    cardUniqueId: 't7H7JCQcTb9TTjjCbNwDH', classes: ['warrior'], talents: [], shortName: 'olympia' },

  // Thief
  'scurv, stowaway': {
    cardUniqueId: 'gKgfQDwNnGH8GtfL9RkPG', classes: ['thief'], talents: ['pirate'], shortName: 'scurv' },

  // Runeblades
  'aurora': {
    cardUniqueId: 'TDrmKkRWGKWnqfQkT9QML', classes: ['runeblade'], talents: ['elemental'], shortName: 'aurora' },
  'briar': {
    cardUniqueId: '7TjkgnbJ8tghfrkMRnTfW', classes: ['runeblade'], talents: ['elemental'], shortName: 'briar' },
  'florian': {
    cardUniqueId: 'Ht8qhJWDMHjjMjzqgf6KG', classes: ['runeblade'], talents: ['elemental'], shortName: 'florian' },
  'viserai': {
    cardUniqueId: 'RHnFkKb8FKdFzp9rdzGjF', classes: ['runeblade'], talents: [], shortName: 'viserai' },
  'vynnset': {
    cardUniqueId: 'WhKb7MKbcDLhGThWGP8hT', classes: ['runeblade'], talents: ['shadow'], shortName: 'vynnset' },

  // Ninjas
  'benji, the piercing wind': {
    cardUniqueId: 'HT8r8mg8rHmbWJthCFHfH', classes: ['ninja'], talents: [], shortName: 'benji' },
  'cindra': {
    cardUniqueId: 'm7hWTmtRzJnrtqtfLLR6M', classes: ['ninja'], talents: ['royal', 'draconic'], shortName: 'cindra' },
  'fai': {
    cardUniqueId: 'QHNfbDkffrKWgwDw7MjwQ', classes: ['ninja'], talents: ['draconic'], shortName: 'fai' },
  'ira, crimson haze': {
    cardUniqueId: 'GCRQMpBtqBHWrk68GqnGP', classes: ['ninja'], talents: [], shortName: 'ira-ch' },
  'katsu': {
    cardUniqueId: 'QnGJNBGBFw98q9n9NCdRW', classes: ['ninja'], talents: [], shortName: 'katsu' },
  'zen': {
    cardUniqueId: '7FHM67fkfjCjzwWzKfFKH', classes: ['ninja'], talents: ['mystic'], shortName: 'zen' },

  // Necromancer
  'gravy bones': {
    cardUniqueId: 'Fq9Cg9pKGFKrTbfHq9mBb', classes: ['necromancer'], talents: ['pirate'], shortName: 'gravy' },

  // Merchant
  'kavdaen, trader of skins': {
    cardUniqueId: 'rgq8FqBMdhn9khbwjDK6Q', classes: ['merchant'], talents: [], shortName: 'kavdaen' },

  // Mechanologists
  'dash': {
    cardUniqueId: 'kftPnNkrBLJ7rPmFGgQCm', classes: ['mechanologist'], talents: [], shortName: 'dash' },
  'dash, database': {
    cardUniqueId: 'N6TDqDNWfKfrz6G6jNrQQ', classes: ['mechanologist'], talents: [], shortName: 'dash-db' },
  'data doll mkii': {
    cardUniqueId: 'kbdzm8R7MHCpWC79RdTGH', classes: ['mechanologist'], talents: [], shortName: 'datadoll' },
  'maxx nitro': {
    cardUniqueId: 'z7bLz9hhPDcwmTdQGf6TK', classes: ['mechanologist'], talents: [], shortName: 'maxx' },
  'puffin': {
    cardUniqueId: 'm8MzjMMWBw88jJj9gt9Qj', classes: ['mechanologist'], talents: ['pirate'], shortName: 'puffin' },
  'teklovossen': {
    cardUniqueId: '6PPFnJ8tNtPKN6Km7NWpp', classes: ['mechanologist'], talents: [], shortName: 'teklo' },

  // Illusionists
  'dromai': {
    cardUniqueId: 'Dz6FcRBNMFdBt9fJPMB7d', classes: ['illusionist'], talents: ['draconic'], shortName: 'dromai' },
  'enigma': {
    cardUniqueId: 'JKPFKKFqnLtmctLkwNCmc', classes: ['illusionist'], talents: ['mystic'], shortName: 'enigma' },
  'prism': {
    cardUniqueId: 'NGkHQHjzkFqfmGLKmRCpj', classes: ['illusionist'], talents: ['light'], shortName: 'prism' },

  // Guardians
  'betsy': {
    cardUniqueId: 'zdWrPkDgdbWdGBWjCLnhj', classes: ['guardian'], talents: [], shortName: 'betsy' },
  'bravo': {
    cardUniqueId: 'tzTbzLkLhDzmW9QMJr9KF', classes: ['guardian'], talents: [], shortName: 'bravo' },
  'bravo, flattering showman': {
    cardUniqueId: 'DbqGjQMfWLNCfd7qGqGht', classes: ['guardian'], talents: [], shortName: 'bravo-fs' },
  'lyath goldmane': {
    cardUniqueId: 'QrHJnzKzpMwgfJMcKQ8Dp', classes: ['guardian'], talents: ['reviled'], shortName: 'lyath' },
  'oldhim': {
    cardUniqueId: 'hw6qHfWdqQGfRPfKJMgR7', classes: ['guardian'], talents: ['elemental'], shortName: 'oldhim' },
  'pleiades': {
    cardUniqueId: 'DcwnhL66BkhqjFcfzwwfQ', classes: ['guardian'], talents: ['revered'], shortName: 'pleiades' },
  'terra': {
    cardUniqueId: 'JbQPwq8DkLpDdjHCP9www', classes: ['guardian'], talents: [], shortName: 'terra' },
  'valda brightaxe': {
    cardUniqueId: 'zWhGF8kMMdmKdhMNdj6NH', classes: ['guardian'], talents: [], shortName: 'valda' },
  'victor goldmane': {
    cardUniqueId: 'kHmRR6Q7mJPjQgdQJcjpQ', classes: ['guardian'], talents: [], shortName: 'victor' },

  // Brutes
  'kayo': {
    cardUniqueId: 'HhFFJJRzq78LdNWPJP88t', classes: ['brute'], talents: [], shortName: 'kayo' },
  'kayo, berserker runt': {
    cardUniqueId: 'NcQMQ79gb9P7CTMfWfBz8', classes: ['brute'], talents: [], shortName: 'kayo-br' },
  'kayo, strong-arm': {
    cardUniqueId: 'rwntmhkHtPGcKCbzJWjNn', classes: ['brute'], talents: [], shortName: 'kayo-sa' },
  'levia': {
    cardUniqueId: 'WwzJLfPwhRTkFLDNjJPrk', classes: ['brute'], talents: ['shadow'], shortName: 'levia' },
  'rhinar': {
    cardUniqueId: 'wNRqrHCn6rrKLhrDkqPwp', classes: ['brute'], talents: [], shortName: 'rhinar' },
  'tuffnut': {
    cardUniqueId: 'wKnhnNTHKHqFfjgdn9LLP', classes: ['brute'], talents: ['revered'], shortName: 'tuffnut' },
};

// Talishar collector number IDs — used as the `hero` field in the deck list API.
// Keys match HERO_INFO and YOUNG_HERO_INFO keys (lowercase).
export const TALISHAR_HERO_IDS: Record<string, string> = {
  // Adult heroes (HERO_INFO)
  'arakni, 5l!p3d 7hru 7h3 cr4x':      'HER130',
  'arakni, huntsman':                    'DYN113',
  'arakni, marionette':                  'HNT001',
  'nuu, alluring desire':                'MST001',
  'uzuri, switchblade':                  'OUT001',
  'kayo, armed and dangerous':           'HVY001',
  'kayo, underhanded cheat':             'SUP063',
  'levia, shadowborn abomination':       'MON119',
  'rhinar, reckless rampage':            'WTR001',
  'tuffnut, bumbling hulkster':          'SUP001',
  'betsy, skin in the game':             'HVY045',
  'bravo, showstopper':                  'WTR038',
  'bravo, star of the show':             'EVR017',
  'jarl vetreiði':                       'AJV001',
  'oldhim, grandfather of eternity':     'ELE001',
  'valda, seismic impact':               'MPG001',
  'victor goldmane, high and mighty':    'HVY047',
  'lyath goldmane, vile savant':         'SUP071',
  'pleiades, superstar':                 'SUP009',
  'dromai, ash artist':                  'UPR001',
  'enigma, ledger of ancestry':          'MST025',
  'prism, awakener of sol':              'DTD001',
  'prism, sculptor of arc light':        'MON001',
  'dash i/o':                            'EVO001',
  'dash, inventor extraordinaire':       'ARC001',
  "maxx 'the hype' nitro":              'EVO004',
  'puffin, hightail':                    'SEA001',
  'teklovossen, esteemed magnate':       'EVO007',
  'gravy bones, shipwrecked looter':     'SEA043',
  'cindra, dracai of retribution':       'HNT054',
  'fai, rising rebellion':               'UPR044',
  'ira, scarlet revenger':               'HER123',
  'katsu, the wanderer':                 'WTR076',
  'zen, tamer of purpose':               'MST046',
  'azalea, ace in the hole':             'ARC038',
  'lexi, livewire':                      'ELE031',
  'marlynn, treasure hunter':            'SEA082',
  'riptide, lurker of the deep':         'OUT091',
  'aurora, shooting star':               'ROS007',
  'briar, warden of thorns':             'ELE062',
  'chane, bound by shadow':              'MON153',
  'florian, rotwood harbinger':          'ROS001',
  'viserai, rune blood':                 'ARC075',
  'vynnset, iron maiden':                'DTD133',
  'dorinthea ironsong':                  'WTR113',
  'fang, dracai of blades':              'HNT098',
  'hala, bladesaint of the vow':         'AHA001',
  'kassai of the golden sand':           'HVY090',
  'olympia, prized fighter':             'HVY092',
  'ser boltyn, breaker of dawn':         'MON029',
  'iyslander, stormbind':                'EVR120',
  'kano, dracai of aether':              'ARC113',
  'oscilio, constella intelligence':     'ROS019',
  'verdance, thorn of the rose':         'ROS013',

  // Young heroes (YOUNG_HERO_INFO)
  'arakni':                              'DYN114',
  'arakni, solitary confinement':        'OUT003',
  'arakni, web of deceit':               'HNT002',
  'nuu':                                 'MST002',
  'uzuri':                               'OUT002',
  'azalea':                              'ARC039',
  'lexi':                                'ELE032',
  'marlynn':                             'SEA083',
  'riptide':                             'OUT092',
  'iyslander':                           'UPR103',
  'kano':                                'ARC114',
  'oscilio':                             'ROS020',
  'verdance':                            'ROS014',
  'boltyn':                              'MON030',
  'dorinthea':                           'WTR114',
  'fang':                                'HNT099',
  'kassai':                              'HVY091',
  'kassai, cintari sellsword':           'CRU077',
  'olympia':                             'HVY093',
  'scurv, stowaway':                     'SEA123',
  'aurora':                              'ROS008',
  'briar':                               'ELE063',
  'florian':                             'ROS002',
  'viserai':                             'ARC076',
  'vynnset':                             'DTD134',
  'benji, the piercing wind':            'CRU047',
  'cindra':                              'HNT055',
  'fai':                                 'UPR045',
  'ira, crimson haze':                   'CRU046',
  'katsu':                               'WTR077',
  'zen':                                 'MST047',
  'gravy bones':                         'SEA044',
  'kavdaen, trader of skins':            'CRU118',
  'dash':                                'ARC002',
  'dash, database':                      'EVO002',
  'data doll mkii':                      'CRU099',
  'maxx nitro':                          'EVO005',
  'puffin':                              'SEA002',
  'teklovossen':                         'EVO008',
  'dromai':                              'UPR002',
  'enigma':                              'MST026',
  'prism':                               'MON002',
  'betsy':                               'HVY046',
  'bravo':                               'WTR039',
  'bravo, flattering showman':           'BDD001',
  'lyath goldmane':                      'SUP072',
  'oldhim':                              'ELE002',
  'pleiades':                            'SUP010',
  'terra':                               'TER001',
  'valda brightaxe':                     'EVR019',
  'victor goldmane':                     'HVY048',
  'kayo':                                'HVY002',
  'kayo, berserker runt':                'CRU002',
  'kayo, strong-arm':                    'SUP064',
  'levia':                               'MON120',
  'rhinar':                              'WTR002',
  'tuffnut':                             'SUP002',
};

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

export function getHeroesGroupedByClass(): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};

  for (const [heroName, info] of Object.entries(HERO_INFO)) {
    for (const className of info.classes) {
      const displayClass = className.charAt(0).toUpperCase() + className.slice(1);
      if (!grouped[displayClass]) grouped[displayClass] = [];
      grouped[displayClass].push(heroName);
    }
  }

  for (const className of Object.keys(grouped)) {
    grouped[className].sort();
  }

  const sortedGrouped: Record<string, string[]> = {};
  Object.keys(grouped).sort().forEach(className => {
    sortedGrouped[className] = grouped[className];
  });

  return sortedGrouped;
}

export function getYoungHeroesGroupedByClass(): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};

  for (const [heroName, info] of Object.entries(YOUNG_HERO_INFO)) {
    for (const className of info.classes) {
      const displayClass = className.charAt(0).toUpperCase() + className.slice(1);
      if (!grouped[displayClass]) grouped[displayClass] = [];
      grouped[displayClass].push(heroName);
    }
  }

  for (const className of Object.keys(grouped)) {
    grouped[className].sort();
  }

  const sortedGrouped: Record<string, string[]> = {};
  Object.keys(grouped).sort().forEach(className => {
    sortedGrouped[className] = grouped[className];
  });

  return sortedGrouped;
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
export function toHeroDisplayName(canonicalKey: string, shortName?: string): string {
  if (shortName && HERO_NICKNAMES[shortName as keyof typeof HERO_NICKNAMES]) {
    return HERO_NICKNAMES[shortName as keyof typeof HERO_NICKNAMES];
  }
  return canonicalKey
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export interface HeroEntry {
  name: string;          // canonical lowercase — pass as heroName on writes
  displayName: string;   // properly-cased for UI
  shortName?: string;    // nickname (e.g. "dori")
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

export function getAllClasses(): string[] {
  const classes = new Set<string>();
  for (const info of Object.values(HERO_INFO)) {
    for (const className of info.classes) {
      classes.add(className);
    }
  }
  return Array.from(classes).sort();
}

export type HeroName = keyof typeof HERO_INFO;
export type YoungHeroName = keyof typeof YOUNG_HERO_INFO;
