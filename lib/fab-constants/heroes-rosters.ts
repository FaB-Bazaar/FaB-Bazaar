// lib/fab-constants/heroes-rosters.ts
// Canonical hero roster data (adult + young) and class grouping helpers.
// Leaf file — imports nothing from its siblings to guarantee no circular deps.

export interface HeroInfo {
  cardUniqueId?: string;
  classes: string[];
  talents: string[];
  essences?: string[];
  shortName: string;
}

export interface HeroEntry {
  name: string;          // canonical lowercase — pass as heroName on writes
  displayName: string;   // properly-cased for UI
  shortName?: string;    // nickname (e.g. "dori")
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
  'zyggy starlight': {
    cardUniqueId: 'pnwGDgknLbHc96Ghg8f67',
    classes: ['illusionist'],
    talents: ['elemental'],
    essences: ['lightning'],
    shortName: 'zyggy'
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
  'aurora, legacy of tempest': {
    cardUniqueId: 'WDhGzj9m8MWhkkfRMB7Jg',
    classes: ['runeblade'],
    talents: ['elemental'],
    essences: ['lightning'],
    shortName: 'auralot'
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
  'oscilio, forked continuum': {
    cardUniqueId: 'nqbttmdCrgTbFBjJBzLtz',
    classes: ['wizard'],
    talents: ['elemental'],
    essences: ['lightning'],
    shortName: 'oscifc'
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
    cardUniqueId: 'GFc7t8wNTwC8rCFwrqTfh',
    classes: ['ranger'],
    talents: ['elemental'],
    essences: ['ice', 'lightning'],
    shortName: 'lexi'
  },
  'marlynn': {
    cardUniqueId: 'N7PFFQLkdzRMDhzDWJWwW', classes: ['ranger'], talents: ['pirate'], shortName: 'marlynn' },
  'riptide': {
    cardUniqueId: 'DhffBQC7PHwzdJpjTjNBm', classes: ['ranger'], talents: [], shortName: 'riptide' },

  // Wizards
  'iyslander': {
    cardUniqueId: 'TmKrpP8tDg8bmpnqMPtgj',
    classes: ['wizard'],
    talents: ['elemental'],
    essences: ['ice'],
    shortName: 'iyslander'
  },
  'kano': {
    cardUniqueId: 'Q9B8TDhTdfDLN8ccnBThK', classes: ['wizard'], talents: [], shortName: 'kano' },
  'oscilio': {
    cardUniqueId: 'jC7KWzhP9jMrPDNCHJWtk',
    classes: ['wizard'],
    talents: ['elemental'],
    essences: ['lightning'],
    shortName: 'oscilio'
  },
  'oscilio, scion of the third age': {
    cardUniqueId: 'bdD7LdLhpgdfLwzCq6jBc',
    classes: ['wizard'],
    talents: ['elemental'],
    essences: ['lightning'],
    shortName: 'oscista'
  },
  'verdance': {
    cardUniqueId: 'd77Rnf7QF6pfMd6MNgGtm',
    classes: ['wizard'],
    talents: ['elemental'],
    essences: ['earth'],
    shortName: 'verdance'
  },

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
    cardUniqueId: 'TDrmKkRWGKWnqfQkT9QML',
    classes: ['runeblade'],
    talents: ['elemental'],
    essences: ['lightning'],
    shortName: 'aurora'
  },
  'aurora, emissary of lightning': {
    cardUniqueId: 'WwKdgRBmtM6CpRjwM97Lh',
    classes: ['runeblade'],
    talents: ['elemental'],
    essences: ['lightning'],
    shortName: 'auraeol'
  },
  'briar': {
    cardUniqueId: '7TjkgnbJ8tghfrkMRnTfW',
    classes: ['runeblade'],
    talents: ['elemental'],
    essences: ['earth', 'lightning'],
    shortName: 'briar'
  },
  'florian': {
    cardUniqueId: 'Ht8qhJWDMHjjMjzqgf6KG',
    classes: ['runeblade'],
    talents: ['elemental'],
    essences: ['earth'],
    shortName: 'florian'
  },
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
  'zyggy': {
    cardUniqueId: 'gqp7pLMMBLrRjGgzDgzT7', classes: ['illusionist'], talents: ['elemental'], shortName: 'zyggy-y' },

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
    cardUniqueId: 'hw6qHfWdqQGfRPfKJMgR7',
    classes: ['guardian'],
    talents: ['elemental'],
    essences: ['earth', 'ice'],
    shortName: 'oldhim'
  },
  'pleiades': {
    cardUniqueId: 'DcwnhL66BkhqjFcfzwwfQ', classes: ['guardian'], talents: ['revered'], shortName: 'pleiades' },
  'terra': {
    cardUniqueId: 'JbQPwq8DkLpDdjHCP9www',
    classes: ['guardian'],
    talents: ['elemental'],
    essences: ['earth'],
    shortName: 'terra'
  },
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
