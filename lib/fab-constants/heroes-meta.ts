// lib/fab-constants/heroes-meta.ts
// External integrations + competitive meta + showcase artwork.
// Imports only from ./heroes-rosters (leaf) to keep the dependency graph acyclic.

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

// Living Legend leaderboard snapshot — updated manually from fabtcg.com leaderboard.
// Keys must match HERO_INFO / YOUNG_HERO_INFO keys (lowercase). Omit heroes with 0 points.
export const LIVING_LEGEND_POINTS_UPDATED_AT = '2026-04-14';
export const LIVING_LEGEND_POINTS_SOURCE_LABEL = 'Pro Tour and Calling: Yokohama';

export const LIVING_LEGEND_POINTS: Record<string, number> = {
  // Active Classic Constructed heroes (LL points < 1000)
  'prism, awakener of sol': 951,
  'fai, rising rebellion': 856,
  'dash i/o': 830,
  'victor goldmane, high and mighty': 824,
  'cindra, dracai of retribution': 820,
  'bravo, showstopper': 776,
  'kassai of the golden sand': 764,
  'katsu, the wanderer': 746,
  'dorinthea ironsong': 743,
  'arakni, marionette': 644,
  'oscilio, constella intelligence': 536,
  'ser boltyn, breaker of dawn': 417,
  'gravy bones, shipwrecked looter': 409,
  'uzuri, switchblade': 405,
  'rhinar, reckless rampage': 362,
  'vynnset, iron maiden': 259,
  'arakni, huntsman': 244,
  'jarl vetreiði': 203,
  'levia, shadowborn abomination': 200,
  'arakni, 5l!p3d 7hru 7h3 cr4x': 193,
  'fang, dracai of blades': 153,
  'ira, scarlet revenger': 126,
  'riptide, lurker of the deep': 98,
  "maxx 'the hype' nitro": 85,
  'pleiades, superstar': 45,
  'teklovossen, esteemed magnate': 41,
  'kayo, underhanded cheat': 29,
  'valda, seismic impact': 28,
  'marlynn, treasure hunter': 21,
  'puffin, hightail': 18,
  'betsy, skin in the game': 7,
  'olympia, prized fighter': 7,
  'tuffnut, bumbling hulkster': 5,
  'lyath goldmane, vile savant': 3,

  // Graduated Living Legends (≥ 1000 points — no longer CC-legal)
  'bravo, star of the show': 1582,
  'lexi, livewire': 1276,
  'oldhim, grandfather of eternity': 1186,
  'briar, warden of thorns': 1158,
  'chane, bound by shadow': 1102,
  'prism, sculptor of arc light': 1098,
  'dromai, ash artist': 1096,
  'aurora, shooting star': 1051,
  'enigma, ledger of ancestry': 1046,
  'azalea, ace in the hole': 1036,
  'florian, rotwood harbinger': 1029,
  'kano, dracai of aether': 1028,
  'verdance, thorn of the rose': 1019,
  'viserai, rune blood': 1016,
  'kayo, armed and dangerous': 1014,
  'dash, inventor extraordinaire': 1013,
  'iyslander, stormbind': 1012,
  'nuu, alluring desire': 1004,
  'zen, tamer of purpose': 1000,
};

export const LIVING_LEGEND_THRESHOLD = 1000;

export function getLivingLegendPoints(heroName: string): number | null {
  const key = heroName.toLowerCase();
  return LIVING_LEGEND_POINTS[key] ?? null;
}

export function isLivingLegendGraduated(heroName: string): boolean {
  const pts = getLivingLegendPoints(heroName);
  return pts !== null && pts >= LIVING_LEGEND_THRESHOLD;
}

// Marvel (rarity='v') printings used for hero portraits on the Starter Kits page.
// The Starter Kits index is decorative — unlike decklists it has no printing-legality
// constraint, so we can surface the dramatic Marvel artwork. Adult hero cards only
// (types do NOT include 'young'). Heroes without an adult Marvel fall back to their
// regular printing in consumers.
export const HERO_MARVEL_PRINTING_IDS: Record<string, string> = {
  // Assassins
  'arakni, huntsman': 'GkTQBCJzmJHgMTrKNd6qH',
  'arakni, marionette': 'cMjgCqfBRmkwtGR6gCgt6',
  'arakni, 5l!p3d 7hru 7h3 cr4x': 'ndhzmwPDnPNhRJBpPKWCd',
  'nuu, alluring desire': 'QtMtcMzmcmbDpMJqcQLtW',

  // Brutes
  'kayo, armed and dangerous': 'FRC6K6BTNtzrrF6RRcwKc',
  'kayo, underhanded cheat': 'hjN6TnDDzqJGBFmhmQR8N',
  'tuffnut, bumbling hulkster': 'zkwNKBrhHmTnwMBrzhdfj',

  // Guardians
  'betsy, skin in the game': 't6MBPQL8MT7GBMTDcjPKb',
  'valda, seismic impact': 'WCGGk8MTgKTBKzDMkwwqj',
  'victor goldmane, high and mighty': 'RkQMDqD7TMffNzCBmzNMw',
  'lyath goldmane, vile savant': 'wJHKFwtNgKwGcT6WcQWGg',

  // Illusionists / Shapeshifters
  'pleiades, superstar': '6qBpKJrfzhmgJhNRGrcbn',
  'enigma, ledger of ancestry': 'HPKKdcJLbBRrpcKQt69gD',

  // Mechanologists
  'puffin, hightail': 'nfjHwhBfrKMKgwkFTCTmM',

  // Ninjas
  'gravy bones, shipwrecked looter': 'BFftmnPWFFTtNJTmRgw8W',
  'cindra, dracai of retribution': 'zbnPRKjnn9HT8WphKjngw',
  'zen, tamer of purpose': 'tQPKCjzwfPr7HMNtRWgCH',

  // Rangers
  'marlynn, treasure hunter': 'm8HzgzM789KRHdzfLkNz7',

  // Runeblades
  'aurora, shooting star': 'wT6TMjkLGcJ98HqCzwMdj',
  'aurora, legacy of tempest': '8ttHnDjQjjLkrT9QtBcGT',
  'briar, warden of thorns': 'B9TBh6dTQwQNnfqLfPpK9',
  'florian, rotwood harbinger': 'mF7Tqd8J7Rnn6wLcNHq9D',

  // Warriors
  'fang, dracai of blades': 'Mph7NpNLFFLjB7wTMmbDb',
  'kassai of the golden sand': 'JCFgtBGRdKtHDrQwQHLfD',
  'olympia, prized fighter': '6KgBNNDCww6WL98w7CTTF',
  'jarl vetreiði': 't8tntqfjrbbmCRdPnWGBL',

  // Bards
  'oscilio, constella intelligence': 'phb8MM8rg8gjtmJt6DTG6',
  'oscilio, forked continuum': 'bWBMqq7qHpDhwwg6gbBpf',
  'verdance, thorn of the rose': 'qKHDTdmJkCKnCj6WWT7Tf',
};

const MARVEL_IMAGE_BASE = 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg';

export function getHeroMarvelImageUrl(heroName: string): string | null {
  const key = heroName.toLowerCase();
  const printingId = HERO_MARVEL_PRINTING_IDS[key];
  if (!printingId) return null;
  return `${MARVEL_IMAGE_BASE}/${printingId}/public`;
}
